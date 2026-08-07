import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../entities/player.entity';

export class DailyRewardClaimResponseDto {
  @ApiProperty({ description: 'DotPoints credited by this claim.' })
  credited!: number;

  @ApiProperty({ description: 'Balance after the claim.' })
  balance!: number;

  static fromEntity(player: Player, credited: number): DailyRewardClaimResponseDto {
    const dto = new DailyRewardClaimResponseDto();
    dto.credited = credited;
    dto.balance = player.balance;
    return dto;
  }
}
