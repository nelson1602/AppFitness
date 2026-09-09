import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
} from '../domain/wellness-safety-profile';

/**
 * ADR-P017 **W-3** copy safety.
 *
 * The product boundary this slice has to hold is a *copy* boundary as much as a
 * schema one: the surface may recommend a professional evaluation, but it must
 * never describe the user as safe, cleared, approved or medically fit, must
 * never read as a diagnosis or a treatment, and must never leak a stored token
 * or a system word into a sentence.
 *
 * Structural guarantees are asserted elsewhere — the form has four fields and no
 * free-text input (`wellness-safety-profile-form.schema.spec.ts`,
 * `WellnessSafetyProfileScreen.spec.tsx`), and both databases allowlist the two
 * token columns (W-1). These assertions cover the words.
 */

const WELLNESS_KEYS = Object.keys(en).filter((key) =>
  key.startsWith('wellness.'),
) as (keyof typeof en)[];

const CATALOGS: [name: string, catalog: Record<string, string>][] = [
  ['en', en],
  ['es', es],
];

function entries(catalog: Record<string, string>): [key: string, value: string][] {
  return WELLNESS_KEYS.map((key) => [key, catalog[key]]);
}

/** Keys whose copy matches a forbidden pattern — an empty list is the pass. */
function offenders(catalog: Record<string, string>, forbidden: RegExp): string[] {
  return entries(catalog)
    .filter(([, value]) => forbidden.test(value))
    .map(([key]) => key);
}

