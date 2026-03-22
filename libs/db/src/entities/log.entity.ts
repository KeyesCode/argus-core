import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'logs' })
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['transactionHash'])
@Index(['address'])
@Index(['topic0'])
export class LogEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @Column({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @Column({ name: 'transaction_index', type: 'integer' })
  transactionIndex!: number;

  @Column({ name: 'log_index', type: 'integer' })
  logIndex!: number;

  @Column({ type: 'varchar', length: 42 })
  address!: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  topic0!: string | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  topic1!: string | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  topic2!: string | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  topic3!: string | null;

  @Column({ type: 'text' })
  data!: string;

  @Column({ type: 'boolean', default: false })
  removed!: boolean;
}
