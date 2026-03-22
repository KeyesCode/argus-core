# Blockchain Indexer

A self-hosted blockchain indexing platform that syncs chain data into Postgres and serves it through a REST API. Built to own your data layer instead of paying per-query API costs.

Designed so you can start with a hosted RPC (Alchemy, Infura) today and swap to your own node later by changing one environment variable.

## Architecture

```
Blockchain Node / RPC
        |
        v
┌─────────────────┐     ┌──────────────────┐
│  worker-ingest   │────>│   Redis / Bull    │
│  (blocks, txs,   │     │   (job queues)    │
│   receipts, logs)│     └────────┬─────────┘
└─────────────────┘              │
                                 v
                        ┌──────────────────┐
                        │  worker-decode    │
                        │  (ERC-20, events) │
                        └────────┬─────────┘
                                 │
┌─────────────────┐              v
│ worker-backfill  │────> ┌──────────────┐ <──── ┌─────────┐
│ (historical sync)│      │   Postgres   │       │   API   │
└─────────────────┘       └──────────────┘       └─────────┘
```

**4 apps:**

| App | Role |
|-----|------|
| `api` | REST API — blocks, transactions, addresses, tokens, search, admin |
| `worker-ingest` | Polls for new blocks, syncs blocks + txs, enqueues receipt processing |
| `worker-decode` | Processes logs from queue, decodes ERC-20 transfers |
| `worker-backfill` | Runs historical backfill jobs with pause/resume support |

**5 shared libs:**

| Lib | Role |
|-----|------|
| `chain-provider` | `ChainProvider` interface + RPC/mock implementations (ethers.js) |
| `db` | TypeORM entities, migrations, data source config |
| `queue` | Bull queue module + constants |
| `abi` | Event signatures (ERC-20/721/1155) + ERC-20 ABI |
| `common` | Address normalization, retry utility, MetricsService |

## Quick Start

### Prerequisites

- Node.js 20+
- Yarn
- Docker and Docker Compose
- An RPC endpoint (Alchemy, Infura, or your own node)

### Setup

```bash
# 1. Clone and install
yarn install

# 2. Configure environment
cp .env.example .env
# Edit .env — set CHAIN_RPC_URL to your RPC endpoint

# 3. Start Postgres and Redis
docker compose up postgres redis -d

# 4. Run database migrations
yarn migration:run

# 5. Start services (each in a separate terminal)
yarn start:dev:api
yarn start:dev:worker-ingest
yarn start:dev:worker-decode
yarn start:dev:worker-backfill
```

Or run everything with Docker Compose:

```bash
docker compose up
```

### Running with Mock Provider

To test without an RPC endpoint, set `CHAIN_PROVIDER_TYPE=mock` in your `.env`. The mock provider returns empty blocks for local development.

## API Endpoints

### Explorer

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/blocks/latest?limit=25` | Latest indexed blocks |
| `GET` | `/blocks/:numberOrHash` | Block details with transactions |
| `GET` | `/transactions/:hash` | Transaction + receipt + logs + token transfers |
| `GET` | `/addresses/:address` | Address overview with recent activity |
| `GET` | `/addresses/:address/transactions?limit=25&offset=0` | Paginated transaction history |
| `GET` | `/addresses/:address/token-transfers?limit=25&offset=0` | Paginated token transfers |
| `GET` | `/tokens` | List indexed token contracts |
| `GET` | `/tokens/:address` | Token contract info + recent transfers |
| `GET` | `/tokens/:address/transfers?limit=25&offset=0` | Paginated token transfers |
| `GET` | `/search?q=` | Search by tx hash, address, or block number |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/status` | Indexer status: indexed head, table counts, checkpoints, active jobs |
| `GET` | `/admin/metrics` | DB counts, sync state, backfill stats, reorg count |
| `GET` | `/admin/checkpoints` | Per-worker sync checkpoints |
| `GET` | `/admin/backfill-jobs` | All backfill jobs |
| `POST` | `/admin/backfill-jobs` | Create a backfill job `{ fromBlock, toBlock, batchSize? }` |
| `PATCH` | `/admin/backfill-jobs/:id/pause` | Pause a running backfill |
| `PATCH` | `/admin/backfill-jobs/:id/resume` | Resume a paused backfill |
| `GET` | `/admin/reorgs?limit=25` | Recent chain reorganization events |

