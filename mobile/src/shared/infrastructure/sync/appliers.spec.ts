import { allAppliers, getApplier, registerApplier, type EntityApplier } from './appliers';

function makeApplier(entityType: string): EntityApplier {
  return {
    entityType,
    applyServerChange: jest.fn(),
    markConflict: jest.fn(),
  };
}

describe('sync applier registry', () => {
  it('registers and resolves appliers by entity type', () => {
    const applier = makeApplier('spec_entities_a');
    registerApplier(applier);

    expect(getApplier('spec_entities_a')).toBe(applier);
    expect(allAppliers()).toContain(applier);
  });

  it('returns undefined for unregistered entity types', () => {
    expect(getApplier('spec_entities_missing')).toBeUndefined();
  });

  it('rejects duplicate registration for the same entity type', () => {
    registerApplier(makeApplier('spec_entities_dup'));

    expect(() => registerApplier(makeApplier('spec_entities_dup'))).toThrow(
      "Sync applier already registered for 'spec_entities_dup'",
    );
  });
});
