import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import * as argon2 from 'argon2';

/**
 * Argon2id password hashing (.ai/05_SECURITY.md — never bcrypt for new
 * hashes). Hashes are PHC strings, so a future bcrypt→argon2
 * rehash-on-login path for migrated MVP users needs no schema change:
 * verify() can dispatch on the "$argon2"/"$2" prefix when that arrives.
 */
@Injectable()
export class PasswordService {
  /**
   * ADR-P046: a real Argon2id hash of a random value, made once with the same
   * parameters as every user hash. Verifying against it for an unknown email
   * costs the same time as a wrong password, so timing does not reveal which
   * addresses have accounts.
   */
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false; // malformed/foreign hash never authenticates
    }
  }

  /** Spends one real Argon2 verification and always returns false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('base64url'));
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
