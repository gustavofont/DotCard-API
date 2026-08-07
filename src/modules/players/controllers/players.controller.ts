import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import { DailyRewardClaimResponseDto } from '../dtos/daily-reward-claim-response.dto';
import { PlayerProfileResponseDto } from '../dtos/player-profile-response.dto';
import { PlayersService } from '../services/players.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({
    summary: 'Current player profile: balance, friend_code, name, daily reward state',
  })
  @ApiResponse({ status: 200, type: PlayerProfileResponseDto })
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<PlayerProfileResponseDto> {
    const player = await this.playersService.ensurePlayer(user.id, user.name);
    return PlayerProfileResponseDto.fromEntity(player);
  }

  @Post('daily-reward/claim')
  @ApiOperation({ summary: 'Claim the daily DotPoints reward (once per UTC calendar day)' })
  @ApiResponse({ status: 201, type: DailyRewardClaimResponseDto })
  @ApiResponse({ status: 409, description: 'Already claimed today.' })
  async claimDailyReward(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyRewardClaimResponseDto> {
    await this.playersService.ensurePlayer(user.id, user.name);
    const { player, credited } = await this.playersService.claimDailyReward(user.id);
    return DailyRewardClaimResponseDto.fromEntity(player, credited);
  }

  @Post('friend-code/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the friend code, invalidating the previous one' })
  @ApiResponse({ status: 200, type: PlayerProfileResponseDto })
  async rotateFriendCode(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlayerProfileResponseDto> {
    await this.playersService.ensurePlayer(user.id, user.name);
    const player = await this.playersService.rotateFriendCode(user.id);
    return PlayerProfileResponseDto.fromEntity(player);
  }
}
