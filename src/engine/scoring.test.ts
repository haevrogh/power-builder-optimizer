import { describe, it, expect } from 'vitest';
import {
  calculateReadinessScore,
  adjustPlanForReadiness,
  didCompletePlan,
  calculatePerformanceScore,
  getDecisionFromScore,
  shouldShowFailureSurvey,
  getFailureSurveyDecision,
  countConsecutiveFailures,
  countConsecutiveHolds,
} from './scoring';
import { AUTOREGULATION } from './constants';
import type { SessionLog, SessionPlan, SetLog } from '../types';

// ─── Helpers ───

function makePlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionNumber: 1,
    sets: 4,
    reps: 8,
    targetRPE: 8,
    sessionType: 'heavy',
    loadConfig: { mode: 'bodyweight' },
    intensityPercent: 0.75,
    ...overrides,
  };
}

function makeSetLog(reps: number, rpe: number = 8): SetLog {
  return { setNumber: 1, reps, rpe, loadConfig: { mode: 'bodyweight' }, completed: true };
}

function makeSessionLog(sets: SetLog[], overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'log-1',
    date: new Date().toISOString(),
    exerciseId: 'ex-1',
    mesocycleId: 'meso-1',
    weekNumber: 1,
    sessionNumber: 1,
    preCheckinId: 'check-1',
    sets,
    usedAdjustedPlan: true,
    ...overrides,
  };
}

// ─── Tests ───

describe('calculateReadinessScore', () => {
  it('returns 0 for neutral state', () => {
    expect(calculateReadinessScore({ sorenessFromPrevious: 0, jointPain: false, sleepQuality: 2 })).toBe(0);
  });

  it('returns +1 for good sleep, no issues', () => {
    expect(calculateReadinessScore({ sorenessFromPrevious: 0, jointPain: false, sleepQuality: 3 })).toBe(1);
  });

  it('returns -1 for severe soreness', () => {
    expect(calculateReadinessScore({ sorenessFromPrevious: 3, jointPain: false, sleepQuality: 2 })).toBe(-1);
  });

  it('returns -2 for joint pain only', () => {
    expect(calculateReadinessScore({ sorenessFromPrevious: 0, jointPain: true, sleepQuality: 2 })).toBe(-2);
  });

  it('returns -4 for worst case', () => {
    expect(calculateReadinessScore({ sorenessFromPrevious: 3, jointPain: true, sleepQuality: 1 })).toBe(-4);
  });

  it('does not penalize light/medium soreness', () => {
    expect(calculateReadinessScore({ sorenessFromPrevious: 1, jointPain: false, sleepQuality: 2 })).toBe(0);
    expect(calculateReadinessScore({ sorenessFromPrevious: 2, jointPain: false, sleepQuality: 2 })).toBe(0);
  });
});

describe('adjustPlanForReadiness', () => {
  const plan = makePlan({ sets: 4, reps: 8, intensityPercent: 0.75 });

  it('returns plan unchanged when readiness >= 0', () => {
    const { adjustedPlan, adjustment } = adjustPlanForReadiness(plan, 0, false);
    expect(adjustedPlan).toEqual(plan);
    expect(adjustment.severity).toBe('none');
  });

  it('reduces intensity by 5% for readiness -1', () => {
    const { adjustedPlan, adjustment } = adjustPlanForReadiness(plan, -1, false);
    expect(adjustedPlan.intensityPercent).toBe(0.70);
    expect(adjustment.severity).toBe('mild');
    expect(adjustedPlan.sets).toBe(4); // sets unchanged
  });

  it('reduces intensity by 10% and -1 set for readiness -2', () => {
    const { adjustedPlan, adjustment } = adjustPlanForReadiness(plan, -2, false);
    expect(adjustedPlan.intensityPercent).toBe(0.65);
    expect(adjustedPlan.sets).toBe(3);
    expect(adjustment.severity).toBe('moderate');
  });

  it('applies severe deload for readiness <= -3', () => {
    const { adjustedPlan, adjustment } = adjustPlanForReadiness(plan, -3, false);
    expect(adjustedPlan.intensityPercent).toBe(0.45);
    expect(adjustedPlan.targetRPE).toBe(6);
    expect(adjustment.severity).toBe('severe');
  });

  // NEW: Recovery workout on joint pain instead of removing exercise
  it('applies recovery workout on joint pain (not removal)', () => {
    const { adjustedPlan, adjustment } = adjustPlanForReadiness(plan, 0, true);
    expect(adjustedPlan.sets).toBeGreaterThan(0); // NOT zero!
    expect(adjustedPlan.intensityPercent).toBe(AUTOREGULATION.RECOVERY_INTENSITY_PERCENT);
    expect(adjustedPlan.targetRPE).toBe(AUTOREGULATION.RECOVERY_TARGET_RPE);
    expect(adjustment.severity).toBe('severe');
    expect(adjustment.message).toContain('восстановительная');
  });

  it('recovery workout preserves reps count', () => {
    const { adjustedPlan } = adjustPlanForReadiness(plan, 0, true);
    expect(adjustedPlan.reps).toBe(plan.reps);
  });
});

