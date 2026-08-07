import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';

/**
 * Centralized application logger. Wraps Nest's ConsoleLogger so every log line
 * shares one format/context convention and can be swapped for a structured
 * transport (e.g. pino/winston/ELK) later without touching call sites.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService extends ConsoleLogger {
  logGameEvent(event: string, details: Record<string, unknown>): void {
    this.log(`[GAME_EVENT] ${event} ${JSON.stringify(details)}`);
  }

  logGameFailure(event: string, details: Record<string, unknown>): void {
    this.warn(`[GAME_FAILURE] ${event} ${JSON.stringify(details)}`);
  }
}
