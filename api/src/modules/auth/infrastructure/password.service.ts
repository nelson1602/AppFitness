import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Argon2id password hashing (.ai/05_SECURITY.md — never bcrypt for new
 * hashes). Hashes are PHC strings, so a future bcrypt→argon2
 * rehash-on-login path for migrated MVP users needs no schema change:
 * verify() can dispatch on the "$argon2"/"$2" prefix when that arrives.
 */
@Injectable()
export class PasswordService {
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
}
