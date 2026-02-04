import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateTransactionsTable1770160487479 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "transaction_type_enum" AS ENUM('DEPOSIT', 'TRANSFER', 'REVERSAL')`,
    );

    await queryRunner.query(
      `CREATE TYPE "transaction_status_enum" AS ENUM('COMPLETED', 'REVERSED')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'transaction_type_enum',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'related_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'related_transaction_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'transaction_status_enum',
            default: `'COMPLETED'`,
            isNullable: false,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('transactions', [
      new TableForeignKey({
        name: 'FK_TRANSACTIONS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_TRANSACTIONS_RELATED_USER',
        columnNames: ['related_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_TRANSACTIONS_RELATED_TRANSACTION',
        columnNames: ['related_transaction_id'],
        referencedTableName: 'transactions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('transactions', [
      new TableIndex({
        name: 'IDX_TRANSACTIONS_USER_ID',
        columnNames: ['user_id'],
      }),
      new TableIndex({
        name: 'IDX_TRANSACTIONS_TYPE',
        columnNames: ['type'],
      }),
      new TableIndex({
        name: 'IDX_TRANSACTIONS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('transactions');
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_type_enum"`);
  }
}