## Database Schema

8 core tables + 1 audit table:

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `blocks` | `number` | Block headers |
| `transactions` | `hash` | Transactions (FK -> blocks, CASCADE) |
| `transaction_receipts` | `transaction_hash` | Receipts (FK -> transactions, CASCADE) |
| `logs` | `id` | Event logs (unique on `tx_hash + log_index`) |
| `token_contracts` | `address` | ERC-20/721/1155 contract metadata |
| `token_transfers` | `id` | Decoded token transfers (unique on `tx_hash + log_index`) |
| `sync_checkpoints` | `worker_name` | Per-worker sync progress |
| `backfill_jobs` | `id` | Historical backfill job state |
| `reorg_events` | `id` | Chain reorganization audit trail |

## Project Structure

```
blockchain-indexer/
├── apps/
│   ├── api/                    # REST API server
│   ├── worker-ingest/          # Block sync + receipt ingestion
│   ├── worker-decode/          # Log decoding (ERC-20 transfers)
│   └── worker-backfill/        # Historical backfill jobs
├── libs/
│   ├── chain-provider/         # ChainProvider interface + implementations
│   ├── db/                     # Entities, migrations, data source
│   ├── queue/                  # Bull queue module
│   ├── abi/                    # Event signatures + ABIs
│   └── common/                 # Utilities, MetricsService
├── docker-compose.yml
├── Dockerfile
├── nest-cli.json
├── roadmap.md
└── package.json
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `DB_HOST` | `postgres` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_USERNAME` | `postgres` | Postgres user |
| `DB_PASSWORD` | `postgres` | Postgres password |
| `DB_NAME` | `blockchain_indexer` | Postgres database name |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `CHAIN_RPC_URL` | — | RPC endpoint URL (required) |
| `CHAIN_PROVIDER_TYPE` | `rpc` | `rpc` or `mock` |
| `INGEST_CONFIRMATIONS` | `6` | Blocks to wait before indexing (finality buffer) |
| `INGEST_BATCH_SIZE` | `50` | Blocks per sync batch |
| `INGEST_POLL_INTERVAL_MS` | `5000` | Polling interval for new blocks |
| `BACKFILL_BATCH_SIZE` | `250` | Blocks per backfill batch |
| `START_BLOCK` | `0` | Block number to start syncing from |

## Key Design Decisions

**Raw first, decode second.** Blocks, transactions, receipts, and logs are stored as-is before any decoding. If decode logic changes, you can reprocess from raw data without re-downloading from the chain.

**Chain provider is an interface.** The `ChainProvider` abstraction means switching from a hosted RPC to a local node is a config change, not a rewrite.

**Idempotent writes.** All ingestion uses upserts and `orIgnore` inserts. Re-processing a block range produces the same result.

**Checkpoints are mandatory.** Every worker tracks its progress. Crashes resume from the last checkpoint, not from the beginning.

**Reorg-aware.** The ingest worker validates parent hashes before each sync batch. If a reorg is detected, it finds the common ancestor, rolls back affected data, resets checkpoints, and re-syncs.

## Migrations

```bash
# Run pending migrations
yarn migration:run

# Revert last migration
yarn migration:revert

# Generate a new migration from entity changes
yarn migration:generate libs/db/src/migrations/MigrationName
```

## Scripts

```bash
# Development (watch mode)
yarn start:dev:api
yarn start:dev:worker-ingest
yarn start:dev:worker-decode
yarn start:dev:worker-backfill

# Production
yarn build
yarn start:prod:api
yarn start:prod:worker-ingest
yarn start:prod:worker-decode
yarn start:prod:worker-backfill

# Tests
yarn test
yarn test:watch
yarn test:cov

# Lint
yarn lint
```

## Roadmap

See [roadmap.md](roadmap.md) for the full phased development plan with checklists.
