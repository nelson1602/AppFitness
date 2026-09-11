import type { PrismaService } from '../../database/prisma.service';
import type { FieldCipherService } from '../../medical/infrastructure/field-cipher.service';
import type { SyncTx } from '../../sync/domain/sync.types';
import { PrismaDietaryPreferenceRepository } from './prisma-dietary-preference.repository';

const USER = 'user-1';
const PREF_ID = '11111111-1111-4111-8111-111111111111';
const KEY_ID = 'key-2026-07';

type FakeTx = {
  $executeRaw: jest.Mock;
  dietaryPreference: { findFirst: jest.Mock; updateMany: jest.Mock };
};

function fakeTx(): FakeTx {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    dietaryPreference: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

/** ADR-P030 §Decision 3 — the sync path must never reach the root client. */
function forbiddenRoot(): PrismaService {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `root client must not be used (accessed ${String(prop)})`,
        );
      },
    },
  ) as unknown as PrismaService;
}

/** Plain-object shape so the jest.Mock fields stay directly assertable. */
type CipherStub = { keyId: string; encrypt: jest.Mock; decrypt: jest.Mock };

function cipherStub(): CipherStub {
  return {
    keyId: KEY_ID,
    encrypt: jest.fn((plain: string) => Uint8Array.from(Buffer.from(plain))),
    decrypt: jest.fn((buf: Uint8Array) => Buffer.from(buf).toString()),
  };
}

const asCipher = (c: CipherStub): FieldCipherService =>
  c as unknown as FieldCipherService;

