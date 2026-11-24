/**
 * `npm run admin:bootstrap -- <email>` (ADR-P049): creates the owner
 * (SUPER_ADMIN) as a 24-hour invite. Run it yourself against the target
 * environment's database with that environment's ADMIN_* variables set. It
 * prints the one-time invite link (and emails it when mail is configured);
 * the link is how you set your password and enroll two-factor. There are no
 * default credentials.
 */
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../app.module';
import { ADMIN_CONFIG, type AdminConfig } from '../admin.config';
import { StaffManagementService } from '../application/staff-management.service';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run admin:bootstrap -- <email>');
    process.exitCode = 2;
    return;
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    if (!app.get<AdminConfig>(ADMIN_CONFIG).enabled) {
      throw new Error(
        'Set ADMIN_SESSION_SECRET, ADMIN_TOTP_ENC_KEY and ADMIN_PUBLIC_URL first',
      );
    }
    const result = await app.get(StaffManagementService).bootstrapOwner(email);
    console.log('Owner invite created (SUPER_ADMIN).');
    console.log(
      result.emailed
        ? 'The invite was emailed. The same link, for your terminal only:'
        : 'Mail is not configured; open this link yourself:',
    );
    console.log(result.inviteUrl);
    console.log(
      `It expires in ${result.expiresInHours} hours and works once. Do not share it.`,
    );
  } catch (error) {
    console.error(
      `Bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
