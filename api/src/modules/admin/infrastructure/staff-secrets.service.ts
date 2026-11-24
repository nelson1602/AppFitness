import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ADMIN_CONFIG, type AdminConfig } from '../admin.config';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Backoffice secrets (ADR-P049):
 * - Opaque session and invite tokens: 32 random bytes, base64url. Only an
 *   HMAC-SHA256 keyed with ADMIN_SESSION_SECRET is stored, so a copy of the
 *   database alone cannot be turned into a working session.
 * - TOTP secrets: AES-256-GCM with ADMIN_TOTP_ENC_KEY, stored IV ‖ ct ‖ tag.
 *
 * Only built when the backoffice is enabled (the guard and middleware answer
 * 503 before any of this runs when it is not).
 */
@Injectable()
export class StaffSecretsService {
  constructor(@Inject(ADMIN_CONFIG) private readonly config: AdminConfig) {}

  private get enabled() {
    if (!this.config.enabled) {
      throw new Error('Backoffice is not configured');
    }
    return this.config;
  }

  newToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  hashToken(raw: string): string {
    return createHmac('sha256', this.enabled.sessionSecret)
      .update(raw)
      .digest('hex');
  }

  encryptTotpSecret(secretBase32: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.enabled.totpKey, iv);
    const body = Buffer.concat([
      cipher.update(secretBase32, 'utf8'),
      cipher.final(),
    ]);
    return new Uint8Array(Buffer.concat([iv, body, cipher.getAuthTag()]));
  }

  decryptTotpSecret(stored: Uint8Array): string {
    const buffer = Buffer.from(stored);
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(buffer.length - TAG_LENGTH);
    const body = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.enabled.totpKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      'utf8',
    );
  }
}
