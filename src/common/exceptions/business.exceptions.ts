import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export class InsufficientBalanceException extends AppException {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance: required ${required} DotPoints, available ${available}.`,
      HttpStatus.PAYMENT_REQUIRED,
      'INSUFFICIENT_BALANCE',
    );
  }
}

export class DailyRewardAlreadyClaimedException extends AppException {
  constructor() {
    super(
      'Daily reward has already been claimed today.',
      HttpStatus.CONFLICT,
      'DAILY_REWARD_ALREADY_CLAIMED',
    );
  }
}
