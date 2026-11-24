import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { MAIL_CONFIG } from './../src/config/mail.config';
import { StaffManagementService } from './../src/modules/admin/application/staff-management.service';
import { STAFF_PERMISSIONS } from './../src/modules/admin/domain/permissions';
import {
  base32Decode,
  hotp,
  totpStep,
} from './../src/modules/admin/domain/totp';
import { LoginThrottleService } from './../src/modules/auth/application/login-throttle.service';
import { PrismaService } from './../src/modules/database/prisma.service';
import { MAIL_TRANSPORT } from './../src/modules/mail/domain/mail.types';
import { FakeMailTransport } from './../src/modules/mail/infrastructure/fake.transport';
import { markEmailVerified } from './support/mark-email-verified';

/**
 * ADR-P049 staff backoffice, end to end against a real PostgreSQL database:
 * 503 when unconfigured, two-step sign-in, CSRF, permission checks (403), the
 * immutable owner, every support action with its audit entry, instant staff
 * disable, the append-only trail, and proof that no health data is returned.
 * CI sends no email: MAIL_TRANSPORT is a FakeMailTransport.
 */

const ADMIN_ENV = {
  ADMIN_SESSION_SECRET: 'e2e-only-admin-session-secret-0000000000001',
  ADMIN_TOTP_ENC_KEY: Buffer.alloc(32, 9).toString('base64'),
  ADMIN_PUBLIC_URL: 'https://api.example.test/admin',
};
const CSRF = { 'X-Admin-CSRF': '1' };
const PASSWORD = 'staff-e2e-passphrase-1';

let ipCounter = 0;
/** A fresh client address per sign-in, so the per-IP throttle never trips. */
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

function inviteToken(url: string): string {
  const match = /#\/invitacion\?token=([A-Za-z0-9_-]+)/.exec(url);
  if (!match) throw new Error(`No invite token in ${url}`);
  return match[1];
}

/** The code for the earliest step after `lastStep` (no replay), within ±1. */
function nextCode(
  secret: string,
  lastStep: number | null,
): {
  code: string;
  step: number;
} {
  const step = Math.max(totpStep(Date.now()), (lastStep ?? -1) + 1);
  return { code: hotp(base32Decode(secret), step), step };
}

function cookieOf(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as string[];
  return header[0].split(';')[0];
}

describe('Staff backoffice — unconfigured (e2e)', () => {
  it('answers 503 on every /admin/api route when no secret is set', async () => {
    const saved = { ...process.env };
    for (const key of Object.keys(ADMIN_ENV)) delete process.env[key];
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleFixture.createNestApplication<INestApplication<App>>();
    await app.init();
    const server = app.getHttpServer();
    try {
      await request(server).get('/admin/api/auth/me').expect(503);
      await request(server)
        .post('/admin/api/auth/login')
        .set(CSRF)
        .send({ email: 'a@example.test', password: 'x' })
        .expect(503);
    } finally {
      await app.close();
      process.env = saved;
    }
  });
});

