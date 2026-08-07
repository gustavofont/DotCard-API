import { DataSource } from 'typeorm';
import { CardType } from '../../common/enums/card-type.enum';
import { Rarity } from '../../common/enums/rarity.enum';
import { Card } from '../../modules/cards/entities/card.entity';
import { Collection } from '../../modules/cards/entities/collection.entity';

interface CardSeed {
  name: string;
  type: CardType;
  rarity: Rarity;
}

interface CollectionSeed {
  name: string;
  cards: CardSeed[];
}

/**
 * Fantasy/RPG-themed dev data: ~26 cards across the 4 rarities, in 2
 * collections — enough to exercise the pull algorithm end to end.
 *
 * "Ruínas Esquecidas" deliberately has no LEGENDARY card, so the pull
 * algorithm's renormalization path (ESCOPO.md §6 — re-roll excluding empty
 * rarities when a collection has none of the sorted rarity) has a real
 * collection to exercise it against, not just a unit test fixture.
 */
const COLLECTIONS: CollectionSeed[] = [
  {
    name: 'Reino de Eldrath',
    cards: [
      { name: 'Escudeiro da Vila', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Lenhador Corajoso', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Planície Dourada', type: CardType.LAND, rarity: Rarity.COMMON },
      { name: 'Golpe Relâmpago', type: CardType.SORCERY, rarity: Rarity.COMMON },
      { name: 'Espada Enferrujada', type: CardType.ARTIFACT, rarity: Rarity.COMMON },
      { name: 'Batedor da Floresta', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Aprendiz de Ferreiro', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Cão de Caça Adestrado', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Cavaleiro do Alvorecer', type: CardType.CREATURE, rarity: Rarity.RARE },
      { name: 'Torre de Vigia Élfica', type: CardType.LAND, rarity: Rarity.RARE },
      { name: 'Tempestade Arcana', type: CardType.SORCERY, rarity: Rarity.RARE },
      { name: 'Elmo do General Caído', type: CardType.ARTIFACT, rarity: Rarity.RARE },
      { name: 'Dragão Jovem de Bronze', type: CardType.CREATURE, rarity: Rarity.EPIC },
      { name: 'Ritual da Aurora', type: CardType.SORCERY, rarity: Rarity.EPIC },
      { name: 'Coroa dos Reis Antigos', type: CardType.ARTIFACT, rarity: Rarity.EPIC },
      { name: 'Dragão Ancião Dourado', type: CardType.CREATURE, rarity: Rarity.LEGENDARY },
    ],
  },
  {
    name: 'Ruínas Esquecidas',
    cards: [
      { name: 'Esqueleto Errante', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Pântano Sombrio', type: CardType.LAND, rarity: Rarity.COMMON },
      { name: 'Toque Necrótico', type: CardType.SORCERY, rarity: Rarity.COMMON },
      { name: 'Adaga Amaldiçoada', type: CardType.ARTIFACT, rarity: Rarity.COMMON },
      { name: 'Rato Gigante das Ruínas', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Morcego das Cavernas', type: CardType.CREATURE, rarity: Rarity.COMMON },
      { name: 'Necromante Renegado', type: CardType.CREATURE, rarity: Rarity.RARE },
      { name: 'Cripta Selada', type: CardType.LAND, rarity: Rarity.RARE },
      { name: 'Praga Sussurrante', type: CardType.SORCERY, rarity: Rarity.RARE },
      { name: 'Lich Ancestral', type: CardType.CREATURE, rarity: Rarity.EPIC },
      // No LEGENDARY card in this collection — intentional, see comment above.
    ],
  },
];

export async function seedCatalog(dataSource: DataSource): Promise<void> {
  const collectionRepository = dataSource.getRepository(Collection);
  const cardRepository = dataSource.getRepository(Card);

  for (const collectionSeed of COLLECTIONS) {
    let collection = await collectionRepository.findOne({
      where: { name: collectionSeed.name },
    });

    if (!collection) {
      collection = await collectionRepository.save(
        collectionRepository.create({ name: collectionSeed.name }),
      );
      console.log(`Collection "${collectionSeed.name}" created.`);
    }

    for (const cardSeed of collectionSeed.cards) {
      const existing = await cardRepository.findOne({
        where: { name: cardSeed.name, collectionId: collection.id },
      });

      if (existing) {
        continue;
      }

      await cardRepository.save(
        cardRepository.create({
          name: cardSeed.name,
          type: cardSeed.type,
          rarity: cardSeed.rarity,
          collectionId: collection.id,
        }),
      );
    }
  }

  console.log(`Seed completed: ${COLLECTIONS.length} collections, catalog cards in place.`);
}
