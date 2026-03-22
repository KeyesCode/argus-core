# Testing Guide

## Integration Tests (automated)

The test suite in `test/phase1.spec.ts` validates the full pipeline against a real Postgres database using a deterministic mock chain provider. No RPC or Redis required.

### Prerequisites

- Docker running (for Postgres)
- Node dependencies installed (`yarn install`)

### Setup

```bash
# Start Postgres
docker compose up postgres -d

# Create the test database
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer_test;"

# Run tests
yarn test:integration
```

### What the tests cover

40 tests across 9 categories: ingestion correctness, ERC-20 decoding, checkpoint resume, idempotency, backfill lifecycle, search, API pagination, reorg detection, and metrics tracking. See `roadmap.md` Phase 1 for the full breakdown.

---

## Real-World Validation (manual)

This guide walks through testing the full pipeline against Ethereum mainnet using a real RPC endpoint.

### Step 1: Get an RPC endpoint

Sign up for a free Alchemy account. Create an Ethereum Mainnet app and copy the HTTP URL. The free tier (300M compute units/month) is more than enough for this test.

### Step 2: Pick a block range

Don't use early blocks (0-100) — they're mostly empty, pre-dating ERC-20 tokens. Use a recent range instead. Check the current block number on any explorer and pick a 100-block window.

For example, if the current block is around 22,700,000:

```
fromBlock: 22700000
toBlock:   22700099
```

A recent 100-block window on Ethereum mainnet contains:
- ~100-200 transactions per block
- ~10,000-20,000 total transactions
- Hundreds of ERC-20 transfers (USDC, USDT, WETH, etc.)
- Real contract interactions and log data

This is enough to validate every part of the pipeline with real data.

### Step 3: Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Use localhost when running apps directly (not inside Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=blockchain_indexer

REDIS_HOST=localhost
REDIS_PORT=6379

# Your Alchemy (or Infura, or any) RPC URL
CHAIN_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY_HERE
CHAIN_PROVIDER_TYPE=rpc

# Test settings
START_BLOCK=22700000
INGEST_BATCH_SIZE=10
INGEST_CONFIRMATIONS=0
INGEST_POLL_INTERVAL_MS=5000
BACKFILL_BATCH_SIZE=10
```

Important notes:
- `DB_HOST` and `REDIS_HOST` must be `localhost` when running apps on your machine. Use `postgres` / `redis` only when running inside Docker Compose.
- `INGEST_CONFIRMATIONS=0` so you don't need to be near the chain head.
- `BACKFILL_BATCH_SIZE=10` keeps RPC calls manageable per cycle on a free tier.

### Step 4: Start infrastructure

```bash
# Start Postgres and Redis
docker compose up postgres redis -d

# Run database migrations
yarn migration:run
```

### Step 5: Start the API

Terminal 1:

```bash
yarn start:dev:api
```

You should see:

```
[Nest] LOG [API] API server running on port 3000
```

### Step 6: Create a backfill job

In a separate shell, create a job for exactly 100 blocks:

```bash
curl -X POST http://localhost:3000/admin/backfill-jobs \
  -H "Content-Type: application/json" \
  -d '{"fromBlock": 22700000, "toBlock": 22700099, "batchSize": 10}'
```

You should get back a JSON response with `"status": "pending"`.

### Step 7: Start the backfill worker

Terminal 2:

```bash
yarn start:dev:worker-backfill
```

The backfill worker does the full pipeline in one pass:
- Fetches blocks + transactions from your RPC
- Fetches receipts + logs for each transaction
- Decodes ERC-20 Transfer events into the `token_transfers` table
- Updates job progress after each batch

Watch the logs for progress:

```
[BackfillRunnerService] Starting backfill job #1: 22700000 -> 22700099 (batch=10)
[BackfillRunnerService] Job #1: synced through block 22700009 (10%)
[BackfillRunnerService] Job #1: synced through block 22700019 (20%)
...
[BackfillJobService] Backfill job #1 completed
```

### Step 8: Monitor progress

While the backfill runs:

```bash
# Job status
curl http://localhost:3000/admin/backfill-jobs | jq

# Overall indexer status — watch counts grow
curl http://localhost:3000/admin/status | jq
```

The status response shows:

```json
{
  "indexedHead": "22700099",
  "counts": {
    "blocks": 100,
    "transactions": 15000,
    "logs": 40000,
    "tokenTransfers": 2000
  }
}
```

Once the job shows `"status": "completed"`, you can stop the backfill worker (Ctrl+C).

### Step 9: Query the data

With the API still running:

```bash
# Latest indexed blocks
curl http://localhost:3000/blocks/latest?limit=5 | jq

# A specific block with its transactions
curl http://localhost:3000/blocks/22700001 | jq

# Pick a transaction hash from the block response above
curl http://localhost:3000/transactions/0x<HASH> | jq

