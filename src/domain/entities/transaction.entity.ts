import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TransactionType } from '../../shared/enums/transaction-type.enum';
import { TransactionStatus } from '../../shared/enums/transaction-status.enum';
import { User } from './user.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => parseInt(String(value), 10),
    },
  })
  amount: number;

  @Column({ name: 'related_user_id', type: 'uuid', nullable: true })
  relatedUserId: string | null;

  @Column({ name: 'related_transaction_id', type: 'uuid', nullable: true })
  relatedTransactionId: string | null;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_user_id' })
  relatedUser: User | null;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_transaction_id' })
  relatedTransaction: Transaction | null;
}
