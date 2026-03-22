# Blockchain Indexer Roadmap

## Current State

The core architecture is in place: 4 NestJS apps (API, worker-ingest, worker-decode, worker-backfill), 5 shared libs, Postgres schema with migration, Docker Compose, and a chain provider abstraction layer.

What exists:
- Block + transaction + receipt + log ingestion pipeline
- ERC-20 transfer decoding
- Checkpoint-based resumable sync
- Backfill job system with pause/resume
- Explorer API (blocks, transactions, addresses, tokens, search)
- Admin status + metrics endpoints
- Confirmation depth (default 6 blocks) before syncing
- Upsert-based writes (idempotent for blocks/txs/receipts)
- Bull/Redis queue between ingest and decode workers
- MetricsService with counters, gauges, rate tracking, error recording
- ReorgDetectionService with parent hash validation, rollback, and audit trail
- `reorg_events` table for tracking reorganization history
- Integration test suite (40 tests) validating the full pipeline against a real Postgres database

---

## Phase 1: Prove the core system works end-to-end

**Goal:** Confidence that the pipeline is correct, idempotent, and recoverable.

**Status:** Validated via integration tests (`test/phase1.spec.ts` — 40 tests, all passing).

Test infrastructure:
- `TestChainProvider` generates deterministic blocks with txs, receipts, ERC-20 Transfer logs, and Approval logs
- Tests run against a real Postgres database (`blockchain_indexer_test`) with `synchronize: true`
- Bull queues replaced with in-memory `MockQueue` (no Redis dependency in tests)
- `beforeEach` truncates all tables and resets chain provider for full isolation

### Ingestion correctness (5 tests)
- [x] Ingest blocks with transactions — 5 blocks synced, sequential numbers verified, every tx references a valid block
- [x] Ingest receipts and logs — every receipt references a valid tx, every log references a valid block
- [x] Parent hash chain — `blocks[i].parentHash === blocks[i-1].hash` for all consecutive blocks
- [x] Address/hash normalization — all hashes and addresses in DB are lowercase
- [x] Queue integration — each synced block enqueues a decode job with correct block number

### ERC-20 transfer decoding (2 tests)
- [x] Decodes Transfer events from logs — validates token address, from/to format (regex), positive amount
- [x] Does not decode non-Transfer logs — transfer count < total log count (Approval logs are skipped)

### Checkpoint resume (3 tests)
- [x] Checkpoint created after sync — `lastSyncedBlock` matches last synced block number
- [x] Resume from checkpoint — second `syncNextBatch` continues where first left off, no gaps in block sequence
- [x] Per-block checkpointing — checkpoint updates after each block, not just at batch end

### Idempotency (5 tests)
- [x] No duplicate blocks — `syncBlock(1)` called twice, exactly 1 block in DB
- [x] No duplicate transactions — re-sync same block, tx count matches chain provider
- [x] No duplicate receipts — process receipts twice, count matches tx count
- [x] No duplicate logs — re-process receipts, log count unchanged (receipt-exists guard + `orIgnore`)
- [x] No duplicate token transfers — decode same block twice, transfer count unchanged (`orIgnore` on unique constraint)

### Backfill lifecycle (4 tests)
- [x] Job creation — correct status (PENDING), fromBlock, toBlock, batchSize persisted
- [x] Run to completion — blocks, receipts, logs all ingested, status changes to COMPLETED
- [x] Pause/resume — paused job not picked up by `processNextJob`, resumed job runs successfully
- [x] Multi-batch completion — job with non-evenly-divisible range (10 blocks / 3 per batch) completes all blocks

### Search (5 tests)
- [x] Find block by number — searches "1", returns type "block"
- [x] Find transaction by hash — real 66-char hash from DB, returns type "transaction"
- [x] Find address with transactions — real 42-char address from DB, returns type "address"
- [x] Unknown query returns none — valid address format with no matching data
- [x] Find block by hash — 66-char hash matched as block (after checking transactions first)

### API pagination (6 tests)
- [x] Limit and offset — page 1 and page 2 return no overlapping tx hashes
- [x] Max limit enforcement — requesting limit=500 returns limit=100
- [x] Token transfer pagination — limit/offset/total fields returned correctly
- [x] Latest blocks — returns requested count in descending block number order
- [x] Block details — includes transactions array with length > 0
- [x] Transaction details — includes receipt, logs > 0, token transfers > 0

