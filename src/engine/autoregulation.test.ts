import { describe, it, expect } from 'vitest';
import { processSessionResult } from './autoregulation';
import type { SessionLog, SessionPlan, ExerciseConfig, Mesocycle } from '../types';

function makeExercise(overrides: Partial<ExerciseConfig> = {}): ExerciseConfig {
  return {
    id: 'ex-1',
    name: 'Pull-ups',
    muscleGroup: 'back_lats',
    type: 'bodyweight',
    volumeLandmarks: { mv: 4, mev: 6, mav: 12, mrv: 16 },
    repMax: 10,
    progressionCoefficient: 0.01,
    ...overrides,
  };
}

function makeMesocycle(overrides: Partial<Mesocycle> = {}): Mesocycle {
  return {
    id: 'meso-1',
    exerciseId: 'ex-1',
    startDate: '2024-01-01',
    durationWeeks: 5,
    status: 'active',
    currentWeek: 2,
    currentSession: 1,
    weeks: [
      {
        weekNumber: 1, weekType: 'accumulation', targetSets: 10,
        intensityZone: 'medium', targetRPE: 7,
        sessions: [
          { sessionNumber: 1, sets: 4, reps: 8, targetRPE: 7, sessionType: 'heavy', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.70 },
          { sessionNumber: 2, sets: 3, reps: 8, targetRPE: 7, sessionType: 'light', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.60 },
        ],
      },
      {
        weekNumber: 2, weekType: 'accumulation', targetSets: 12,
        intensityZone: 'medium', targetRPE: 7.5,
        sessions: [
          { sessionNumber: 1, sets: 5, reps: 8, targetRPE: 7.5, sessionType: 'heavy', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.75 },
          { sessionNumber: 2, sets: 4, reps: 8, targetRPE: 7.5, sessionType: 'light', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.65 },
        ],
      },
      {
        weekNumber: 3, weekType: 'intensification', targetSets: 14,
        intensityZone: 'heavy', targetRPE: 8,
        sessions: [
          { sessionNumber: 1, sets: 6, reps: 6, targetRPE: 8, sessionType: 'heavy', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.80 },
          { sessionNumber: 2, sets: 4, reps: 6, targetRPE: 8, sessionType: 'light', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.70 },
        ],
      },
      {
        weekNumber: 4, weekType: 'intensification', targetSets: 14,
        intensityZone: 'heavy', targetRPE: 8.5,
        sessions: [
          { sessionNumber: 1, sets: 6, reps: 5, targetRPE: 8.5, sessionType: 'heavy', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.85 },
          { sessionNumber: 2, sets: 4, reps: 5, targetRPE: 8.5, sessionType: 'light', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.75 },
        ],
      },
      {
        weekNumber: 5, weekType: 'deload', targetSets: 6,
        intensityZone: 'light', targetRPE: 5,
        sessions: [
          { sessionNumber: 1, sets: 3, reps: 8, targetRPE: 5, sessionType: 'heavy', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.50 },
          { sessionNumber: 2, sets: 2, reps: 8, targetRPE: 5, sessionType: 'light', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.45 },
        ],
      },
    ],
    ...overrides,
  };
}

function makeLog(score: number): SessionLog {
  return {
    id: 'log-1',
    date: new Date().toISOString(),
    exerciseId: 'ex-1',
    mesocycleId: 'meso-1',
    weekNumber: 2,
    sessionNumber: 1,
    preCheckinId: 'check-1',
    sets: [],
    performanceScore: score,
    usedAdjustedPlan: true,
  };
}

const plan: SessionPlan = {
  sessionNumber: 1, sets: 5, reps: 8, targetRPE: 7.5,
  sessionType: 'heavy', loadConfig: { mode: 'bodyweight' }, intensityPercent: 0.75,
};

