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

---

## Phase 1: Prove the core system works end-to-end

**Goal:** Confidence that the pipeline is correct, idempotent, and recoverable.

- [ ] Ingest a small recent block range (e.g. 100 blocks on Ethereum or Base)
- [ ] Confirm blocks, transactions, receipts, and logs all line up in the DB
- [ ] Verify ERC-20 transfer decoding against known transfers (pick a well-known token like USDC)
- [ ] Test restart behavior mid-sync (kill worker-ingest, restart, confirm it resumes from checkpoint)
- [ ] Test duplicate queue delivery (manually re-enqueue a block, confirm no duplicate logs/receipts)
- [ ] Test backfill job create -> run -> pause -> resume -> complete lifecycle
- [ ] Test search results for tx hash, block number, and address via the API
- [ ] Verify API pagination works correctly on address endpoints
- [ ] Test reorg detection by manually inserting a block with wrong parent hash, then syncing

**Validation criteria:**
- No duplicate rows in any table
- Retries do not corrupt state
- Checkpoints resume at the correct block
- Decode worker can be rerun safely on same block range
- API queries reflect canonical DB state
- Reorg triggers rollback and re-sync from common ancestor

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

### Remaining:
- [ ] Test with simulated reorg scenarios (insert wrong parent hash, trigger detection)
- [ ] Test multi-block reorg rollback (depth > 1)
- [ ] Consider storing recent block hashes in Redis for faster parent hash lookups (optimization)
- [ ] Add alerting when reorg depth exceeds a threshold (e.g. > 3 blocks)

**Depth limits:**
- Typical Ethereum reorgs are 1-2 blocks deep
- Max reorg depth set to 128 blocks — beyond that, manual intervention required
- Base (L2) reorgs are rarer but can be deeper in edge cases

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
