import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionResponseDto } from '../dtos/collection-response.dto';
import { Collection } from '../entities/collection.entity';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection) private readonly collectionRepository: Repository<Collection>,
  ) {}

  async findAll(): Promise<CollectionResponseDto[]> {
    const collections = await this.collectionRepository.find({ order: { name: 'ASC' } });
    return collections.map((collection) => CollectionResponseDto.fromEntity(collection));
  }
}
