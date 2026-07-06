import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * AES-256-GCM field cipher for medical free-text at rest (ADR-P006).
 * Stored format: IV(12) ‖ ciphertext ‖ GCM tag(16). PostgreSQL only ever
 * sees ciphertext. Key from MEDICAL_ENC_KEY (base64, 32 bytes) — never
 * hardcoded; production boot fails without it.
 */
@Injectable()
export class FieldCipherService {
  private readonly logger = new Logger(FieldCipherService.name);
  private readonly key: Buffer;
  readonly keyId: string;

  constructor(config: ConfigService) {
    const encoded = config.get<string>('MEDICAL_ENC_KEY');
    if (!encoded) {
      if (config.get<string>('NODE_ENV') === 'production') {
        throw new Error('MEDICAL_ENC_KEY is required in production (ADR-P006)');
      }
      // Dev-only ephemeral key: encrypted rows become unreadable after a
      // restart — loud warning, never silent.
      this.key = randomBytes(32);
      this.keyId = 'ephemeral-dev';
      this.logger.warn(
        'MEDICAL_ENC_KEY not set — using an EPHEMERAL dev key; encrypted fields will not survive restarts',
      );
      return;
    }
    this.key = Buffer.from(encoded, 'base64');
    if (this.key.length !== 32) {
      throw new Error('MEDICAL_ENC_KEY must decode to exactly 32 bytes');
    }
    this.keyId = config.get<string>('MEDICAL_ENC_KEY_ID') ?? 'k1';
  }

  encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    // Fresh Uint8Array over a plain ArrayBuffer — Prisma 7's Bytes type.
    return new Uint8Array(Buffer.concat([iv, ciphertext, cipher.getAuthTag()]));
  }

  decrypt(data: Uint8Array): string {
    const buf = Buffer.from(data);
    if (buf.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('ciphertext too short');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(buf.length - TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
