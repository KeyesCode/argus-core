# Table Partitioning Strategy

## When to implement

Partition when any of these tables exceed ~50M rows:
- `logs` (currently the largest — grows fastest at ~440 logs per block)
- `token_transfers` (~250 per block)
- `transactions` (~170 per block)

At Ethereum's ~7,200 blocks/day:
- ~3.2M logs/day
- ~1.8M transfers/day
- ~1.2M transactions/day

You'll hit 50M logs in about 2 weeks of full mainnet sync.

## Partition scheme

**Partition by `block_number` range.** Not by time — block numbers are monotonically increasing and all queries filter or sort by block_number.

### Recommended range size

1,000,000 blocks per partition (~5.5 days of Ethereum).

This gives:
- ~440M logs per partition (manageable)
- ~12-15 partitions for all of Ethereum history
- Small enough for efficient vacuum and index rebuilds
- Large enough to avoid partition sprawl

### Migration plan

This is a destructive migration — it recreates tables. Must be done during a maintenance window.

```sql
-- Step 1: Rename existing tables
ALTER TABLE logs RENAME TO logs_old;
ALTER TABLE token_transfers RENAME TO token_transfers_old;
ALTER TABLE transactions RENAME TO transactions_old;

-- Step 2: Create partitioned tables
CREATE TABLE logs (
  id BIGSERIAL,
  block_number bigint NOT NULL,
  transaction_hash varchar(66) NOT NULL,
  transaction_index integer NOT NULL,
  log_index integer NOT NULL,
  address varchar(42) NOT NULL,
  topic0 varchar(66),
  topic1 varchar(66),
  topic2 varchar(66),
  topic3 varchar(66),
  data text NOT NULL,
  removed boolean NOT NULL DEFAULT false
) PARTITION BY RANGE (block_number);

CREATE TABLE token_transfers (
  id BIGSERIAL,
  transaction_hash varchar(66) NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL,
  token_address varchar(42) NOT NULL,
  from_address varchar(42) NOT NULL,
  to_address varchar(42) NOT NULL,
  amount_raw numeric(78,0) NOT NULL
) PARTITION BY RANGE (block_number);

-- Step 3: Create partitions (example for blocks 0-5M)
CREATE TABLE logs_0_1m PARTITION OF logs
  FOR VALUES FROM (0) TO (1000000);
CREATE TABLE logs_1m_2m PARTITION OF logs
  FOR VALUES FROM (1000000) TO (2000000);
-- ... repeat for each million-block range up to current head

CREATE TABLE token_transfers_0_1m PARTITION OF token_transfers
  FOR VALUES FROM (0) TO (1000000);
-- ... repeat

-- Step 4: Copy data
INSERT INTO logs SELECT * FROM logs_old;
INSERT INTO token_transfers SELECT * FROM token_transfers_old;

-- Step 5: Recreate indexes on partitioned tables
-- Postgres automatically creates per-partition indexes
CREATE UNIQUE INDEX ON logs (transaction_hash, log_index);
CREATE INDEX ON logs (block_number);
CREATE INDEX ON logs (address);
CREATE INDEX ON logs (topic0);
CREATE INDEX ON logs (block_number, topic0);

CREATE UNIQUE INDEX ON token_transfers (transaction_hash, log_index);
CREATE INDEX ON token_transfers (token_address, block_number DESC, log_index DESC);
CREATE INDEX ON token_transfers (from_address, block_number DESC, log_index DESC);
CREATE INDEX ON token_transfers (to_address, block_number DESC, log_index DESC);
CREATE INDEX ON token_transfers (block_number);

-- Step 6: Drop old tables
DROP TABLE logs_old;
DROP TABLE token_transfers_old;
```

### Automatic partition creation

Add a cron job or worker task that creates new partitions ahead of time:

```sql
-- Check if we need a new partition
-- If latest block is within 100k of the partition boundary, create the next one
CREATE TABLE IF NOT EXISTS logs_22m_23m PARTITION OF logs
  FOR VALUES FROM (22000000) TO (23000000);
```

This should run daily or whenever the sync approaches a boundary.

### What NOT to partition

- `blocks` — small table (one row per block), no benefit
- `transaction_receipts` — one-to-one with transactions, partition only if transactions are partitioned
- `token_contracts` — tiny table
- `sync_checkpoints`, `backfill_jobs`, `reorg_events` — tiny operational tables

### Impact on queries

Postgres automatically prunes partitions during queries when `block_number` is in the WHERE clause. All our API queries already filter by block_number or sort by it, so partition pruning will work automatically.

The `OR` queries for address lookups (`from_address = ? OR to_address = ?`) will scan relevant partitions only when combined with a block_number range.

### Impact on ingestion

No change needed. `INSERT INTO logs` automatically routes to the correct partition based on `block_number`. The backfill worker and ingest worker work the same way.

### TypeORM considerations

TypeORM doesn't natively support partitioned tables. The entity definitions stay the same — they point at the parent table name. Partitioning is transparent at the SQL level.

The migration to create partitions should be done via raw SQL migrations, not TypeORM schema sync.
