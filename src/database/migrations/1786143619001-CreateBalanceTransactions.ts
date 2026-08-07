import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateBalanceTransactions1786143619001 implements MigrationInterface {
  name = 'CreateBalanceTransactions1786143619001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'balance_transactions',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'user_id', type: 'uuid' },
          { name: 'amount', type: 'bigint' },
          { name: 'balance_after', type: 'bigint' },
          {
            name: 'reason',
            type: 'enum',
            enum: ['INITIAL_GRANT', 'DAILY_ALLOWANCE', 'PACK_PURCHASE'],
            enumName: 'balance_transactions_reason_enum',
          },
          { name: 'pull_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    // Matches the ledger's main read pattern: "this user's history, newest first".
    await queryRunner.createIndex(
      'balance_transactions',
      new TableIndex({
        name: 'IDX_BALANCE_TRANSACTIONS_USER_CREATED',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    // Same database as players (unlike AuthForge's UUIDs), so a real FK
    // applies — RESTRICT because players are never deleted.
    await queryRunner.createForeignKey(
      'balance_transactions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'players',
        referencedColumnNames: ['user_id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('balance_transactions');
  }
}
