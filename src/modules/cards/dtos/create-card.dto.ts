import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CardType } from '../../../common/enums/card-type.enum';
import { Rarity } from '../../../common/enums/rarity.enum';

export class CreateCardDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: CardType })
  @IsEnum(CardType)
  type!: CardType;

  @ApiProperty({ enum: Rarity })
  @IsEnum(Rarity)
  rarity!: Rarity;

  @ApiProperty()
  @IsInt()
  collectionId!: number;

  @ApiPropertyOptional({
    description:
      'Storage object key, not a URL. Usually set via the image upload endpoint instead.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageKey?: string;
}
