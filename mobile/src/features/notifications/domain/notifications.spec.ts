import { buildNotifications, unreadOf, type NotificationInputs } from './notifications';

const base: NotificationInputs = {
  today: '2026-10-21',
  weekStart: '2026-10-19',
  todayPlan: null,
  lastWeightDate: '2026-10-20',
  evaluationDate: '2026-10-01',
};

describe('buildNotifications (ADR-P039 D4)', () => {
  it('says nothing when every reminder is satisfied and there is no plan', () => {
    expect(buildNotifications(base)).toEqual([]);
  });

  it.each([
    ['training', 'today-training', 'today-training:2026-10-21'],
    ['rest', 'today-rest', 'today-rest:2026-10-21'],
  ] as const)('announces a %s day once per day, opening Entrenamientos', (plan, kind, id) => {
    expect(buildNotifications({ ...base, todayPlan: plan })).toEqual([
      { id, kind, target: 'workouts' },
    ]);
  });

  it.each([
    ['nothing logged yet', null, true],
    ['the last weigh-in 7 days ago', '2026-10-14', true],
    ['a weigh-in 6 days ago', '2026-10-15', false],
  ])('asks for a weigh-in with %s', (_case, lastWeightDate, expected) => {
    const ids = buildNotifications({ ...base, lastWeightDate }).map((item) => item.id);
    expect(ids.includes('weigh-in:2026-10-19')).toBe(expected);
  });

  it.each([
    ['no evaluation', null, true],
    ['an evaluation 90 days old', '2026-07-23', true],
    ['an evaluation 89 days old', '2026-07-24', false],
  ])('suggests reviewing the evaluation with %s', (_case, evaluationDate, expected) => {
    const ids = buildNotifications({ ...base, evaluationDate }).map((item) => item.id);
    expect(ids.includes('evaluation-review:2026-10')).toBe(expected);
  });

  it('keeps ids stable within their period, so read state survives restarts', () => {
    const tuesday = buildNotifications({ ...base, today: '2026-10-20', lastWeightDate: null });
    const thursday = buildNotifications({ ...base, today: '2026-10-22', lastWeightDate: null });
    expect(tuesday.find((item) => item.kind === 'weigh-in')?.id).toBe(
      thursday.find((item) => item.kind === 'weigh-in')?.id,
    );
  });

  it('is deterministic and ordered', () => {
    const inputs = {
      ...base,
      todayPlan: 'training' as const,
      lastWeightDate: null,
      evaluationDate: null,
    };
    const items = buildNotifications(inputs);
    expect(items.map((item) => item.kind)).toEqual([
      'today-training',
      'weigh-in',
      'evaluation-review',
    ]);
    expect(buildNotifications(inputs)).toEqual(items);
  });

  it('filters read items out of the unread list', () => {
    const items = buildNotifications({ ...base, todayPlan: 'training', lastWeightDate: null });
    expect(
      unreadOf(items, new Set(['today-training:2026-10-21'])).map((item) => item.kind),
    ).toEqual(['weigh-in']);
  });
});