describe('the safety statements the slice must make', () => {
  it('positions the app as fitness software that does not diagnose, treat or clear', () => {
    const body = en['wellness.safety.disclaimerBody'];
    expect(body).toMatch(/fitness and general-wellness/i);
    expect(body).toMatch(/does not diagnose/i);
    expect(body).toMatch(/treat/i);
    expect(body).toMatch(/never says that you are cleared or medically fit/i);
    expect(body).toMatch(/qualified professional/i);
  });

  it('positions it identically in Spanish', () => {
    const body = es['wellness.safety.disclaimerBody'];
    expect(body).toMatch(/fitness y bienestar general/i);
    expect(body).toMatch(/no diagnostica/i);
    expect(body).toMatch(/no trata/i);
    expect(body).toMatch(/nunca dice que estés autorizado/i);
    expect(body).toMatch(/profesional cualificado/i);
  });

  it('recommends rather than requires', () => {
    expect(en['wellness.safety.recommendation.optional']).toMatch(
      /a recommendation, not a requirement/i,
    );
    expect(es['wellness.safety.recommendation.optional']).toMatch(
      /una recomendación, no un requisito/i,
    );
  });

  it('says what an empty selection means, and what it does not', () => {
    expect(en['wellness.safety.nothingDeclared']).toMatch(/declared no limitations/i);
    expect(en['wellness.safety.nothingDeclared']).toMatch(
      /does not mean you are cleared or medically fit/i,
    );
    expect(es['wellness.safety.nothingDeclared']).toMatch(/no declaraste limitaciones/i);
    expect(es['wellness.safety.nothingDeclared']).toMatch(/No significa que estés autorizado/i);
  });

  it('states what is never asked for', () => {
    expect(en['wellness.safety.privacyNote']).toMatch(/never ask who evaluated you/i);
    expect(en['wellness.safety.privacyNote']).toMatch(/conditions, medications or treatments/i);
    expect(en['wellness.safety.privacyNote']).toMatch(/nowhere here to write notes/i);
    expect(es['wellness.safety.privacyNote']).toMatch(/quién te evaluó/i);
    expect(es['wellness.safety.privacyNote']).toMatch(/condiciones, medicamentos o tratamientos/i);
  });

  it('describes a queued write factually, without guaranteeing anything', () => {
    // Reassuring is not the same as absolute: the write really is on this
    // device and really is waiting, but nothing here can promise it survives
    // the loss of the device.
    expect(en['wellness.safety.savedPendingBody']).toMatch(/stored on this device/i);
    expect(en['wellness.safety.savedPendingBody']).toMatch(/waiting to synchronize/i);
    expect(es['wellness.safety.savedPendingBody']).toMatch(/guardadas en este dispositivo/i);
    expect(es['wellness.safety.savedPendingBody']).toMatch(/esperan sincronizarse/i);
  });

  it('names the product by its commercial name', () => {
    // ADR-P028 freezes the commercial name as AppFitnessRD. Historical copy
    // elsewhere is untouched; every W-3 string that names the product uses it.
    const naming = WELLNESS_KEYS.filter((key) => /AppFitness/.test(en[key]));
    expect(naming.length).toBeGreaterThanOrEqual(3);
    for (const catalog of [en, es] as Record<string, string>[]) {
      // `AppFitness` not followed by `RD` is the bare, pre-commercial name.
      expect(offenders(catalog, /AppFitness(?!RD)/)).toEqual([]);
    }
  });

  it('describes removal as leaving the active profile, not as erasure', () => {
    // W-2 soft-deletes: `deleted_at` / `deleted_by` are set, the version is
    // bumped and the tombstone syncs — the stored field values are NOT blanked.
    expect(en['wellness.safety.removeConfirmBody']).toMatch(/active profile/i);
    expect(en['wellness.safety.removeConfirmBody']).toMatch(
      /record of the removal stays on this device/i,
    );
    // Aligned with ADR-P011 and docs/legal/PRIVACY_POLICY.md §6: permanent
    // removal of the account and its data, retaining only an anonymized
    // security audit record. The exception is stated, not omitted, and no
    // retention period is invented.
    expect(en['wellness.safety.removeConfirmBody']).toMatch(
      /deleting your account permanently removes the account and its data, keeping only an anonymized security audit record/i,
    );
    expect(es['wellness.safety.removeConfirmBody']).toMatch(/perfil activo/i);
    expect(es['wellness.safety.removeConfirmBody']).toMatch(
      /eliminar tu cuenta quita de forma permanente la cuenta y sus datos, y conserva solo un registro de seguridad anonimizado/i,
    );
    expect(en['wellness.safety.remove']).toMatch(/from my profile/i);
    expect(en['wellness.safety.removedTitle']).toMatch(/from your profile/i);
  });

  it('reports a divergence without offering a remedy this screen does not have', () => {
    // BUG-012 is report-only. The banner previously ended "saving again records
    // your current answers", which reads as a fix for the divergence and is not
    // one.
    expect(en['wellness.safety.syncConflictBody']).toMatch(/no longer match/i);
    expect(en['wellness.safety.syncConflictBody']).toMatch(
      /this screen cannot settle that difference/i,
    );
    expect(en['wellness.safety.syncConflictBody']).not.toMatch(/saving again/i);
    expect(es['wellness.safety.syncConflictBody']).toMatch(/ya no coinciden/i);
    expect(es['wellness.safety.syncConflictBody']).toMatch(
      /esta pantalla no puede solucionar esa diferencia/i,
    );
    expect(es['wellness.safety.syncConflictBody']).not.toMatch(/al guardar de nuevo/i);
  });

  it('acknowledges only the local action when a synchronization difference remains', () => {
    for (const key of [
      'wellness.safety.savedConflictTitle',
      'wellness.safety.savedConflictBody',
      'wellness.safety.removedConflictTitle',
      'wellness.safety.removedConflictBody',
    ] as const) {
      expect(en[key]).toMatch(/this device|difference remains/i);
      expect(es[key]).toMatch(/este dispositivo|diferencia de sincronización/i);
    }
    expect(en['wellness.safety.savedConflictBody']).toMatch(/still differs/i);
    expect(en['wellness.safety.removedConflictBody']).toMatch(/still differs/i);
  });
});

