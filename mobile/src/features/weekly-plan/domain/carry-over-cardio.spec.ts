import {
  ADDED_CARDIO_EXERCISE,
  addedCardioExercise,
  cardioAllowed,
  placeAddedCardio,
} from './carry-over-cardio';

const SESSIONS = [
  { date: '2026-11-10', sessionKey: 'A' },
  { date: '2026-11-13', sessionKey: 'B' },
  { date: '2026-11-15', sessionKey: 'A' },
];

describe('carry-over cardio on the next workout (ADR-P040 v11-B, C2)', () => {
  it('goes to the first scheduled session after the day over', () => {
    expect(
      placeAddedCardio({
        cardio: [{ fromDate: '2026-11-12', kcal: 54, minutes: 15 }],
        sessions: SESSIONS,
        today: '2026-11-13',
        removedFromDates: [],
      }),
    ).toEqual([{ date: '2026-11-13', sessionKey: 'B', minutes: 15, fromDates: ['2026-11-12'] }]);
  });

  it('is gone once that session has passed', () => {
    expect(
      placeAddedCardio({
        cardio: [{ fromDate: '2026-11-09', kcal: 54, minutes: 15 }],
        sessions: SESSIONS,
        today: '2026-11-13',
        removedFromDates: [],
      }),
    ).toEqual([]);
  });

  it('a session never takes more than 30 minutes', () => {
    const [block] = placeAddedCardio({
      cardio: [
        { fromDate: '2026-11-11', kcal: 100, minutes: 30 },
        { fromDate: '2026-11-12', kcal: 54, minutes: 15 },
      ],
      sessions: SESSIONS,
      today: '2026-11-12',
      removedFromDates: [],
    });
    expect(block).toEqual({
      date: '2026-11-13',
      sessionKey: 'B',
      minutes: 30,
      fromDates: ['2026-11-11', '2026-11-12'],
    });
  });

  it('stays removed once the person removed it', () => {
    expect(
      placeAddedCardio({
        cardio: [{ fromDate: '2026-11-12', kcal: 54, minutes: 15 }],
        sessions: SESSIONS,
        today: '2026-11-13',
        removedFromDates: ['2026-11-12'],
      }),
    ).toEqual([]);
  });

  it('stays removed when the missed session moves to the next day (device, 2026-11-14)', () => {
    // Removed on Friday 11-13; the session was not done, so on Saturday it trains on 11-14.
    const moved = [
      { date: '2026-11-10', sessionKey: 'A' },
      { date: '2026-11-14', sessionKey: 'B' },
    ];
    expect(
      placeAddedCardio({
        cardio: [{ fromDate: '2026-11-12', kcal: 243, minutes: 30 }],
        sessions: moved,
        today: '2026-11-14',
        removedFromDates: ['2026-11-12'],
      }),
    ).toEqual([]);
  });

  it('a removal covers only its own days over: a later day over adds a new block', () => {
    expect(
      placeAddedCardio({
        cardio: [
          { fromDate: '2026-11-11', kcal: 54, minutes: 15 },
          { fromDate: '2026-11-12', kcal: 36, minutes: 10 },
        ],
        sessions: SESSIONS,
        today: '2026-11-13',
        removedFromDates: ['2026-11-11'],
      }),
    ).toEqual([{ date: '2026-11-13', sessionKey: 'B', minutes: 10, fromDates: ['2026-11-12'] }]);
  });

  it('is never added when the evaluation restricts that kind of exercise', () => {
    expect(cardioAllowed([], [])).toBe(true);
    expect(cardioAllowed(['overhead_press'], ['NUTRITION:protein'])).toBe(true);
    expect(cardioAllowed(['high_impact_cardio'], [])).toBe(false);
    expect(cardioAllowed(['running'], [])).toBe(false);
    expect(cardioAllowed([], ['SAFETY:medical_clearance'])).toBe(false);
    expect(cardioAllowed([], ['SAFETY:bp_crisis_block'])).toBe(false);
  });

  it('is one set of easy cardio, timed', () => {
    expect(addedCardioExercise(20)).toMatchObject({
      exerciseKey: ADDED_CARDIO_EXERCISE,
      sets: 1,
      target: { kind: 'DURATION_SECONDS', seconds: 1200 },
    });
  });
});
