import { ConfigService } from '@nestjs/config';

import { FieldCipherService } from './field-cipher.service';

const KEY_B64 = Buffer.alloc(32, 7).toString('base64');

function makeService(env: Record<string, string>): FieldCipherService {
  const config = {
    get: (key: string): string | undefined => env[key],
  } as unknown as ConfigService;
  return new FieldCipherService(config);
}

describe('FieldCipherService', () => {
  const service = makeService({
    MEDICAL_ENC_KEY: KEY_B64,
    MEDICAL_ENC_KEY_ID: 'test-1',
  });

  it('round-trips utf8 plaintext and never stores it verbatim', () => {
    const secret = 'Paciente con lesión de rodilla — no sentadillas 🏥';
    const encrypted = service.encrypt(secret);

    expect(encrypted.length).toBeGreaterThan(12 + 16);
    expect(Buffer.from(encrypted).toString('utf8')).not.toContain('rodilla');
    expect(service.decrypt(encrypted)).toBe(secret);
    expect(service.keyId).toBe('test-1');
  });

  it('produces a distinct IV per encryption (same plaintext, different ciphertext)', () => {
    const a = service.encrypt('same text');
    const b = service.encrypt('same text');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects tampered ciphertext (GCM auth)', () => {
    const encrypted = service.encrypt('integrity matters');
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => service.decrypt(encrypted)).toThrow();
  });

  it('rejects data encrypted with a different key', () => {
    const other = makeService({
      MEDICAL_ENC_KEY: Buffer.alloc(32, 9).toString('base64'),
    });
    const foreign = other.encrypt('foreign');
    expect(() => service.decrypt(foreign)).toThrow();
  });

  it('requires the key in production and validates its length', () => {
    expect(() => makeService({ NODE_ENV: 'production' })).toThrow(
      'MEDICAL_ENC_KEY',
    );
    expect(() =>
      makeService({ MEDICAL_ENC_KEY: Buffer.alloc(16, 1).toString('base64') }),
    ).toThrow('32 bytes');
  });
});
