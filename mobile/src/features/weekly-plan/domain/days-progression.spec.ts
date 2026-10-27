import {
  DAYS_PROPOSAL_NOTE,
  daysProposalNote,
  openDaysProposal,
  proposedTrainingDays,
  type WeekWorkoutResult,
} from './days-progression';

const WEEK = '2026-11-02';

const week = (weekStart: string, done: number, planned = 3, days = 3): WeekWorkoutResult => ({
  weekStart,
  plannedDays: days,
  plannedSessions: planned,
  fulfilledSessions: done,
});

const base = {
  daysInForce: 3,
  chosenDays: 5,
  weekStart: WEEK,
  previousWeeks: [week('2026-10-26', 3), week('2026-10-19', 3)],
};

describe('proposedTrainingDays (ADR-P040 D11)', () => {
  it('proposes one more day after two consecutive weeks at ≥ 80 %', () => {
    expect(proposedTrainingDays(base)).toBe(4);
  });

  it('counts 80 % exactly as enough', () => {
    expect(
      proposedTrainingDays({
        ...base,
        daysInForce: 5,
        chosenDays: 6,
        previousWeeks: [week('2026-10-26', 4, 5, 5), week('2026-10-19', 4, 5, 5)],
      }),
    ).toBe(6);
  });

  it('needs both weeks: one below 80 % breaks the streak', () => {
    expect(
      proposedTrainingDays({
        ...base,
        previousWeeks: [week('2026-10-26', 3), week('2026-10-19', 2)],
      }),
    ).toBeNull();
  });

  it('needs the two weeks immediately before, with no gap', () => {
    expect(
      proposedTrainingDays({
        ...base,
        previousWeeks: [week('2026-10-26', 3), week('2026-10-12', 3)],
      }),
    ).toBeNull();
    expect(proposedTrainingDays({ ...base, previousWeeks: [week('2026-10-26', 3)] })).toBeNull();
  });

  it('counts only weeks planned at the current days, so each new day is earned again', () => {
    expect(
      proposedTrainingDays({
        ...base,
        daysInForce: 4,
        previousWeeks: [week('2026-10-26', 4, 4, 4), week('2026-10-19', 3, 3, 3)],
      }),
    ).toBeNull();
  });

  it('never goes above the days the person chose', () => {
    expect(proposedTrainingDays({ ...base, chosenDays: 3 })).toBeNull();
    expect(proposedTrainingDays({ ...base, chosenDays: 4 })).toBe(4);
  });

  it('never goes above six days, what a routine can schedule', () => {
    expect(
      proposedTrainingDays({
        ...base,
        daysInForce: 6,
        chosenDays: 7,
        previousWeeks: [week('2026-10-26', 6, 6, 6), week('2026-10-19', 6, 6, 6)],
      }),
    ).toBeNull();
  });

  it('ignores weeks without planned sessions', () => {
    expect(
      proposedTrainingDays({
        ...base,
        previousWeeks: [week('2026-10-26', 0, 0), week('2026-10-19', 3)],
      }),
    ).toBeNull();
  });

  it('is deterministic', () => {
    expect(proposedTrainingDays(base)).toBe(proposedTrainingDays({ ...base }));
  });
});

describe('the proposal note', () => {
  it('is open until the days in force reach it', () => {
    const notes = [{ code: 'plan.progression.up' }, daysProposalNote(4)];
    expect(notes[1]).toEqual({ code: DAYS_PROPOSAL_NOTE, params: { days: 4 } });
    expect(openDaysProposal(notes, 3)).toBe(4);
    expect(openDaysProposal(notes, 4)).toBeNull();
    expect(openDaysProposal([], 3)).toBeNull();
  });
});
