import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../entities/player.entity';
import { isDailyRewardAvailable } from '../utils/daily-reward.util';

export class PlayerProfileResponseDto {
  @ApiProperty()
  friendCode!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  balance!: number;

  @ApiProperty({ description: 'Whether POST /me/daily-reward/claim would succeed right now.' })
  dailyRewardAvailable!: boolean;

  static fromEntity(player: Player): PlayerProfileResponseDto {
    const dto = new PlayerProfileResponseDto();
    dto.friendCode = player.friendCode;
    dto.displayName = player.displayName;
    dto.balance = player.balance;
    dto.dailyRewardAvailable = isDailyRewardAvailable(player.lastAllowanceAt);
    return dto;
  }
}
