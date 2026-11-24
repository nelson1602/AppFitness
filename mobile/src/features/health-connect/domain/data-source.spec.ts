import {
  chooseSource,
  HONOR_HEALTH_PACKAGE,
  pickSessions,
  sourceLabel,
  type HealthOrigin,
} from './data-source';

const SAMSUNG = 'com.sec.android.app.shealth';
const FIT = 'com.google.android.apps.fitness';

const honor: HealthOrigin = { packageName: HONOR_HEALTH_PACKAGE, isWatch: false, steps: 156 };
const samsung: HealthOrigin = { packageName: SAMSUNG, isWatch: true, steps: 1117 };
const fit: HealthOrigin = { packageName: FIT, isWatch: false, steps: 2400 };

describe('health-source@1.0.0 — source choice (ADR-P048 amendment)', () => {
  it('the person’s pick wins, even over a watch', () => {
    expect(chooseSource([honor, samsung], HONOR_HEALTH_PACKAGE)).toBe(HONOR_HEALTH_PACKAGE);
  });

  it('keeps a pick with no data today (its types then fall back to unfiltered)', () => {
    expect(chooseSource([honor], SAMSUNG)).toBe(SAMSUNG);
  });

  it('Honor phone + Samsung watch: the watch’s app, not the phone’s', () => {
    expect(chooseSource([honor, samsung], null)).toBe(SAMSUNG);
  });

  it('a watch origin beats one with more steps', () => {
    expect(chooseSource([fit, samsung], null)).toBe(SAMSUNG);
  });

  it('without a watch: the most steps today', () => {
    expect(chooseSource([honor, fit], null)).toBe(FIT);
  });

  it('ties break by package name, whatever the input order', () => {
    const a = { packageName: 'a.app', isWatch: false, steps: 10 };
    const b = { packageName: 'b.app', isWatch: false, steps: 10 };
    expect(chooseSource([b, a], null)).toBe('a.app');
    expect(chooseSource([a, b], null)).toBe('a.app');
  });

  it('no origin found: null, read unfiltered as before', () => {
    expect(chooseSource([], null)).toBeNull();
  });
});

describe('source labels', () => {
  it.each([
    [SAMSUNG, 'Samsung Health'],
    [FIT, 'Google Fit'],
    ['com.huawei.health', 'Huawei Health'],
    ['com.fitbit.FitbitMobile', 'Fitbit'],
    ['com.garmin.android.apps.connectmobile', 'Garmin Connect'],
    [HONOR_HEALTH_PACKAGE, 'Honor Salud'],
    ['com.example.tracker', 'com.example.tracker'],
  ])('%s → %s', (packageName, label) => {
    expect(sourceLabel(packageName, 'Honor Salud')).toBe(label);
  });
});

describe('sessions written by two apps', () => {
  const session = (origin: string, start: string, end: string) => ({
    origin,
    startTime: `2026-11-20T${start}:00.000Z`,
    endTime: `2026-11-20T${end}:00.000Z`,
  });

  it('keeps the chosen source’s copy of an overlapping workout', () => {
    const phone = session(HONOR_HEALTH_PACKAGE, '08:00', '08:40');
    const watch = session(SAMSUNG, '08:02', '08:41');
    expect(pickSessions([phone, watch], SAMSUNG)).toEqual([watch]);
    expect(pickSessions([phone, watch], HONOR_HEALTH_PACKAGE)).toEqual([phone]);
  });

  it('without the source in the overlap: the earliest session’s app', () => {
    const phone = session(HONOR_HEALTH_PACKAGE, '08:00', '08:40');
    const fitCopy = session(FIT, '08:05', '08:30');
    expect(pickSessions([fitCopy, phone], SAMSUNG)).toEqual([phone]);
  });

  it('never drops one app’s sessions against each other, nor separate workouts', () => {
    const a = session(SAMSUNG, '08:00', '08:30');
    const b = session(SAMSUNG, '08:20', '08:50');
    const later = session(HONOR_HEALTH_PACKAGE, '18:00', '18:30');
    expect(pickSessions([later, b, a], SAMSUNG)).toEqual([a, b, later]);
  });
});
