import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { CardsController } from './controllers/cards.controller';
import { CollectionsController } from './controllers/collections.controller';
import { Card } from './entities/card.entity';
import { Collection } from './entities/collection.entity';
import { CardsService } from './services/cards.service';
import { CollectionsService } from './services/collections.service';

@Module({
  imports: [TypeOrmModule.forFeature([Card, Collection]), StorageModule],
  controllers: [CardsController, CollectionsController],
  providers: [CardsService, CollectionsService],
  exports: [CardsService, CollectionsService],
})
export class CardsModule {}
