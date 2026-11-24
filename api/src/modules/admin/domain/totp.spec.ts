import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totpStep,
  verifyTotp,
} from './totp';

// RFC 6238 Appendix B, SHA-1 seed "12345678901234567890" (8-digit codes there;
// these are the same values truncated to 6 digits by the modulus).
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_BASE32 = base32Encode(RFC_SECRET);

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches the RFC vector at T=%i', (seconds, code) => {
    expect(hotp(RFC_SECRET, totpStep(seconds * 1000))).toBe(code);
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 9]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it('accepts the current step and one either side, nothing further', () => {
    const now = 1234567890 * 1000;
    const step = totpStep(now);
    const code = (delta: number) => hotp(RFC_SECRET, step + delta);
    expect(verifyTotp(RFC_BASE32, code(0), now, null)).toBe(step);
    expect(verifyTotp(RFC_BASE32, code(-1), now, null)).toBe(step - 1);
    expect(verifyTotp(RFC_BASE32, code(1), now, null)).toBe(step + 1);
    expect(verifyTotp(RFC_BASE32, code(2), now, null)).toBeNull();
    expect(verifyTotp(RFC_BASE32, code(-2), now, null)).toBeNull();
  });

  it('refuses a code whose step was already used (replay)', () => {
    const now = 1234567890 * 1000;
    const step = totpStep(now);
    const code = hotp(RFC_SECRET, step);
    expect(verifyTotp(RFC_BASE32, code, now, step)).toBeNull();
    expect(verifyTotp(RFC_BASE32, code, now, step - 1)).toBe(step);
  });

  it.each(['', '12345', '1234567', 'abcdef', '12 456'])(
    'refuses malformed code %p',
    (code) => {
      expect(verifyTotp(RFC_BASE32, code, Date.now(), null)).toBeNull();
    },
  );

  it('builds an otpauth URI authenticator apps import', () => {
    expect(otpauthUri('ABC', 'ana@example.test')).toBe(
      'otpauth://totp/AppFitnessRD%20Admin%3Aana%40example.test?secret=ABC&issuer=AppFitnessRD%20Admin&algorithm=SHA1&digits=6&period=30',
    );
  });
});
