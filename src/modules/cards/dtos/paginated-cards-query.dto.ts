import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CardType } from '../../../common/enums/card-type.enum';
import { Rarity } from '../../../common/enums/rarity.enum';

export class PaginatedCardsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  collectionId?: number;

  @ApiPropertyOptional({ enum: Rarity })
  @IsOptional()
  @IsEnum(Rarity)
  rarity?: Rarity;

  @ApiPropertyOptional({ enum: CardType })
  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;
}