function sqlOf(mock: jest.Mock): string {
  const [strings] = mock.mock.calls[0] as [TemplateStringsArray];
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function valuesOf(mock: jest.Mock): unknown[] {
  const [, ...values] = mock.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

const ATTRIBUTES = {
  exclusionType: 'avoid_tag' as const,
  avoidTag: 'nut_allergy',
  catalogKey: null,
  kind: 'allergy' as const,
  note: 'severe — carry epipen',
};

describe('PrismaDietaryPreferenceRepository (ADR-P030 C-2)', () => {
  let tx: FakeTx;
  let cipher: CipherStub;
  let repo: PrismaDietaryPreferenceRepository;

  beforeEach(() => {
    tx = fakeTx();
    cipher = cipherStub();
    repo = new PrismaDietaryPreferenceRepository(
      forbiddenRoot(),
      asCipher(cipher),
    );
  });

  describe('create', () => {
    it('is a static statement with ON CONFLICT (id) DO NOTHING', async () => {
      await repo.create(tx as unknown as SyncTx, USER, PREF_ID, ATTRIBUTES);

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).toContain('INSERT INTO dietary_preferences');
      expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    });

    it('omits the database-owned columns and writes updated_at explicitly', async () => {
      await repo.create(tx as unknown as SyncTx, USER, PREF_ID, ATTRIBUTES);

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).not.toContain('created_at');
      expect(sql).not.toContain('sync_seq');
      expect(sql).not.toMatch(/\bversion\b/);
      expect(sql).toContain('updated_at');
    });

    it('stores the note as ciphertext with its key id — plaintext never reaches SQL', async () => {
      await repo.create(tx as unknown as SyncTx, USER, PREF_ID, ATTRIBUTES);

      const values = valuesOf(tx.$executeRaw);
      // id, userId, exclusionType, avoidTag, catalogKey, kind,
      // noteEnc, encKeyId, updatedAt
      expect(values[0]).toBe(PREF_ID);
      expect(values[1]).toBe(USER);
      expect(values[2]).toBe('avoid_tag');
      expect(values[3]).toBe('nut_allergy');
      expect(values[4]).toBeNull();
      expect(values[5]).toBe('allergy');
      expect(values[6]).toBeInstanceOf(Uint8Array);
      expect(values[7]).toBe(KEY_ID);
      expect(values[8]).toBeInstanceOf(Date);
      expect(cipher.encrypt).toHaveBeenCalledWith('severe — carry epipen');
      // The tagged template carries no plaintext of its own either.
      expect(sqlOf(tx.$executeRaw)).not.toContain('epipen');
    });

    it('leaves note_enc and enc_key_id null when there is no note', async () => {
      await repo.create(tx as unknown as SyncTx, USER, PREF_ID, {
        ...ATTRIBUTES,
        note: null,
      });

      const values = valuesOf(tx.$executeRaw);
      expect(values[6]).toBeNull();
      expect(values[7]).toBeNull();
      expect(cipher.encrypt).not.toHaveBeenCalled();
    });

    it('returns 0 on a primary-key collision without raising', async () => {
      tx.$executeRaw.mockResolvedValue(0);

      await expect(
        repo.create(tx as unknown as SyncTx, USER, PREF_ID, ATTRIBUTES),
      ).resolves.toBe(0);
    });
  });

  describe('conditional writes', () => {
    it('update asserts owner + expected version + a live row and mutates only kind + note', async () => {
      const count = await repo.update(
        tx as unknown as SyncTx,
        USER,
        PREF_ID,
        { kind: 'preference', note: 'milder now' },
        3,
      );

      expect(count).toBe(1);
      const [{ where, data }] = tx.dietaryPreference.updateMany.mock
        .calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: PREF_ID,
        userId: USER,
        version: 3,
        deletedAt: null,
      });
      // The exclusion target is immutable — it must not appear in the write.
      expect(Object.keys(data).sort()).toEqual([
        'encKeyId',
        'kind',
        'noteEnc',
        'version',
      ]);
      expect(data.version).toBe(4);
    });

    it('clearing the note drops the key id with it', async () => {
      await repo.update(
        tx as unknown as SyncTx,
        USER,
        PREF_ID,
        { kind: 'allergy', note: null },
        3,
      );

      const [{ data }] = tx.dietaryPreference.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.noteEnc).toBeNull();
      expect(data.encKeyId).toBeNull();
    });

    it('update reports 0 when the predicate matches nothing', async () => {
      tx.dietaryPreference.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repo.update(
          tx as unknown as SyncTx,
          USER,
          PREF_ID,
          { kind: 'allergy', note: null },
          3,
        ),
      ).resolves.toBe(0);
    });

    it('softDelete carries owner + expected version + a live row', async () => {
      await repo.softDelete(tx as unknown as SyncTx, USER, PREF_ID, USER, 3);

      const [{ where, data }] = tx.dietaryPreference.updateMany.mock
        .calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: PREF_ID,
        userId: USER,
        version: 3,
        deletedAt: null,
      });
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(4);
    });
  });

  describe('resolve', () => {
    it('requires a live row when the reviewed row was not a tombstone', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, PREF_ID, {
        operation: 'UPDATE',
        update: { kind: 'preference', note: null },
        expectedVersion: 8,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.dietaryPreference.updateMany.mock
        .calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: PREF_ID,
        userId: USER,
        version: 8,
        deletedAt: null,
      });
      expect(data).not.toHaveProperty('deletedAt');
      expect(data.version).toBe(9);
    });

    it('requires a tombstone and restores it when the reviewed row was deleted', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, PREF_ID, {
        operation: 'CREATE',
        attributes: ATTRIBUTES,
        expectedVersion: 8,
        expectedDeleted: true,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.dietaryPreference.updateMany.mock
        .calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where.deletedAt).toEqual({ not: null });
      expect(data.deletedAt).toBeNull();
      expect(data.deletedBy).toBeNull();
      // Even a retained CREATE only rewrites the mutable subset.
      expect(data).not.toHaveProperty('exclusionType');
      expect(data).not.toHaveProperty('avoidTag');
    });

    it('a DELETE resolution writes the tombstone at the reviewed version', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, PREF_ID, {
        operation: 'DELETE',
        expectedVersion: 2,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ data }] = tx.dietaryPreference.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(3);
    });
  });

  it('findOwned reads through the transaction and is ownership-scoped', async () => {
    await repo.findOwned(tx as unknown as SyncTx, USER, PREF_ID);

    expect(tx.dietaryPreference.findFirst).toHaveBeenCalledWith({
      where: { id: PREF_ID, userId: USER },
    });
  });

  it('changedSince is the pull path and uses the root client', async () => {
    const root = {
      dietaryPreference: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const pullRepo = new PrismaDietaryPreferenceRepository(
      root as unknown as PrismaService,
      asCipher(cipherStub()),
    );

    await pullRepo.changedSince(USER, 5, 100);

    expect(root.dietaryPreference.findMany).toHaveBeenCalledWith({
      where: { userId: USER, syncSeq: { gt: BigInt(5) } },
      orderBy: { syncSeq: 'asc' },
      take: 100,
    });
  });
});
