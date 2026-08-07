import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { AppConfig } from '../../../config/configuration';
import { StorageService } from '../../storage/storage.service';
import { CardResponseDto } from '../dtos/card-response.dto';
import { CreateCardDto } from '../dtos/create-card.dto';
import { PaginatedCardsQueryDto } from '../dtos/paginated-cards-query.dto';
import { UpdateCardDto } from '../dtos/update-card.dto';
import { Card } from '../entities/card.entity';
import { Collection } from '../entities/collection.entity';

const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

@Injectable()
export class CardsService {
  constructor(
    @InjectRepository(Card) private readonly cardRepository: Repository<Card>,
    @InjectRepository(Collection) private readonly collectionRepository: Repository<Collection>,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly storageService: StorageService,
  ) {
    this.storage = this.configService.get('storage', { infer: true });
  }

  private readonly storage: AppConfig['storage'];

  async findAll(query: PaginatedCardsQueryDto): Promise<PaginatedResult<CardResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [cards, total] = await this.cardRepository.findAndCount({
      where: {
        ...(query.collectionId ? { collectionId: query.collectionId } : {}),
        ...(query.rarity ? { rarity: query.rarity } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: cards.map((card) => this.toResponseDto(card)),
      total,
      page,
      limit,
    };
  }

  async findById(id: number): Promise<CardResponseDto> {
    const card = await this.cardRepository.findOne({ where: { id } });
    if (!card) {
      throw new NotFoundException(`Card ${id} not found.`);
    }
    return this.toResponseDto(card);
  }

  async create(dto: CreateCardDto): Promise<CardResponseDto> {
    await this.assertCollectionExists(dto.collectionId);

    const card = await this.cardRepository.save(
      this.cardRepository.create({
        name: dto.name,
        type: dto.type,
        rarity: dto.rarity,
        collectionId: dto.collectionId,
        imageKey: dto.imageKey ?? null,
      }),
    );
    return this.toResponseDto(card);
  }

  async update(id: number, dto: UpdateCardDto): Promise<CardResponseDto> {
    const card = await this.cardRepository.findOne({ where: { id } });
    if (!card) {
      throw new NotFoundException(`Card ${id} not found.`);
    }

    if (dto.collectionId !== undefined) {
      await this.assertCollectionExists(dto.collectionId);
      card.collectionId = dto.collectionId;
    }
    if (dto.name !== undefined) {
      card.name = dto.name;
    }
    if (dto.type !== undefined) {
      card.type = dto.type;
    }
    if (dto.rarity !== undefined) {
      card.rarity = dto.rarity;
    }
    if (dto.imageKey !== undefined) {
      card.imageKey = dto.imageKey;
    }

    const updated = await this.cardRepository.save(card);
    return this.toResponseDto(updated);
  }

  async uploadImage(id: number, file: Express.Multer.File | undefined): Promise<CardResponseDto> {
    const card = await this.cardRepository.findOne({ where: { id } });
    if (!card) {
      throw new NotFoundException(`Card ${id} not found.`);
    }
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const extension = ALLOWED_IMAGE_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${Object.keys(ALLOWED_IMAGE_MIME_TYPES).join(', ')}.`,
      );
    }

    const key = `cards/${randomUUID()}.${extension}`;
    await this.storageService.uploadObject(key, file.buffer, file.mimetype);

    card.imageKey = key;
    const updated = await this.cardRepository.save(card);
    return this.toResponseDto(updated);
  }

  async softDelete(id: number): Promise<void> {
    const card = await this.cardRepository.findOne({ where: { id } });
    if (!card) {
      throw new NotFoundException(`Card ${id} not found.`);
    }
    await this.cardRepository.softDelete(id);
  }

  private async assertCollectionExists(collectionId: number): Promise<void> {
    const exists = await this.collectionRepository.exists({ where: { id: collectionId } });
    if (!exists) {
      throw new UnprocessableEntityException(`Collection ${collectionId} does not exist.`);
    }
  }

  private toResponseDto(card: Card): CardResponseDto {
    return CardResponseDto.fromEntity(card, this.storage.publicUrl, this.storage.bucket);
  }
}
