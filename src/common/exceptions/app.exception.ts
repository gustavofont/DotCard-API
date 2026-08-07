import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    public readonly errorCode: string,
  ) {
    super({ message, errorCode }, status);
  }
}
