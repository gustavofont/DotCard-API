import { ApiProperty } from '@nestjs/swagger';
import { CardType } from '../../../common/enums/card-type.enum';
import { Rarity } from '../../../common/enums/rarity.enum';
import { Card } from '../entities/card.entity';

export class CardResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: CardType })
  type!: CardType;

  @ApiProperty({ enum: Rarity })
  rarity!: Rarity;

  @ApiProperty()
  collectionId!: number;

  @ApiProperty({
    nullable: true,
    description:
      'Full public URL, built from image_key + STORAGE_PUBLIC_URL — never the raw storage key.',
  })
  imageUrl!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(card: Card, storagePublicUrl: string, bucket: string): CardResponseDto {
    const dto = new CardResponseDto();
    dto.id = card.id;
    dto.name = card.name;
    dto.type = card.type;
    dto.rarity = card.rarity;
    dto.collectionId = card.collectionId;
    dto.imageUrl = card.imageKey ? `${storagePublicUrl}/${bucket}/${card.imageKey}` : null;
    dto.createdAt = card.createdAt;
    dto.updatedAt = card.updatedAt;
    return dto;
  }
}