describe('didCompletePlan', () => {
  const plan = makePlan({ sets: 4, reps: 8 }); // 32 total reps

  it('returns true when all reps completed', () => {
    const log = makeSessionLog([makeSetLog(8), makeSetLog(8), makeSetLog(8), makeSetLog(8)]);
    expect(didCompletePlan(log, plan)).toBe(true);
  });

  it('returns true at 95% threshold', () => {
    // 31 out of 32 = 96.8%
    const log = makeSessionLog([makeSetLog(8), makeSetLog(8), makeSetLog(8), makeSetLog(7)]);
    expect(didCompletePlan(log, plan)).toBe(true);
  });

  it('returns false below 95%', () => {
    // 28 out of 32 = 87.5%
    const log = makeSessionLog([makeSetLog(8), makeSetLog(8), makeSetLog(8), makeSetLog(4)]);
    expect(didCompletePlan(log, plan)).toBe(false);
  });

  it('returns true for empty plan', () => {
    const emptyPlan = makePlan({ sets: 0, reps: 0 });
    const log = makeSessionLog([]);
    expect(didCompletePlan(log, emptyPlan)).toBe(true);
  });
});

describe('calculatePerformanceScore', () => {
  const plan = makePlan({ sets: 4, reps: 8, targetRPE: 8 }); // 32 total reps

  it('returns +2 for exceeding plan (>=105%)', () => {
    // 34 reps = 106%
    const log = makeSessionLog([makeSetLog(9), makeSetLog(9), makeSetLog(8), makeSetLog(8)]);
    const score = calculatePerformanceScore(log, plan, 0, true);
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('returns +1 for completing plan (>=95%)', () => {
    const log = makeSessionLog([makeSetLog(8), makeSetLog(8), makeSetLog(8), makeSetLog(7)]);
    const score = calculatePerformanceScore(log, plan, 0, true);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('returns negative for significant underperformance', () => {
    // 20 reps = 62.5%
    const log = makeSessionLog([makeSetLog(5), makeSetLog(5), makeSetLog(5), makeSetLog(5)]);
    const score = calculatePerformanceScore(log, plan, 0, true);
    expect(score).toBeLessThan(0);
  });

  it('gives readiness bonus when bad readiness but completed', () => {
    const log = makeSessionLog([makeSetLog(8), makeSetLog(8), makeSetLog(8), makeSetLog(8)]);
    const scoreGoodReadiness = calculatePerformanceScore(log, plan, 0, true);
    const scoreBadReadiness = calculatePerformanceScore(log, plan, -2, true);
    expect(scoreBadReadiness).toBeGreaterThan(scoreGoodReadiness);
  });

  it('clamps to range -4 to +4', () => {
    // Very bad session
    const badLog = makeSessionLog([makeSetLog(1, 10)]);
    expect(calculatePerformanceScore(badLog, plan, 0, true)).toBeGreaterThanOrEqual(-4);

    // Very good session
    const goodLog = makeSessionLog([makeSetLog(10, 6), makeSetLog(10, 6), makeSetLog(10, 6), makeSetLog(10, 6)]);
    expect(calculatePerformanceScore(goodLog, plan, -2, true)).toBeLessThanOrEqual(4);
  });
});

describe('getDecisionFromScore', () => {
  it('returns progress for score >= 3', () => {
    expect(getDecisionFromScore(3, false).decision).toBe('progress');
    expect(getDecisionFromScore(4, false).decision).toBe('progress');
  });

  it('returns hold for score 1-2', () => {
    expect(getDecisionFromScore(1, false).decision).toBe('hold');
    expect(getDecisionFromScore(2, false).decision).toBe('hold');
  });

  it('returns observe for score 0', () => {
    expect(getDecisionFromScore(0, false).decision).toBe('observe');
  });

  it('returns reduce for score -1 to -2', () => {
    expect(getDecisionFromScore(-1, false).decision).toBe('reduce');
    expect(getDecisionFromScore(-2, false).decision).toBe('reduce');
  });

  it('returns unload for score -3 (NEW level)', () => {
    expect(getDecisionFromScore(-3, false).decision).toBe('unload');
  });

  it('returns deload for score < -3', () => {
    expect(getDecisionFromScore(-4, false).decision).toBe('deload');
  });

  it('returns stop on joint pain', () => {
    expect(getDecisionFromScore(4, true).decision).toBe('stop');
  });

  // Consistency bonus tests
  it('lowers progress threshold after 3+ consecutive holds', () => {
    // Score 2 normally → hold
    expect(getDecisionFromScore(2, false, 0).decision).toBe('hold');
    expect(getDecisionFromScore(2, false, 2).decision).toBe('hold');
    // Score 2 with 3+ holds → progress!
    expect(getDecisionFromScore(2, false, 3).decision).toBe('progress');
    expect(getDecisionFromScore(2, false, 5).decision).toBe('progress');
  });

  it('includes consistency message when bonus applies', () => {
    const result = getDecisionFromScore(2, false, 4);
    expect(result.decision).toBe('progress');
    expect(result.reason).toContain('4 тренировок подряд');
  });

  // UX messages
  it('all decisions have non-empty reason messages', () => {
    for (const score of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
      const result = getDecisionFromScore(score, false);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  // Uses constants
  it('uses AUTOREGULATION constants for changes', () => {
    const progress = getDecisionFromScore(3, false);
    expect(progress.setsChange).toBe(AUTOREGULATION.PROGRESS_SETS_CHANGE);
    expect(progress.coefficientChange).toBe(AUTOREGULATION.PROGRESS_COEFFICIENT_CHANGE);
  });
});

describe('shouldShowFailureSurvey', () => {
  it('returns false below threshold', () => {
    expect(shouldShowFailureSurvey(0)).toBe(false);
    expect(shouldShowFailureSurvey(2)).toBe(false);
  });

  it('returns true at threshold', () => {
    expect(shouldShowFailureSurvey(3)).toBe(true);
  });

  it('returns true above threshold', () => {
    expect(shouldShowFailureSurvey(5)).toBe(true);
  });
});

describe('getFailureSurveyDecision', () => {
  it('recommends unload for soreness', () => {
    expect(getFailureSurveyDecision('soreness').decision).toBe('unload');
  });

  it('recommends unload for sleep', () => {
    expect(getFailureSurveyDecision('sleep').decision).toBe('unload');
  });

  it('recommends stop for joint pain', () => {
    expect(getFailureSurveyDecision('joint_pain').decision).toBe('stop');
  });

  it('recommends reduce for just hard', () => {
    expect(getFailureSurveyDecision('just_hard').decision).toBe('reduce');
  });
});

describe('countConsecutiveFailures', () => {
  it('returns 0 for empty logs', () => {
    expect(countConsecutiveFailures([], 'ex-1')).toBe(0);
  });

  it('counts consecutive failures from most recent', () => {
    const logs: SessionLog[] = [
      makeSessionLog([], { id: '1', date: '2024-01-01', exerciseId: 'ex-1', performanceScore: 2 }),
      makeSessionLog([], { id: '2', date: '2024-01-02', exerciseId: 'ex-1', performanceScore: 0 }),
      makeSessionLog([], { id: '3', date: '2024-01-03', exerciseId: 'ex-1', performanceScore: -1 }),
    ];
    expect(countConsecutiveFailures(logs, 'ex-1')).toBe(2); // last 2 are failures (score < 1)
  });

  it('stops counting at first success', () => {
    const logs: SessionLog[] = [
      makeSessionLog([], { id: '1', date: '2024-01-01', exerciseId: 'ex-1', performanceScore: -2 }),
      makeSessionLog([], { id: '2', date: '2024-01-02', exerciseId: 'ex-1', performanceScore: 2 }),
      makeSessionLog([], { id: '3', date: '2024-01-03', exerciseId: 'ex-1', performanceScore: -1 }),
    ];
    expect(countConsecutiveFailures(logs, 'ex-1')).toBe(1); // only the most recent
  });

  it('filters by exerciseId', () => {
    const logs: SessionLog[] = [
      makeSessionLog([], { id: '1', date: '2024-01-01', exerciseId: 'ex-1', performanceScore: -1 }),
      makeSessionLog([], { id: '2', date: '2024-01-02', exerciseId: 'ex-2', performanceScore: -1 }),
    ];
    expect(countConsecutiveFailures(logs, 'ex-1')).toBe(1);
  });
});

describe('countConsecutiveHolds', () => {
  it('returns 0 for empty logs', () => {
    expect(countConsecutiveHolds([], 'ex-1')).toBe(0);
  });

  it('counts consecutive holds from most recent', () => {
    const logs: SessionLog[] = [
      makeSessionLog([], {
        id: '1', date: '2024-01-01', exerciseId: 'ex-1',
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: 'progress', reason: '' },
      }),
      makeSessionLog([], {
        id: '2', date: '2024-01-02', exerciseId: 'ex-1',
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: 'hold', reason: '' },
      }),
      makeSessionLog([], {
        id: '3', date: '2024-01-03', exerciseId: 'ex-1',
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: 'hold', reason: '' },
      }),
    ];
    expect(countConsecutiveHolds(logs, 'ex-1')).toBe(2);
  });

  it('stops at non-hold decision', () => {
    const logs: SessionLog[] = [
      makeSessionLog([], {
        id: '1', date: '2024-01-01', exerciseId: 'ex-1',
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: 'hold', reason: '' },
      }),
      makeSessionLog([], {
        id: '2', date: '2024-01-02', exerciseId: 'ex-1',
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: 'reduce', reason: '' },
      }),
      makeSessionLog([], {
        id: '3', date: '2024-01-03', exerciseId: 'ex-1',
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: 'hold', reason: '' },
      }),
    ];
    expect(countConsecutiveHolds(logs, 'ex-1')).toBe(1); // only the most recent
  });
});
