import 'reflect-metadata';

import { AppModule } from './app.module';
import { MedicalModule } from './modules/medical/medical.module';
import {
  EvaluationSyncHandler,
  RestrictionSyncHandler,
} from './modules/medical/infrastructure/medical-sync.handlers';
import { MedicalController } from './modules/medical/presentation/medical.controller';
import { NutritionModule } from './modules/nutrition/nutrition.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SyncModule } from './modules/sync/sync.module';
import { WorkoutModule } from './modules/workout/workout.module';

/**
 * Public composition-root contract (ADR-P017 Decision 4, Wellness Safety
 * Profile Slice 0).
 *
 * Public V1 is a fitness, nutrition, progress and general-wellness product, so
 * the retained medical domain must not be reachable from the assembled public
 * application. `MedicalModule` is what made it reachable: it mounted
 * `MedicalController` and, in `onModuleInit`, registered the two medical
 * handlers into `SyncEntityRegistry` — the only gate on `/sync/push` and
 * `/sync/pull`.
 *
 * This inspects the real Nest metadata graph rather than a hand-maintained
 * list, so it needs no database and cannot drift from the actual wiring: a
 * future re-import of `MedicalModule` anywhere in the transitive closure fails
 * it. The HTTP and sync consequences are proven separately against a live
 * database in `test/medical-dormancy.e2e-spec.ts`.
 *
 * Dormancy is wiring-only. The medical implementation is deliberately still
 * imported *by this test*, which is itself evidence that the classes, the
 * module and their types are preserved and still compile.
 */

type Ctor = new (...args: never[]) => unknown;
type MetadataKey = 'imports' | 'controllers' | 'providers';

/** `Reflect.getMetadata` returns `any`; narrow it once, safely, here. */
function metadataList(key: MetadataKey, target: Ctor): unknown[] {
  const value: unknown = Reflect.getMetadata(key, target);
  return Array.isArray(value) ? value : [];
}

/** Every module reachable from `root` through Nest `imports` metadata. */
function moduleClosure(root: Ctor): Set<Ctor> {
  const seen = new Set<Ctor>();
  const queue: Ctor[] = [root];

  for (let current = queue.pop(); current; current = queue.pop()) {
    if (seen.has(current)) continue;
    seen.add(current);

    for (const entry of metadataList('imports', current)) {
      // Dynamic modules (`X.forRoot()`) expose their class under `module`.
      const candidate =
        typeof entry === 'function'
          ? (entry as Ctor)
          : ((entry as { module?: Ctor } | null)?.module ?? null);
      if (candidate && !seen.has(candidate)) queue.push(candidate);
    }
  }
  return seen;
}

/** Flattens one metadata key across every module in the closure. */
function collect(closure: Set<Ctor>, key: MetadataKey): unknown[] {
  const out: unknown[] = [];
  for (const mod of closure) out.push(...metadataList(key, mod));
  return out;
}

type ControllerClass = Ctor & {
  readonly name: string;
  readonly prototype: object;
};

/** Nest stores a route's path under `path` and its verb under `method`. */
function pathList(target: object): string[] {
  const value: unknown = Reflect.getMetadata('path', target);
  if (typeof value === 'string') return [value];
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === 'string');
  return [];
}

function isRouteHandler(fn: unknown): fn is object {
  // GET is `0`, so presence must be tested, not truthiness.
  return (
    typeof fn === 'function' && Reflect.getMetadata('method', fn) !== undefined
  );
}

/**
 * Every fully-qualified route path a controller class declares — its
 * `@Controller(prefix)` crossed with each handler's `@Get/@Post/...` path.
 *
 * Asserting on route metadata rather than the class name is what makes the
 * guard real: a controller called `WellnessRecordsController` mounted at
 * `@Controller('medical')` would pass a name check and still expose the domain.
 */