describe('the claims the slice must never make', () => {
  // A safety claim is only acceptable inside a denial. Anything that mentions
  // being cleared or medically fit must therefore also carry a negation.
  const SAFETY_CLAIM = /\b(cleared|medically fit|approved to train|safe to train)\b/i;
  const EN_NEGATION = /\b(does not|do not|never|cannot|not mean|nowhere)\b/i;
  const ES_CLAIM = /\b(autorizad[oa]|en condiciones médicas|apto para entrenar)\b/i;
  const ES_NEGATION = /\b(no|nunca|ningún|ninguna)\b/i;

  it('never describes the user as cleared or medically fit, except to deny it', () => {
    for (const [key, value] of entries(en)) {
      if (!SAFETY_CLAIM.test(value)) continue;
      expect(value).toMatch(EN_NEGATION);
      expect(key).not.toMatch(/savedTitle|savedBody|removedTitle|removedBody/);
    }
  });

  it('never describes the user as authorized in Spanish, except to deny it', () => {
    for (const [, value] of entries(es)) {
      if (!ES_CLAIM.test(value)) continue;
      expect(value).toMatch(ES_NEGATION);
    }
  });

  it.each(CATALOGS)(
    'never diagnoses, prescribes or promises supervision (%s)',
    (_name, catalog) => {
      const FORBIDDEN =
        /\b(your diagnosis|we diagnose|prescrib\w*|dosage|dosis|we recommend a dose|medically supervised|supervisión médica|te diagnosticamos)\b/i;
      expect(offenders(catalog, FORBIDDEN)).toEqual([]);
    },
  );

  it.each(CATALOGS)('never asks for a provider, a finding or a document (%s)', (_name, catalog) => {
    // Phrased as a question or a field label, these would be collection.
    const COLLECTION =
      /\b(who performed it\?|what did they find|upload|attach|adjunta|sube tu|nombre del médico|doctor's name)\b/i;
    expect(offenders(catalog, COLLECTION)).toEqual([]);
  });

  it.each(CATALOGS)('never guarantees a write against loss (%s)', (_name, catalog) => {
    // "Pending sync" must reassure without promising the impossible: this
    // device can be lost before the queue drains.
    const ABSOLUTE =
      /(nothing is lost|no se pierde nada|never lose|nunca (?:se )?pierdes?|cannot be lost|no se puede perder|guaranteed|garantizad[oa]|safe forever|para siempre)/i;
    expect(offenders(catalog, ABSOLUTE)).toEqual([]);
  });

  it.each(CATALOGS)('never claims removal erases the stored values (%s)', (_name, catalog) => {
    // The soft delete keeps a tombstone, so none of these is true.
    const ERASURE =
      /(stop keeping|deja de guardar|dejará de conservar|permanently delet|borrad[oa] permanentemente|erased from (?:your|this) device|borrado de (?:tu|este) dispositivo|wiped|from every device|de todos tus dispositivos)/i;
    expect(offenders(catalog, ERASURE)).toEqual([]);
  });

  it.each(CATALOGS)(
    'never calls a write complete while a conflict remains (%s)',
    (_name, catalog) => {
      const COMPLETION =
        /(up to date|complete|resolved|everywhere|actualizad[oa]|resuelt[oa]|en todas partes|completad[oa])/i;
      const conflictKeys = WELLNESS_KEYS.filter((key) => /Conflict/.test(key));
      expect(conflictKeys.length).toBe(6);
      for (const key of conflictKeys) {
        expect(catalog[key]).not.toMatch(COMPLETION);
      }
    },
  );

  it.each(CATALOGS)('never promises a conflict resolution destination (%s)', (_name, catalog) => {
    // BUG-012: no resolution path exists anywhere in v1, and BUG-014 means the
    // "both versions preserved" guarantee cannot be promised either.
    const OVERPROMISE =
      /\b(resolve|resolver|choose a version|elige una versión|both versions|ambas versiones|review screen|pantalla de revisión)\b/i;
    expect(offenders(catalog, OVERPROMISE)).toEqual([]);
  });
});

describe('no system vocabulary or stored token reaches a sentence', () => {
  const SYSTEM_WORDS =
    /(wellness_safety_profiles|sync_status|sqlite|prisma|http|null|undefined|\bNaN\b|stack|409|500|entity_type|op_id)/i;

  it.each(CATALOGS)('leaks no system word (%s)', (_name, catalog) => {
    expect(offenders(catalog, SYSTEM_WORDS)).toEqual([]);
  });

  it.each(CATALOGS)('never prints a raw vocabulary token (%s)', (_name, catalog) => {
    // Only the snake_case tokens are unambiguous evidence of a leak; a
    // single-word token like `knee` is legitimately part of a label.
    const tokens = [...WELLNESS_AFFECTED_AREAS, ...WELLNESS_MOVEMENTS_TO_AVOID].filter((token) =>
      token.includes('_'),
    );
    const leaked = entries(catalog).flatMap(([key, value]) =>
      tokens.filter((token) => value.includes(token)).map((token) => `${key}: ${token}`),
    );
    expect(leaked).toEqual([]);
  });
});
