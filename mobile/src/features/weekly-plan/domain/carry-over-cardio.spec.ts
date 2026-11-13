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
        removedDates: [],
      }),
    ).toEqual([{ date: '2026-11-13', sessionKey: 'B', minutes: 15, fromDates: ['2026-11-12'] }]);
  });

  it('is gone once that session has passed', () => {
    expect(
      placeAddedCardio({
        cardio: [{ fromDate: '2026-11-09', kcal: 54, minutes: 15 }],
        sessions: SESSIONS,
        today: '2026-11-13',
        removedDates: [],
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
      removedDates: [],
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
        removedDates: ['2026-11-13'],
      }),
    ).toEqual([]);
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
