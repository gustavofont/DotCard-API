import { generateFriendCode } from './friend-code.util';

describe('generateFriendCode', () => {
  it('generates an 8-character uppercase alphanumeric code', () => {
    const code = generateFriendCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('never contains ambiguous characters (O, 0, I, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateFriendCode();
      expect(code).not.toMatch(/[O0I1]/);
    }
  });

  it('produces different codes across calls (not deterministic)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateFriendCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
