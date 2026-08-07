import { ApiProperty } from '@nestjs/swagger';
import { Collection } from '../entities/collection.entity';

export class CollectionResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(collection: Collection): CollectionResponseDto {
    const dto = new CollectionResponseDto();
    dto.id = collection.id;
    dto.name = collection.name;
    dto.createdAt = collection.createdAt;
    dto.updatedAt = collection.updatedAt;
    return dto;
  }
}
