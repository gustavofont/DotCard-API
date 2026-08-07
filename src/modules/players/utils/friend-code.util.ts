import { randomInt } from 'node:crypto';

/**
 * Uppercase alphanumeric, excluding characters that are easily confused when
 * typed or read aloud (O/0, I/1) — ESCOPO.md §8. 32 characters, so an 8-char
 * code has 32^8 ≈ 1.1e12 combinations; collisions are handled by the caller
 * via a unique constraint + retry, not relied upon to never happen.
 */
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_LENGTH = 8;

export function generateFriendCode(): string {
  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += FRIEND_CODE_ALPHABET[randomInt(FRIEND_CODE_ALPHABET.length)];
  }
  return code;
}