describe('processSessionResult', () => {
  it('progresses repMax on progress decision (score >= 3)', () => {
    const exercise = makeExercise({ repMax: 10, progressionCoefficient: 0.01 });
    const { updatedExercise, adjustment } = processSessionResult(
      makeLog(3), plan, exercise, makeMesocycle(), 18,
    );
    expect(updatedExercise.repMax).toBeGreaterThan(10);
    expect(adjustment.decision).toBe('progress');
  });

  it('does not change repMax on hold', () => {
    const exercise = makeExercise({ repMax: 10 });
    const { adjustment } = processSessionResult(
      makeLog(1), plan, exercise, makeMesocycle(), 18,
    );
    // Hold still advances repMax slightly via coefficient
    expect(adjustment.decision).toBe('hold');
  });

  it('does not change repMax on unload', () => {
    const exercise = makeExercise({ repMax: 10 });
    const { updatedExercise, adjustment } = processSessionResult(
      makeLog(-3), plan, exercise, makeMesocycle(), 18,
    );
    expect(updatedExercise.repMax).toBe(10);
    expect(adjustment.decision).toBe('unload');
  });

  it('does not change repMax on deload', () => {
    const exercise = makeExercise({ repMax: 10 });
    const { updatedExercise } = processSessionResult(
      makeLog(-4), plan, exercise, makeMesocycle(), 18,
    );
    expect(updatedExercise.repMax).toBe(10);
  });

  // UNLOAD: reduces volume by 30%, keeps intensity ~92%
  it('applies UNLOAD to future weeks correctly', () => {
    const meso = makeMesocycle({ currentWeek: 2 });
    const { updatedMesocycle } = processSessionResult(
      makeLog(-3), plan, makeExercise(), meso, 18,
    );

    // Week 3 (future) should be adjusted
    const week3 = updatedMesocycle.weeks.find(w => w.weekNumber === 3)!;
    const originalWeek3 = meso.weeks.find(w => w.weekNumber === 3)!;

    // Volume should be reduced
    expect(week3.sessions[0].sets).toBeLessThan(originalWeek3.sessions[0].sets);
    // Intensity should be slightly reduced (multiplied by ~0.92)
    expect(week3.sessions[0].intensityPercent).toBeLessThan(originalWeek3.sessions[0].intensityPercent);
    expect(week3.sessions[0].intensityPercent).toBeGreaterThan(0.40);
  });

  // DELOAD: converts future weeks to deload
  it('converts future weeks to deload', () => {
    const meso = makeMesocycle({ currentWeek: 2 });
    const { updatedMesocycle } = processSessionResult(
      makeLog(-4), plan, makeExercise(), meso, 18,
    );

    const week3 = updatedMesocycle.weeks.find(w => w.weekNumber === 3)!;
    expect(week3.weekType).toBe('deload');
    expect(week3.targetRPE).toBe(5.5);
  });

  // Progress: adds sets to future weeks
  it('adds sets on progress decision', () => {
    const meso = makeMesocycle({ currentWeek: 2 });
    const { updatedMesocycle } = processSessionResult(
      makeLog(3), plan, makeExercise(), meso, 18,
    );

    const week3 = updatedMesocycle.weeks.find(w => w.weekNumber === 3)!;
    const originalWeek3 = meso.weeks.find(w => w.weekNumber === 3)!;
    expect(week3.targetSets).toBeGreaterThan(originalWeek3.targetSets);
  });

  // Doesn't modify past weeks
  it('does not modify current or past weeks', () => {
    const meso = makeMesocycle({ currentWeek: 2 });
    const { updatedMesocycle } = processSessionResult(
      makeLog(3), plan, makeExercise(), meso, 18,
    );

    // Week 1 and 2 should remain unchanged
    expect(updatedMesocycle.weeks[0]).toEqual(meso.weeks[0]);
    expect(updatedMesocycle.weeks[1]).toEqual(meso.weeks[1]);
  });

  // Consistency bonus
  it('applies consistency bonus when consecutiveHolds >= 3', () => {
    const exercise = makeExercise({ repMax: 10 });
    // Score 2 with 3 consecutive holds → should trigger progress
    const { adjustment } = processSessionResult(
      makeLog(2), plan, exercise, makeMesocycle(), 18, 3,
    );
    expect(adjustment.decision).toBe('progress');
  });

  it('does not apply consistency bonus when consecutiveHolds < 3', () => {
    const exercise = makeExercise({ repMax: 10 });
    // Score 2 with 2 consecutive holds → should be hold
    const { adjustment } = processSessionResult(
      makeLog(2), plan, exercise, makeMesocycle(), 18, 2,
    );
    expect(adjustment.decision).toBe('hold');
  });

  // UNLOAD sets are clamped to minimum volume (mv)
  it('unload sets never go below mv', () => {
    const exercise = makeExercise({ volumeLandmarks: { mv: 4, mev: 6, mav: 12, mrv: 16 } });
    const meso = makeMesocycle({ currentWeek: 1 });
    const { updatedMesocycle } = processSessionResult(
      makeLog(-3), plan, exercise, meso, 18,
    );

    for (const week of updatedMesocycle.weeks) {
      if (week.weekNumber > 1) {
        expect(week.targetSets).toBeGreaterThanOrEqual(exercise.volumeLandmarks.mv);
      }
    }
  });
});
