import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeAmountsToIntegerCents1770160500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert balance from decimal (reais) to bigint (centavos)
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "balance" TYPE bigint USING ROUND("balance" * 100)::bigint`,
    );

    // Convert amount from decimal (reais) to bigint (centavos)
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE bigint USING ROUND("amount" * 100)::bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert balance back to decimal (reais)
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "balance" TYPE decimal(15,2) USING ("balance"::decimal / 100)`,
    );

    // Revert amount back to decimal (reais)
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE decimal(15,2) USING ("amount"::decimal / 100)`,
    );
  }
}
