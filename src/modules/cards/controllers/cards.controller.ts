import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CardType } from '../../../common/enums/card-type.enum';
import { CardResponseDto } from '../dtos/card-response.dto';
import { CreateCardDto } from '../dtos/create-card.dto';
import { PaginatedCardsQueryDto } from '../dtos/paginated-cards-query.dto';
import { UpdateCardDto } from '../dtos/update-card.dto';
import { CardsService } from '../services/cards.service';

@ApiTags('cards')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  @ApiOperation({ summary: 'List cards (paginated, filterable by collection/rarity/type)' })
  @ApiResponse({ status: 200, description: 'Paginated list of cards.' })
  findAll(@Query() query: PaginatedCardsQueryDto) {
    return this.cardsService.findAll(query);
  }

  @Get('types')
  @ApiOperation({ summary: 'List the valid card types' })
  @ApiResponse({ status: 200, type: [String] })
  findTypes(): CardType[] {
    return Object.values(CardType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a card by id' })
  @ApiResponse({ status: 200, type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CardResponseDto> {
    return this.cardsService.findById(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a card' })
  @ApiResponse({ status: 201, type: CardResponseDto })
  @ApiResponse({ status: 422, description: 'Referenced collection does not exist.' })
  create(@Body() dto: CreateCardDto): Promise<CardResponseDto> {
    return this.cardsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a card' })
  @ApiResponse({ status: 200, type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCardDto,
  ): Promise<CardResponseDto> {
    return this.cardsService.update(id, dto);
  }

  @Post(':id/image')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Upload a card's image (field name: image)" })
  @ApiResponse({ status: 201, type: CardResponseDto })
  @ApiResponse({ status: 400, description: 'Missing file or unsupported image type.' })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CardResponseDto> {
    return this.cardsService.uploadImage(id, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete a card' })
  @ApiResponse({ status: 204, description: 'Card deleted.' })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.cardsService.softDelete(id);
  }
}