describe('Staff backoffice (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: FakeMailTransport;
  let http: App;
  const saved = { ...process.env };
  const suffix = `${Date.now()}`;

  // Filled as the suite goes.
  const owner = { email: `owner-${suffix}@staff.example.test`, cookie: '' };
  const support = {
    email: `support-${suffix}@staff.example.test`,
    id: '',
    cookie: '',
  };
  let ownerId = '';
  let supportRoleId = '';

  async function enroll(token: string) {
    const accepted = await request(http)
      .post('/admin/api/invites/accept')
      .set(CSRF)
      .send({ token, password: PASSWORD })
      .expect(200);
    const secret = (accepted.body as { totpSecret: string }).totpSecret;
    const first = nextCode(secret, null);
    await request(http)
      .post('/admin/api/invites/confirm')
      .set(CSRF)
      .send({ token, code: first.code })
      .expect(204);
    return { secret, lastStep: first.step };
  }

  async function signIn(email: string, secret: string, lastStep: number) {
    const ip = nextIp();
    const login = await request(http)
      .post('/admin/api/auth/login')
      .set(CSRF)
      .set('X-Forwarded-For', ip)
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(login.body).toEqual({ stage: 'mfa' });
    const pending = cookieOf(login);

    // A password alone is not a session: blocked without the second factor.
    await request(http)
      .get('/admin/api/auth/me')
      .set('Cookie', pending)
      .expect(401);

    const { code } = nextCode(secret, lastStep);
    const verified = await request(http)
      .post('/admin/api/auth/totp')
      .set(CSRF)
      .set('X-Forwarded-For', ip)
      .set('Cookie', pending)
      .send({ code })
      .expect(200);
    return { cookie: cookieOf(verified), me: verified.body as { id: string } };
  }

  async function registerUser(tag: string) {
    const email = `e2e-adm-${tag}-${suffix}@appfitness.local`;
    const response = await request(http)
      .post('/auth/register')
      .set('X-Forwarded-For', nextIp())
      .send({
        email,
        username: `adm${tag}${suffix}`,
        password: 'Disposable-pw-12345',
      })
      .expect(201);
    const body = response.body as {
      accessToken: string;
      user: { id: string };
    };
    return { email, id: body.user.id, accessToken: body.accessToken };
  }

  beforeAll(async () => {
    Object.assign(process.env, ADMIN_ENV, {
      RAILWAY_ENVIRONMENT_ID: 'e2e-admin-backoffice',
    });
    mail = new FakeMailTransport();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_CONFIG)
      .useValue({
        provider: 'postmark',
        serverToken: 'e2e-not-a-real-token',
        fromAddress: 'no-reply@mail.example.test',
        messageStream: 'outbound',
        publicBaseUrl: 'https://app.example.test',
        verificationBaseUrl: 'https://account.example.test',
      })
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(mail)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    process.env = saved;
  });

  it('bootstraps the owner as an invite, and the owner signs in with two steps', async () => {
    const boot = await app
      .get(StaffManagementService)
      .bootstrapOwner(owner.email);
    expect(boot.emailed).toBe(true);
    const token = inviteToken(boot.inviteUrl);

    await request(http)
      .post('/admin/api/invites/inspect')
      .set(CSRF)
      .send({ token })
      .expect(200, { email: owner.email });

    const { secret, lastStep } = await enroll(token);
    // The invite works once.
    await request(http)
      .post('/admin/api/invites/inspect')
      .set(CSRF)
      .send({ token })
      .expect(400);

    const session = await signIn(owner.email, secret, lastStep);
    owner.cookie = session.cookie;
    ownerId = session.me.id;

    const me = await request(http)
      .get('/admin/api/auth/me')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(me.body).toMatchObject({
      email: owner.email,
      role: { key: 'SUPER_ADMIN', isSystem: true },
    });
    expect([...(me.body as { permissions: string[] }).permissions]).toEqual(
      [...STAFF_PERMISSIONS].sort(),
    );

    // A second bootstrap is refused once the owner is active.
    await expect(
      app.get(StaffManagementService).bootstrapOwner(owner.email),
    ).rejects.toThrow(/already exists/);
  });

  it('audits a failed sign-in and answers the same for any failure', async () => {
    await request(http)
      .post('/admin/api/auth/login')
      .set(CSRF)
      .set('X-Forwarded-For', nextIp())
      .send({ email: owner.email, password: 'wrong-password-123' })
      .expect(401);
    await request(http)
      .post('/admin/api/auth/login')
      .set(CSRF)
      .set('X-Forwarded-For', nextIp())
      .send({ email: `nobody-${suffix}@x.test`, password: PASSWORD })
      .expect(401);
    const failures = await prisma.staffAuditLog.count({
      where: { action: 'auth.login_failed', staffId: ownerId },
    });
    expect(failures).toBeGreaterThanOrEqual(1);
    // Reset the owner's counter so later sign-ins are unaffected.
    await app.get(LoginThrottleService).recordSuccess(`staff:${owner.email}`);
  });

  it('refuses a state-changing request without the CSRF header', async () => {
    await request(http)
      .post('/admin/api/auth/logout')
      .set('Cookie', owner.cookie)
      .expect(403);
  });

  it('keeps staff and role management for the owner only', async () => {
    await request(http)
      .post('/admin/api/roles')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({ name: `Mala ${suffix}`, permissions: ['staff.manage'] })
      .expect(403);

    const role = await request(http)
      .post('/admin/api/roles')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({
        name: `Soporte ${suffix}`,
        permissions: ['users.read', 'users.support'],
      })
      .expect(201);
    supportRoleId = (role.body as { id: string }).id;

    // The database refuses it too, whatever the code does.
    await expect(
      prisma.staffRolePermission.create({
        data: { roleId: supportRoleId, permissionKey: 'roles.manage' },
      }),
    ).rejects.toThrow();

    // System roles cannot be assigned.
    await request(http)
      .post('/admin/api/staff')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({
        email: `x-${suffix}@staff.example.test`,
        roleId: '00000000-0000-4000-8000-000000000001',
      })
      .expect(403);
  });

  it('invites a support member by email, who then signs in', async () => {
    const created = await request(http)
      .post('/admin/api/staff')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({ email: support.email, roleId: supportRoleId })
      .expect(201);
    support.id = (created.body as { id: string }).id;
    const invite = mail.sent.filter((m) => m.to === support.email).at(-1)!;
    expect(invite.templateId).toBe('staff-invite');

    const { secret, lastStep } = await enroll(inviteToken(invite.textBody));
    const session = await signIn(support.email, secret, lastStep);
    support.cookie = session.cookie;
  });

  it('answers 403 for every route outside the support role', async () => {
    const forbidden: [string, string][] = [
      ['get', '/admin/api/staff'],
      ['get', '/admin/api/roles'],
      ['get', '/admin/api/audit'],
      ['get', '/admin/api/metrics/dashboard'],
      ['post', `/admin/api/users/${randomUUID()}/suspend`],
      ['post', `/admin/api/users/${randomUUID()}/delete`],
    ];
    for (const [method, path] of forbidden) {
      const call =
        method === 'get'
          ? request(http).get(path)
          : request(http).post(path).set(CSRF).send({ confirmEmail: 'x' });
      await call.set('Cookie', support.cookie).expect(403);
    }
    await request(http)
      .get('/admin/api/users')
      .set('Cookie', support.cookie)
      .expect(200);
  });

  it('never lets anyone change, demote, disable or delete the owner', async () => {
    await request(http)
      .patch(`/admin/api/staff/${ownerId}`)
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({ roleId: supportRoleId })
      .expect(403);
    await request(http)
      .post(`/admin/api/staff/${ownerId}/disable`)
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .expect(403);
    await request(http)
      .delete('/admin/api/roles/00000000-0000-4000-8000-000000000001')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .expect(403);

    // Database triggers hold the same line.
    await expect(
      prisma.staffUser.update({
        where: { id: ownerId },
        data: { status: 'DISABLED' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.staffUser.update({
        where: { id: ownerId },
        data: { roleId: supportRoleId },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.staffUser.delete({ where: { id: ownerId } }),
    ).rejects.toThrow();
    await expect(
      prisma.staffRolePermission.deleteMany({
        where: { roleId: '00000000-0000-4000-8000-000000000001' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.staffUser.update({
        where: { id: support.id },
        data: { roleId: '00000000-0000-4000-8000-000000000001' },
      }),
    ).rejects.toThrow();
  });

  it('returns account and support fields only — never health data', async () => {
    const user = await registerUser('health');
    await markEmailVerified(prisma, user.id);
    await request(http)
      .put('/users/me/profile')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        heightCm: 187.3,
        fitnessLevel: 'INTERMEDIATE',
        activityLevel: 'MODERATE',
      })
      .expect(200);
    await prisma.bodyWeight.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        weightKg: 93.7,
        date: new Date('2026-11-01'),
        notes: 'nota-privada-de-salud',
      },
    });

    const detail = await request(http)
      .get(`/admin/api/users/${user.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(Object.keys(detail.body as object).sort()).toEqual(
      [
        'createdAt',
        'deviceCount',
        'devices',
        'email',
        'emailVerified',
        'id',
        'isPro',
        'lastLoginAt',
        'lastSyncAt',
        'recentFailedSyncOps',
        'status',
        'throttle',
        'username',
      ].sort(),
    );
    const list = await request(http)
      .get('/admin/api/users')
      .query({ q: user.email })
      .set('Cookie', owner.cookie)
      .expect(200);
    for (const body of [detail.body, list.body]) {
      const text = JSON.stringify(body);
      for (const leak of [
        '187.3',
        '93.7',
        'nota-privada-de-salud',
        'INTERMEDIATE',
        'MODERATE',
        'heightCm',
        'weightKg',
        'profile',
        'goal',
        'passwordHash',
        'tokenVersion',
      ]) {
        expect(text).not.toContain(leak);
      }
    }
    expect(
      (list.body as { items: { id: string }[] }).items.map((u) => u.id),
    ).toEqual([user.id]);
  });

  it('runs every support action, each with its audit entry', async () => {
    const user = await registerUser('support');
    const auth = () => ({ Authorization: `Bearer ${user.accessToken}` });
    const act = (path: string, status: number, body?: object) =>
      request(http)
        .post(`/admin/api/users/${user.id}/${path}`)
        .set(CSRF)
        .set('Cookie', support.cookie)
        .send(body ?? {})
        .expect(status);

    // Resend verification (the account is unverified).
    await act('resend-verification', 202);
    expect(
      mail.sent.some(
        (m) => m.to === user.email && m.templateId === 'email-verification',
      ),
    ).toBe(true);

    // Password reset is an email the person acts on; staff never see it.
    await act('send-password-reset', 202);
    expect(
      mail.sent.some(
        (m) => m.to === user.email && m.templateId === 'password-reset',
      ),
    ).toBe(true);

    // Throttle: a locked account shows up in detail, and staff clear it.
    const throttle = app.get(LoginThrottleService);
    for (let i = 0; i < 5; i += 1) await throttle.recordFailure(user.email);
    const locked = await request(http)
      .get(`/admin/api/users/${user.id}`)
      .set('Cookie', support.cookie)
      .expect(200);
    expect(
      (locked.body as { throttle: { failures: number } }).throttle,
    ).toMatchObject({ failures: 5 });
    await act('clear-throttle', 204);
    const cleared = await request(http)
      .get(`/admin/api/users/${user.id}`)
      .set('Cookie', support.cookie)
      .expect(200);
    expect((cleared.body as { throttle: unknown }).throttle).toBeNull();

    // Log out everywhere: the person's access token stops working at once.
    await markEmailVerified(prisma, user.id);
    await request(http).get('/auth/me').set(auth()).expect(200);
    await act('logout-everywhere', 204);
    await request(http).get('/auth/me').set(auth()).expect(401);

    // Suspend and reactivate need users.suspend: the owner does them.
    const ownerAct = (path: string, status: number, body?: object) =>
      request(http)
        .post(`/admin/api/users/${user.id}/${path}`)
        .set(CSRF)
        .set('Cookie', owner.cookie)
        .send(body ?? {})
        .expect(status);
    await ownerAct('suspend', 204);
    expect(
      (await prisma.user.findUnique({ where: { id: user.id } }))?.status,
    ).toBe('SUSPENDED');
    await ownerAct('reactivate', 204);
    expect(
      (await prisma.user.findUnique({ where: { id: user.id } }))?.status,
    ).toBe('ACTIVE');

    // Delete: refused unless the exact email is typed; then permanent.
    await ownerAct('delete', 400, { confirmEmail: 'someone@else.test' });
    await ownerAct('delete', 204, { confirmEmail: user.email.toUpperCase() });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();

    const trail = await request(http)
      .get('/admin/api/audit')
      .query({ targetId: user.id, pageSize: 50 })
      .set('Cookie', owner.cookie)
      .expect(200);
    const actions = (
      trail.body as { items: { action: string; staffId: string }[] }
    ).items.map((entry) => entry.action);
    expect(actions.sort()).toEqual(
      [
        'user.clear_throttle',
        'user.delete',
        'user.logout_everywhere',
        'user.reactivate',
        'user.resend_verification',
        'user.send_password_reset',
        'user.suspend',
      ].sort(),
    );
    const rows = await prisma.staffAuditLog.findMany({
      where: { targetId: user.id },
    });
    expect(rows.every((row) => row.ip === row.ip?.slice(0, 64))).toBe(true);
    // The trail never stores the deleted person's address.
    expect(JSON.stringify(rows)).not.toContain(user.email);
  });

  it('shows the dashboard to the owner', async () => {
    const response = await request(http)
      .get('/admin/api/metrics/dashboard')
      .set('Cookie', owner.cookie)
      .expect(200);
    const body = response.body as {
      totalUsers: number;
      newPerDay: { date: string; count: number }[];
      verifiedPct: number;
      active7d: number;
      proCount: number;
    };
    expect(body.newPerDay).toHaveLength(30);
    expect(body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(body.verifiedPct).toBeGreaterThanOrEqual(0);
    expect(body.verifiedPct).toBeLessThanOrEqual(100);
    expect(typeof body.active7d).toBe('number');
    expect(typeof body.proCount).toBe('number');
  });

  // ─── Amendment 1 (PR 2) ────────────────────────────────────────────────────

  it('publishes app config the owner sets, and audits it', async () => {
    await request(http)
      .get('/app-config')
      .expect(200, { maintenance: null, minAndroidVersionCode: null });

    // Support lacks config.manage.
    await request(http)
      .get('/admin/api/config')
      .set('Cookie', support.cookie)
      .expect(403);

    // A banner needs both languages.
    await request(http)
      .put('/admin/api/config')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({
        maintenanceEnabled: true,
        maintenanceTone: 'warning',
        maintenanceMessageEs: 'Mantenimiento hoy',
        maintenanceMessageEn: null,
        minAndroidVersionCode: null,
      })
      .expect(400);

    await request(http)
      .put('/admin/api/config')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({
        maintenanceEnabled: true,
        maintenanceTone: 'info',
        maintenanceMessageEs: 'Mantenimiento hoy a las 22:00',
        maintenanceMessageEn: 'Maintenance today at 22:00',
        minAndroidVersionCode: 17,
      })
      .expect(200);

    const published = await request(http).get('/app-config').expect(200);
    expect(published.body).toEqual({
      maintenance: {
        tone: 'info',
        message: {
          es: 'Mantenimiento hoy a las 22:00',
          en: 'Maintenance today at 22:00',
        },
      },
      minAndroidVersionCode: 17,
    });
    expect(published.headers['cache-control']).toBe('public, max-age=60');

    const trail = await prisma.staffAuditLog.findFirst({
      where: { action: 'config.update', staffId: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(trail?.before).toMatchObject({ maintenanceEnabled: false });
    expect(trail?.after).toMatchObject({ minAndroidVersionCode: 17 });

    // Back to the defaults, so no other suite sees a banner.
    await request(http)
      .put('/admin/api/config')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({
        maintenanceEnabled: false,
        maintenanceTone: 'warning',
        maintenanceMessageEs: null,
        maintenanceMessageEn: null,
        minAndroidVersionCode: null,
      })
      .expect(200);
  });

  it('exports the user list as CSV: account fields only, audited', async () => {
    const user = await registerUser('csv');
    await prisma.bodyWeight.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        weightKg: 81.9,
        date: new Date('2026-11-02'),
      },
    });
    const response = await request(http)
      .get('/admin/api/export/users.csv')
      .query({ q: user.email })
      .set('Cookie', support.cookie)
      .expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="usuarios-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const lines = response.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'id,email,username,created_at,email_verified,status,last_login_at,device_count,last_sync_at,is_pro',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith(`${user.id},${user.email},`)).toBe(true);
    expect(response.text).not.toContain('81.9');

    const audit = await prisma.staffAuditLog.findFirst({
      where: { action: 'user.export', staffId: support.id },
    });
    expect(audit?.after).toEqual({ q: user.email, status: null, rows: 1 });
  });

  it('gates subscription reads and promotional grants by permission', async () => {
    const user = await registerUser('promo');
    // Support holds neither subscription permission.
    await request(http)
      .get(`/admin/api/users/${user.id}/subscription`)
      .set('Cookie', support.cookie)
      .expect(403);
    await request(http)
      .post(`/admin/api/users/${user.id}/subscription/promotional`)
      .set(CSRF)
      .set('Cookie', support.cookie)
      .send({ duration: 'monthly' })
      .expect(403);

    // Payments are off in this suite: the read shows the mirror, the grant
    // answers 503, and nothing is audited as granted.
    const read = await request(http)
      .get(`/admin/api/users/${user.id}/subscription`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(read.body).toMatchObject({
      mirror: { state: 'UNKNOWN' },
      provider: { available: false, snapshot: null },
    });
    await request(http)
      .post(`/admin/api/users/${user.id}/subscription/promotional`)
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({ duration: 'forever' })
      .expect(400);
    await request(http)
      .post(`/admin/api/users/${user.id}/subscription/promotional`)
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .send({ duration: 'monthly' })
      .expect(503);
    expect(
      await prisma.staffAuditLog.count({
        where: { action: 'subscription.grant_promotional', targetId: user.id },
      }),
    ).toBe(0);
  });

  it('disables a staff member instantly', async () => {
    await request(http)
      .get('/admin/api/users')
      .set('Cookie', support.cookie)
      .expect(200);
    await request(http)
      .post(`/admin/api/staff/${support.id}/disable`)
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .expect(204);
    await request(http)
      .get('/admin/api/users')
      .set('Cookie', support.cookie)
      .expect(401);
    await request(http)
      .post('/admin/api/auth/login')
      .set(CSRF)
      .set('X-Forwarded-For', nextIp())
      .send({ email: support.email, password: PASSWORD })
      .expect(401);
  });

  it('keeps the staff audit trail append-only', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE staff_audit_logs SET action = 'x' WHERE staff_id = '${ownerId}'`,
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.$executeRawUnsafe('DELETE FROM staff_audit_logs'),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.$executeRawUnsafe('TRUNCATE staff_audit_logs'),
    ).rejects.toThrow(/append-only/);
  });

  it('logs the owner out', async () => {
    await request(http)
      .post('/admin/api/auth/logout')
      .set(CSRF)
      .set('Cookie', owner.cookie)
      .expect(204);
    await request(http)
      .get('/admin/api/auth/me')
      .set('Cookie', owner.cookie)
      .expect(401);
  });
});