### Reorg detection (7 tests)
- [x] No false positive — clean chain returns `detected: false`
- [x] Detects mismatch — corrupted parentHash triggers `detected: true` with correct reorgBlock
- [x] Rollback cleans data — blocks/txs/logs/transfers for reorged range deleted, only ancestor blocks remain
- [x] Checkpoint reset — checkpoint moves back to common ancestor block number
- [x] Audit trail — `reorg_events` row with correct reorgBlock, depth, commonAncestorBlock
- [x] Re-sync after rollback — checkpoint at ancestor, `syncNextBatch` successfully re-ingests
- [x] Auto-trigger — reorg detection wired into `syncNextBatch`, returns 0 and records event

### Metrics (3 tests)
- [x] Blocks synced counter — delta of 5 after syncing 5 blocks
- [x] Chain head and lag gauges — chain_head=100, indexed_head=5, lag=95
- [x] Decode counters — blocks_processed delta = 10, erc20_transfers delta > 0

### Known test weaknesses
- "should paginate token transfers" has an early `return` if no transfers found (silently passes) — in practice always has data due to mock, but the guard masks potential failures
- "should return transaction with receipt, logs, and transfers" has same `if (!tx) return` pattern
- "should track progress and resume from current_block" tests multi-batch completion but not actual mid-execution pause/resume
- Lowercase normalization test is a regression guard — hex from `toString(16)` is already lowercase, but catches future changes to mixed-case input

### Remaining (manual validation against real chain)
- [ ] Run against a real Ethereum or Base RPC with recent blocks and verify data matches Etherscan
- [ ] Test actual process kill mid-sync and restart to confirm checkpoint resume under real conditions

---

## Phase 2: Add observability

**Goal:** Turn "code that runs" into "a system you can operate."

- [x] Add `MetricsService` with counters, gauges, rate tracking, error recording (`libs/common/src/metrics/`)
- [x] Add ingest lag metric: `ingest.lag` gauge tracking distance from chain head
- [x] Add ingest rate tracking: `ingest.blocks` rate recorded per sync batch
- [x] Add decode success counts: `decode.blocks_processed` counter, `decode.erc20_transfers` counter
- [x] Add backfill throughput metrics: `backfill.blocks_synced` counter, `backfill.progress_pct` gauge
- [x] Expand `/admin/status` to include:
  - `indexedHead` — latest block in DB
  - `earliestBlock` — earliest indexed block
  - `counts` — blocks, transactions, logs, token transfers
  - per-checkpoint worker status
  - active backfill job details
  - reorg event count
- [x] Add `/admin/metrics` endpoint with DB counts, sync state, backfill stats, reorg count
- [x] Add error tracking: `MetricsService.recordError()` with worker name, message, context
- [x] Add `/admin/reorgs` endpoint showing recent reorg events
- [ ] Add structured logging with request/job correlation IDs
- [ ] Add queue depth tracking (Bull queue pending/active/completed/failed counts) to metrics endpoint
- [ ] Wire `MetricsService` into API app for request-side observability

---

## Phase 3: Lock down correctness / constraints

**Goal:** The database enforces the application's assumptions.

### Already in place:
- [x] Unique constraint on `blocks.hash`
- [x] Unique composite index on `transactions(block_number, transaction_index)`
- [x] Primary key on `transactions.hash`
- [x] Primary key on `transaction_receipts.transaction_hash`
- [x] Unique composite index on `token_transfers(transaction_hash, log_index)`
- [x] Foreign key: transactions -> blocks (CASCADE DELETE)
- [x] Foreign key: transaction_receipts -> transactions (CASCADE DELETE)
- [x] Indexes on: from_address, to_address, block_number, token_address, topic0, timestamp
- [x] Unique constraint on `logs(transaction_hash, log_index)` — migration `1711200000000`
- [x] Partial index on `transaction_receipts.contract_address` — migration `1711200000000`

