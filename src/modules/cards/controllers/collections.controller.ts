import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CollectionResponseDto } from '../dtos/collection-response.dto';
import { CollectionsService } from '../services/collections.service';

@ApiTags('collections')
@ApiBearerAuth()
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List collections' })
  @ApiResponse({ status: 200, type: [CollectionResponseDto] })
  findAll(): Promise<CollectionResponseDto[]> {
    return this.collectionsService.findAll();
  }
}