function routePaths(controller: ControllerClass): string[] {
  const trim = (s: string) => s.replace(/^\/+|\/+$/g, '');
  const prefixes = pathList(controller);
  const proto = controller.prototype;

  const suffixes: string[] = [];
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const handler = Object.getOwnPropertyDescriptor(proto, name)
      ?.value as unknown;
    if (isRouteHandler(handler)) suffixes.push(...pathList(handler));
  }

  const out: string[] = [];
  for (const prefix of prefixes.length > 0 ? prefixes : ['']) {
    for (const suffix of suffixes.length > 0 ? suffixes : ['']) {
      out.push('/' + [trim(prefix), trim(suffix)].filter(Boolean).join('/'));
    }
  }
  return out;
}

/** Route paths under the retired `/medical` namespace, whatever declares them. */
function medicalRoutes(controller: ControllerClass): string[] {
  return routePaths(controller).filter(
    (p) => p === '/medical' || p.startsWith('/medical/'),
  );
}

describe('public composition root — medical-domain dormancy (ADR-P017)', () => {
  const closure = moduleClosure(AppModule);
  const controllers = collect(closure, 'controllers');
  const providers = collect(closure, 'providers');
  const controllerClasses = controllers.filter(
    (c): c is ControllerClass => typeof c === 'function',
  );

  it('does not import MedicalModule anywhere in the transitive graph', () => {
    expect(closure.has(MedicalModule)).toBe(false);
  });

  it('does not mount MedicalController in the public application', () => {
    expect(controllers).not.toContain(MedicalController);
  });

  it('mounts no route under /medical, whatever the controller is called', () => {
    // Route metadata, not the class name: a `WellnessRecordsController` mounted
    // at `@Controller('medical')` must fail this too.
    const offending = controllerClasses.flatMap((c) =>
      medicalRoutes(c).map((path) => `${c.name} ${path}`),
    );
    expect(offending).toEqual([]);
  });

  it('detects /medical routes when they are present (guard is not vacuous)', () => {
    // The same detector, aimed at the controller that was mounted before this
    // slice, must find every route it declares — otherwise the assertion above
    // would pass for the wrong reason.
    expect(medicalRoutes(MedicalController).sort()).toEqual([
      '/medical/evaluations',
      '/medical/evaluations',
      '/medical/evaluations/:id',
      '/medical/restrictions',
      '/medical/restrictions',
    ]);
  });

  it('registers no medical sync handler in the public application', () => {
    // Absent from composition ⇒ `MedicalModule.onModuleInit` never runs ⇒ the
    // handlers are never added to `SyncEntityRegistry`. `/sync/push` then
    // rejects both entity types with ENTITY_NOT_SUPPORTED and `/sync/pull`
    // cannot return them, because pull iterates only `registry.all()`.
    expect(providers).not.toContain(EvaluationSyncHandler);
    expect(providers).not.toContain(RestrictionSyncHandler);
  });

  it('keeps the non-medical wellness modules composed', () => {
    // Proves the removal is surgical: the rest of the public API is untouched.
    for (const mod of [
      SyncModule,
      NutritionModule,
      WorkoutModule,
      ProgressModule,
    ]) {
      expect(closure.has(mod)).toBe(true);
    }
  });

  it('preserves the medical implementation as a loadable, self-contained module', () => {
    // Nothing was deleted: the module and its parts still exist and still
    // declare their wiring, so the retained code stays technically available.
    // That is reversibility, NOT permission — public reactivation requires a
    // new accepted ADR, owner authorization, legal/privacy/consent/security
    // review and complete release validation (ADR-P017 Decision 9).
    expect(typeof MedicalModule).toBe('function');
    expect(metadataList('controllers', MedicalModule)).toContain(
      MedicalController,
    );
    const medicalProviders = metadataList('providers', MedicalModule);
    expect(medicalProviders).toContain(EvaluationSyncHandler);
    expect(medicalProviders).toContain(RestrictionSyncHandler);
  });
});