# Pick an address from the transaction response above
curl http://localhost:3000/addresses/0x<ADDRESS> | jq

# Search by block number
curl "http://localhost:3000/search?q=22700001" | jq

# Search by transaction hash
curl "http://localhost:3000/search?q=0x<HASH>" | jq

# Search by address
curl "http://localhost:3000/search?q=0x<ADDRESS>" | jq
```

### Step 10: Validate against Etherscan

This is the real correctness check. Pick 2-3 transactions from your indexed data and compare them against Etherscan.

```bash
# 1. Get a block and pick a transaction hash
curl http://localhost:3000/blocks/22700002 | jq '.transactions[0].hash'

# 2. Look up that transaction in your API
curl http://localhost:3000/transactions/0x<HASH> | jq
```

Then open `https://etherscan.io/tx/0x<HASH>` and compare:

| Field | Your API | Etherscan |
|-------|----------|-----------|
| `from` | `.transaction.fromAddress` | From |
| `to` | `.transaction.toAddress` | To |
| `value` | `.transaction.value` (in wei) | Value (convert to wei) |
| `status` | `.receipt.status` (1 = success) | Status |
| `gasUsed` | `.receipt.gasUsed` | Gas Used |
| log count | `.logs.length` | Logs count |
| token transfers | `.tokenTransfers.length` | Token Transfers tab |

Do this for:

1. **A simple ETH transfer** — transaction with no logs or token transfers
2. **An ERC-20 transfer** — look for a USDC/USDT transaction (tokenTransfers should have the correct token address, from, to, and amount)
3. **A complex contract interaction** — transaction with multiple logs

If all three match, the pipeline is producing correct data from real chain state.

### Step 11: Test the ingest worker (optional)

If you want to test live sync instead of backfill:

```bash
# Set START_BLOCK to something very recent (current head minus ~20)
# Edit .env: START_BLOCK=22711800  (or whatever is recent)

yarn start:dev:worker-ingest
```

This polls for new blocks and syncs them as they arrive. Note: the ingest worker does not decode ERC-20 transfers — it enqueues decode jobs via Redis. To get transfers, also run:

```bash
yarn start:dev:worker-decode
```

The ingest worker will keep syncing forward indefinitely. Stop it with Ctrl+C once you've seen enough blocks. The checkpoint is saved per-block, so your data is safe.

---

## Which apps do what

| App | What it does | When to run it |
|-----|-------------|----------------|
| `api` | REST API for querying indexed data | Always — needed to query data and create backfill jobs |
| `worker-backfill` | Ingests a specific block range (blocks + txs + receipts + logs + ERC-20 transfers) | For controlled tests with exact block ranges |
| `worker-ingest` | Polls for new blocks from chain head, syncs blocks + txs, enqueues receipt processing | For live sync testing |
| `worker-decode` | Processes queued jobs to fetch receipts + decode ERC-20 transfers | Only needed with `worker-ingest` (backfill worker handles decoding itself) |

For a controlled test, you only need: **`api` + `worker-backfill`**.

For live sync, you need: **`api` + `worker-ingest` + `worker-decode`**.

---

## Troubleshooting

### `CHAIN_RPC_URL environment variable is required`
The `.env` file isn't being loaded. Make sure `.env` exists in the project root with `CHAIN_RPC_URL` set.

### `getaddrinfo ENOTFOUND postgres` or `getaddrinfo ENOTFOUND redis`
You're running apps directly on your machine but `DB_HOST` or `REDIS_HOST` is set to the Docker container name. Change them to `localhost` in `.env`.

### `database "blockchain_indexer" does not exist`
Run the Postgres container first, then create the database:
```bash
docker compose up postgres -d
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer;"
```

### `relation "blocks" does not exist`
Migrations haven't been run:
```bash
yarn migration:run
```

### RPC rate limiting / timeouts
Reduce batch sizes in `.env`:
```env
INGEST_BATCH_SIZE=5
BACKFILL_BATCH_SIZE=5
```

### Backfill seems slow
Each block requires 1 RPC call for the block + 1 call per transaction for receipts. A block with 200 transactions = 201 RPC calls. At free-tier rate limits, expect ~1-3 blocks per second. 100 blocks should complete in 1-5 minutes.

---

## Resetting for a fresh test

```bash
# Drop and recreate the database
docker compose exec postgres psql -U postgres -c "DROP DATABASE blockchain_indexer;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE blockchain_indexer;"

# Re-run migrations
yarn migration:run
```

Or to reset just the data without dropping tables:

```bash
docker compose exec postgres psql -U postgres -d blockchain_indexer -c "
  DELETE FROM token_transfers;
  DELETE FROM logs;
  DELETE FROM transaction_receipts;
  DELETE FROM transactions;
  DELETE FROM blocks;
  DELETE FROM token_contracts;
  DELETE FROM sync_checkpoints;
  DELETE FROM backfill_jobs;
  DELETE FROM reorg_events;
"
```
