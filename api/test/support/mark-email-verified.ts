import type { PrismaService } from '../../src/modules/database/prisma.service';

/**
 * Marks a freshly registered e2e account as verified.
 *
 * Since ADR-P041 every authenticated route outside the verification flow
 * answers `403 EMAIL_NOT_VERIFIED` for an unverified account. Specs that are
 * not about verification use this to reach the behaviour they test; the
 * verification flow itself is covered end to end, through the emailed token,
 * in `email-verification.e2e-spec.ts`.
 */
export async function markEmailVerified(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
}
