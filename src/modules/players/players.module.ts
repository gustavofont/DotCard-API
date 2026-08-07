import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersController } from './controllers/players.controller';
import { BalanceTransaction } from './entities/balance-transaction.entity';
import { Player } from './entities/player.entity';
import { PlayersService } from './services/players.service';
import { WalletService } from './services/wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Player, BalanceTransaction])],
  controllers: [PlayersController],
  providers: [PlayersService, WalletService],
  exports: [PlayersService, WalletService],
})
export class PlayersModule {}
