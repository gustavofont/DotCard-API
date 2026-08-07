import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePlayers1786143619000 implements MigrationInterface {
  name = 'CreatePlayers1786143619000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'players',
        columns: [
          { name: 'user_id', type: 'uuid', isPrimary: true },
          { name: 'friend_code', type: 'varchar', length: '8' },
          { name: 'display_name', type: 'varchar', length: '255' },
          { name: 'balance', type: 'bigint', default: 0 },
          { name: 'last_allowance_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'players',
      new TableIndex({
        name: 'IDX_PLAYERS_FRIEND_CODE',
        columnNames: ['friend_code'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('players');
  }
}
