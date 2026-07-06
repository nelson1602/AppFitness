import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies the round trip', async () => {
    const hash = await service.hash('correct horse battery staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(
      service.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('never authenticates against a malformed or foreign hash', async () => {
    await expect(service.verify('not-a-phc-hash', 'anything')).resolves.toBe(
      false,
    );
    // bcrypt hash from the legacy MVP era — must not verify (until an
    // explicit rehash-on-login path is built for migrated users).
    await expect(
      service.verify('$2a$12$abcdefghijklmnopqrstuv', 'anything'),
    ).resolves.toBe(false);
  });
});
