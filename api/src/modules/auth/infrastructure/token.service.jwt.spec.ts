import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

import { JWT_AUDIENCE, JWT_ISSUER, TokenService } from './token.service';

/**
 * ADR-P046: access tokens are HS256 only, with a fixed issuer and audience,
 * and carry the account's token version. Signed and verified with the real
 * JwtService, so the pinning is proven end to end, not assumed.
 */
const SECRET = 'a-test-secret-that-is-at-least-32-bytes-long';
const USER = '00000000-0000-4000-8000-00000000aaaa';

function service(): { tokens: TokenService; jwt: JwtService } {
  const jwt = new JwtService({ secret: SECRET });
  return {
    jwt,
    tokens: new TokenService(jwt, {
      get: () => undefined,
    } as unknown as ConfigService),
  };
}

describe('TokenService access tokens (ADR-P046)', () => {
  it('signs HS256 with issuer, audience and the token version, and verifies it', async () => {
    const { tokens, jwt } = service();
    const token = await tokens.signAccessToken(USER, Role.USER, 4);

    const header = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString(),
    ) as { alg: string };
    expect(header.alg).toBe('HS256');
    expect(jwt.decode(token)).toMatchObject({
      sub: USER,
      role: Role.USER,
      tv: 4,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    });
    await expect(tokens.verifyAccessToken(token)).resolves.toMatchObject({
      sub: USER,
      tv: 4,
    });
  });

  it('rejects a token for another issuer or audience', async () => {
    const { tokens, jwt } = service();
    const foreignIssuer = await jwt.signAsync(
      { sub: USER, role: Role.USER, tv: 0 },
      { issuer: 'someone-else', audience: JWT_AUDIENCE },
    );
    const foreignAudience = await jwt.signAsync(
      { sub: USER, role: Role.USER, tv: 0 },
      { issuer: JWT_ISSUER, audience: 'another-app' },
    );
    const neither = await jwt.signAsync({ sub: USER, role: Role.USER, tv: 0 });

    await expect(tokens.verifyAccessToken(foreignIssuer)).rejects.toThrow();
    await expect(tokens.verifyAccessToken(foreignAudience)).rejects.toThrow();
    await expect(tokens.verifyAccessToken(neither)).rejects.toThrow();
  });

  it('rejects any algorithm but HS256, including "none"', async () => {
    const { tokens, jwt } = service();
    const hs512 = await jwt.signAsync(
      { sub: USER, role: Role.USER, tv: 0 },
      { algorithm: 'HS512', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    const body = Buffer.from(
      JSON.stringify({
        sub: USER,
        role: Role.USER,
        tv: 0,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
      }),
    ).toString('base64url');
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${body}.`;

    await expect(tokens.verifyAccessToken(hs512)).rejects.toThrow();
    await expect(tokens.verifyAccessToken(none)).rejects.toThrow();
  });
});