### Remaining:
- [ ] Review whether foreign keys on logs -> transactions would help or hurt ingestion performance
- [ ] Validate that `orIgnore()` on log inserts correctly uses the new unique constraint
- [ ] Consider partial index on `backfill_jobs.status` for active job queries
- [ ] Validate that all address/hash columns are consistently lowercased at write time (currently handled in service layer — consider a DB trigger or CHECK constraint as defense-in-depth)

---

## Phase 4: Expand decode coverage

**Goal:** Support the most common token standards beyond ERC-20.

### Current:
- [x] ERC-20 Transfer (`0xddf252ad...`)

### Next:
- [ ] ERC-721 Transfer — same topic0 as ERC-20 but has 4 topics (topic3 = tokenId). Differentiate by topic count
- [ ] ERC-1155 TransferSingle (`0xc3d58168...`) — decode operator, from, to, id, value from topics + data
- [ ] ERC-1155 TransferBatch (`0x4a39dc06...`) — decode operator, from, to, ids[], values[] from topics + data
- [ ] Add `token_standard` column to `token_transfers` table (ERC20 / ERC721 / ERC1155)
- [ ] Add `token_id` column to `token_transfers` for NFT transfers
- [ ] Update token metadata service to detect contract standard (ERC-20 vs ERC-721 vs ERC-1155)
- [ ] Add NFT-specific API endpoints if needed

### Signatures already defined in `libs/abi/src/signatures.ts`:
- `ERC20_TRANSFER_TOPIC`
- `ERC721_TRANSFER_TOPIC` (same as ERC-20)
- `ERC1155_TRANSFER_SINGLE_TOPIC`
- `ERC1155_TRANSFER_BATCH_TOPIC`

---

## Phase 5: Reorg handling

**Goal:** Detect and recover from blockchain reorganizations.

### Implemented:
- [x] `ReorgDetectionService` in worker-ingest (`apps/worker-ingest/src/ingest/services/reorg-detection.service.ts`)
- [x] Parent hash validation on each sync batch — checks `block.parentHash === stored previous block hash`
- [x] Common ancestor detection — walks back up to 128 blocks comparing hashes
- [x] Rollback: deletes blocks (CASCADE handles txs, receipts), explicitly deletes orphaned logs and token_transfers
- [x] Checkpoint reset to common ancestor after rollback
- [x] `reorg_events` table for audit trail (block, depth, old hash, new hash, common ancestor)
- [x] `/admin/reorgs` endpoint showing recent reorg events
- [x] Reorg counter metric (`reorg.count`) and last depth gauge (`reorg.last_depth`)
- [x] Max reorg depth of 128 blocks — logs critical error if exceeded
- [x] Integration tests: no false positive, detection, rollback, checkpoint reset, audit trail, re-sync, auto-trigger (7 tests)

### Remaining:
- [ ] Test against real chain reorg (or simulate with a local devnet fork)
- [ ] Consider storing recent block hashes in Redis for faster parent hash lookups (optimization)
- [ ] Add alerting when reorg depth exceeds a threshold (e.g. > 3 blocks)

**Depth limits:**
- Typical Ethereum reorgs are 1-2 blocks deep
- Max reorg depth set to 128 blocks — beyond that, manual intervention required
- Base (L2) reorgs are rarer but can be deeper in edge cases

---

## Bug fixes applied during testing

- **Search controller BigInt overflow** — `Number('0xdeadbeef...')` produced a float that overflowed Postgres bigint. Fixed: block number search now only triggers on pure digit strings (`/^\d+$/`). File: `apps/api/src/search/search.controller.ts`

---

## Future phases (not yet planned in detail)

### Phase 6: Internal transactions / traces
- `debug_traceBlockByNumber` or `trace_block` for internal ETH transfers
- Separate `internal_transactions` table
- Requires archive node or trace-enabled RPC

### Phase 7: Contract verification and ABI registry
- Store verified contract ABIs
- Auto-decode all events for verified contracts
- Contract creation tracking from receipt `contractAddress`

### Phase 8: Multi-chain support
- Chain-aware entity design (chain_id column or separate schemas)
- Multiple chain provider instances
- Per-chain workers and checkpoints

### Phase 9: Analytics / materialized views
- Address activity summaries
- Token holder snapshots
- Gas analytics
- Active address counts per day

### Phase 10: Frontend explorer
- Next.js frontend
- Block, transaction, address, token pages
- Real-time updates via WebSocket
