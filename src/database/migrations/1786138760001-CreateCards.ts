import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCards1786138760001 implements MigrationInterface {
  name = 'CreateCards1786138760001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'cards',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '255' },
          {
            name: 'type',
            type: 'enum',
            enum: ['CREATURE', 'LAND', 'SORCERY', 'ARTIFACT'],
            enumName: 'cards_type_enum',
          },
          { name: 'collection_id', type: 'int' },
          {
            name: 'rarity',
            type: 'enum',
            enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'],
            enumName: 'cards_rarity_enum',
          },
          { name: 'image_key', type: 'varchar', length: '512', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    );

    // Matches the pull algorithm's query shape exactly: uniformly pick a
    // card of a given rarity within a given collection (ESCOPO.md §5.2/§6).
    await queryRunner.createIndex(
      'cards',
      new TableIndex({
        name: 'IDX_CARDS_COLLECTION_RARITY',
        columnNames: ['collection_id', 'rarity'],
      }),
    );

    await queryRunner.createForeignKey(
      'cards',
      new TableForeignKey({
        columnNames: ['collection_id'],
        referencedTableName: 'collections',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cards');
  }
}
