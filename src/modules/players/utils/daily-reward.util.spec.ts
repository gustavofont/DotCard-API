import { isDailyRewardAvailable, startOfUtcDay } from './daily-reward.util';

describe('startOfUtcDay', () => {
  it('truncates to UTC midnight', () => {
    const result = startOfUtcDay(new Date('2026-08-08T15:42:07.123Z'));
    expect(result.toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });
});

describe('isDailyRewardAvailable', () => {
  const now = new Date('2026-08-08T15:00:00.000Z');

  it('is available when there is no previous claim', () => {
    expect(isDailyRewardAvailable(null, now)).toBe(true);
  });

  it('is available when the last claim was on a previous UTC day', () => {
    expect(isDailyRewardAvailable(new Date('2026-08-07T23:59:59.999Z'), now)).toBe(true);
  });

  it('is not available when the last claim was already today, UTC', () => {
    expect(isDailyRewardAvailable(new Date('2026-08-08T00:00:00.001Z'), now)).toBe(false);
  });

  it('is not available exactly at today\'s UTC midnight (boundary is inclusive of "today")', () => {
    expect(isDailyRewardAvailable(new Date('2026-08-08T00:00:00.000Z'), now)).toBe(false);
  });

  it('correctly handles skipping many days: still just "available", not cumulative', () => {
    const lastAllowanceAt = new Date('2026-07-01T12:00:00.000Z');
    expect(isDailyRewardAvailable(lastAllowanceAt, now)).toBe(true);
  });
});
