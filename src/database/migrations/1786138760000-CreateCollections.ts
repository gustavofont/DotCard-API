import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCollections1786138760000 implements MigrationInterface {
  name = 'CreateCollections1786138760000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'collections',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'collections',
      new TableIndex({ name: 'IDX_COLLECTIONS_NAME', columnNames: ['name'], isUnique: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('collections');
  }
}
