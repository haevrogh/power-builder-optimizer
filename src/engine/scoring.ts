import type { SessionLog, SessionPlan, PlanAdjustment, FailureReason } from '../types';
import { AUTOREGULATION } from './constants';

// ─── Constants re-export for external use ───
export { AUTOREGULATION };

/**
 * Calculate readiness score from pre-workout checkin.
 * Range: -4 to +1
 */
export function calculateReadinessScore(checkin: {
  sorenessFromPrevious: 0 | 1 | 2 | 3;
  jointPain: boolean;
  sleepQuality: 1 | 2 | 3;
}): number {
  let score = 0;
  if (checkin.sorenessFromPrevious === 3) score -= 1;
  if (checkin.jointPain) score -= 2;
  if (checkin.sleepQuality === 1) score -= 1;
  if (checkin.sleepQuality === 3) score += 1;
  return score;
}

/**
 * Adjust session plan based on readiness score.
 * Called BEFORE the training session starts.
 *
 * Change from original: joint pain → recovery workout (same exercise, minimal weight)
 * instead of removing the exercise entirely.
 */
export function adjustPlanForReadiness(plan: SessionPlan, readiness: number, jointPain: boolean): {
  adjustedPlan: SessionPlan;
  adjustment: PlanAdjustment;
} {
  if (jointPain) {
    return {
      adjustedPlan: {
        ...plan,
        intensityPercent: AUTOREGULATION.RECOVERY_INTENSITY_PERCENT,
        sets: Math.max(1, Math.round(plan.sets * AUTOREGULATION.RECOVERY_SETS_MULTIPLIER)),
        reps: plan.reps,
        targetRPE: AUTOREGULATION.RECOVERY_TARGET_RPE,
      },
      adjustment: {
        intensityChange: -(plan.intensityPercent - AUTOREGULATION.RECOVERY_INTENSITY_PERCENT),
        setsChange: Math.round(plan.sets * AUTOREGULATION.RECOVERY_SETS_MULTIPLIER) - plan.sets,
        message: 'Боль в суставе — восстановительная тренировка с минимальным весом. Работаем на технику и кровоток.',
        severity: 'severe',
      },
    };
  }

  if (readiness >= 0) {
    return {
      adjustedPlan: plan,
      adjustment: { intensityChange: 0, setsChange: 0, message: 'Готовность в норме, работаем по плану', severity: 'none' },
    };
  }

  if (readiness === -1) {
    const newIntensity = Math.max(0.40, plan.intensityPercent - 0.05);
    const newReps = Math.max(1, Math.round(plan.reps * (newIntensity / plan.intensityPercent)));
    return {
      adjustedPlan: { ...plan, intensityPercent: newIntensity, reps: newReps },
      adjustment: { intensityChange: -0.05, setsChange: 0, message: 'Немного устал — снижаем интенсивность на 5%', severity: 'mild' },
    };
  }

  if (readiness === -2) {
    const newIntensity = Math.max(0.40, plan.intensityPercent - 0.10);
    const newReps = Math.max(1, Math.round(plan.reps * (newIntensity / plan.intensityPercent)));
    return {
      adjustedPlan: { ...plan, intensityPercent: newIntensity, reps: newReps, sets: Math.max(1, plan.sets - 1) },
      adjustment: { intensityChange: -0.10, setsChange: -1, message: 'Восстановление не завершилось — убираем 1 подход, снижаем нагрузку', severity: 'moderate' },
    };
  }

  // readiness <= -3
  return {
    adjustedPlan: {
      ...plan,
      intensityPercent: 0.45,
      reps: Math.max(1, Math.round(plan.reps * 0.5)),
      sets: Math.max(1, Math.round(plan.sets * 0.6)),
      targetRPE: 6,
    },
    adjustment: {
      intensityChange: -(plan.intensityPercent - 0.45),
      setsChange: Math.round(plan.sets * 0.6) - plan.sets,
      message: 'Тело не восстановилось. Лёгкая работа или отдых?',
      severity: 'severe',
    },
  };
}

/**
 * Binary performance scoring: did the athlete complete the plan or not?
 *
 * Returns true if athlete completed >= COMPLETION_THRESHOLD (95%) of planned reps.
 * Simple, no RPE involved in the core decision.
 */
export function didCompletePlan(
  log: SessionLog,
  plan: SessionPlan,
): boolean {
  const actualTotalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);
  const plannedTotalReps = plan.sets * plan.reps;
  if (plannedTotalReps === 0) return true;
  return (actualTotalReps / plannedTotalReps) >= AUTOREGULATION.COMPLETION_THRESHOLD;
}

/**
 * Calculate performance score AFTER the training session.
 *
 * Simplified binary approach:
 * - Completed plan fully (≥95% reps) → positive score
 * - Exceeded plan (≥105% reps) → high score
 * - Did not complete → negative score
 * - RPE is still tracked but only as secondary signal, not primary driver
 *
 * Range: -4 to +4
 */
export function calculatePerformanceScore(
  log: SessionLog,
  adjustedPlan: SessionPlan,
  readinessScore: number,
  _usedAdjustedPlan: boolean,
): number {
  const plan = adjustedPlan;
  let score = 0;

  // 1. Binary completion check (primary signal)
  const actualTotalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);
  const plannedTotalReps = plan.sets * plan.reps;
  if (plannedTotalReps > 0) {
    const repRatio = actualTotalReps / plannedTotalReps;
    if (repRatio >= 1.05) score += 2;       // exceeded plan
    else if (repRatio >= 0.95) score += 1;   // completed plan
    else if (repRatio >= 0.90) score += 0;   // almost completed
    else if (repRatio >= 0.80) score -= 1;   // underperformed
    else score -= 2;                          // significantly underperformed
  }

  // 2. RPE as secondary signal (kept for data, lighter weight)
  if (log.sets.length > 0) {
    const avgRPE = log.sets.reduce((sum, s) => sum + s.rpe, 0) / log.sets.length;
    const rpeDeviation = avgRPE - plan.targetRPE;
    if (rpeDeviation <= -1) score += 1;
    else if (rpeDeviation >= 2) score -= 2;
    else if (rpeDeviation >= 1) score -= 1;
  }

  // 3. Readiness bonus: came in with bad readiness but completed the plan
  if (readinessScore < 0 && plannedTotalReps > 0) {
    if ((actualTotalReps / plannedTotalReps) >= AUTOREGULATION.COMPLETION_THRESHOLD) {
      score += 1;
    }
  }

  return Math.max(-4, Math.min(4, score));
}

export interface ScoreDecision {
  decision: 'progress' | 'hold' | 'observe' | 'reduce' | 'unload' | 'deload' | 'stop';
  setsChange: number;
  intensityChange: number;
  coefficientChange: number;
  reason: string;
}

/**
 * Map performance score to volume adjustment decision.
 *
 * Changes from original:
 * - Joint pain → recovery workout (not stop)
 * - New UNLOAD level between REDUCE and DELOAD
 * - Consistency bonus: consecutiveHolds >= 3 lowers PROGRESS threshold
 * - UX messages explain WHY each decision was made
 */
export function getDecisionFromScore(
  score: number,
  jointPain: boolean,
  consecutiveHolds: number = 0,
): ScoreDecision {
  // Joint pain → recovery mode (not full stop)
  if (jointPain) {
    return {
      decision: 'stop',
      setsChange: 0,
      intensityChange: 0,
      coefficientChange: -999,
      reason: 'Боль в суставе — переходим на восстановительный режим с минимальным весом',
    };
  }

  // Consistency bonus: lower progress threshold after 3+ consecutive HOLDs
  const progressThreshold = consecutiveHolds >= AUTOREGULATION.CONSECUTIVE_HOLD_FOR_BONUS
    ? AUTOREGULATION.PROGRESS_THRESHOLD_WITH_BONUS
    : 3;

  if (score >= progressThreshold) {
    return {
      decision: 'progress',
      setsChange: AUTOREGULATION.PROGRESS_SETS_CHANGE,
      intensityChange: 0,
      coefficientChange: AUTOREGULATION.PROGRESS_COEFFICIENT_CHANGE,
      reason: consecutiveHolds >= AUTOREGULATION.CONSECUTIVE_HOLD_FOR_BONUS
        ? `Стабильно выполняешь план ${consecutiveHolds} тренировок подряд — пора прибавить!`
        : 'Прогресс отличный, прибавляем объём',
    };
  }

  if (score >= 1) {
    return {
      decision: 'hold',
      setsChange: 0,
      intensityChange: 0,
      coefficientChange: 0,
      reason: 'Всё идёт по плану. Нагрузка подобрана верно — адаптация продолжается.',
    };
  }

  if (score >= 0) {
    return {
      decision: 'observe',
      setsChange: 0,
      intensityChange: AUTOREGULATION.OBSERVE_INTENSITY_CHANGE,
      coefficientChange: AUTOREGULATION.OBSERVE_COEFFICIENT_CHANGE,
      reason: 'План почти выполнен, но чуть тяжелее чем нужно. Немного снижаем интенсивность.',
    };
  }

  if (score >= -2) {
    return {
      decision: 'reduce',
      setsChange: AUTOREGULATION.REDUCE_SETS_CHANGE,
      intensityChange: AUTOREGULATION.REDUCE_INTENSITY_CHANGE,
      coefficientChange: -999,
      reason: 'Не удалось выполнить план — снижаем объём и интенсивность.',
    };
  }

  // score < -2 → UNLOAD (new intermediate level)
  if (score >= -3) {
    return {
      decision: 'unload',
      setsChange: 0,
      intensityChange: 0,
      coefficientChange: -999,
      reason: 'Накопилась усталость — переходим на облегчённую неделю (−30% объём, интенсивность сохраняем).',
    };
  }

  // score < -3 → full DELOAD
  return {
    decision: 'deload',
    setsChange: 0,
    intensityChange: 0,
    coefficientChange: -999,
    reason: 'Серьёзное недовосстановление — нужна полная разгрузочная неделя.',
  };
}

/**
 * Check if we need to show the failure survey.
 * Triggered when athlete fails to complete plan N times in a row.
 */
export function shouldShowFailureSurvey(consecutiveFailures: number): boolean {
  return consecutiveFailures >= AUTOREGULATION.CONSECUTIVE_FAILURES_FOR_SURVEY;
}

/**
 * Get recommended action based on failure survey response.
 */
export function getFailureSurveyDecision(reason: FailureReason): ScoreDecision {
  switch (reason) {
    case 'soreness':
      return {
        decision: 'unload',
        setsChange: 0,
        intensityChange: 0,
        coefficientChange: -999,
        reason: 'Крепатура мешает восстановлению — облегчённая неделя поможет.',
      };
    case 'sleep':
      return {
        decision: 'unload',
        setsChange: 0,
        intensityChange: 0,
        coefficientChange: -999,
        reason: 'Плохой сон накопился — снижаем нагрузку на неделю, потом вернёмся.',
      };
    case 'joint_pain':
      return {
        decision: 'stop',
        setsChange: 0,
        intensityChange: 0,
        coefficientChange: -999,
        reason: 'Боль в суставе — переходим на восстановительный режим.',
      };
    case 'just_hard':
      return {
        decision: 'reduce',
        setsChange: AUTOREGULATION.REDUCE_SETS_CHANGE,
        intensityChange: AUTOREGULATION.REDUCE_INTENSITY_CHANGE,
        coefficientChange: -999,
        reason: 'Программа оказалась тяжёлой — снижаем нагрузку и продолжаем.',
      };
  }
}

/**
 * Count consecutive sessions where plan was NOT completed, for a given exercise.
 */
export function countConsecutiveFailures(
  sessionLogs: SessionLog[],
  exerciseId: string,
): number {
  const sorted = sessionLogs
    .filter(l => l.exerciseId === exerciseId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let count = 0;
  for (const log of sorted) {
    const score = log.performanceScore ?? 0;
    if (score < 1) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive HOLD decisions for a given exercise.
 */
export function countConsecutiveHolds(
  sessionLogs: SessionLog[],
  exerciseId: string,
): number {
  const sorted = sessionLogs
    .filter(l => l.exerciseId === exerciseId && l.volumeAdjustment)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let count = 0;
  for (const log of sorted) {
    if (log.volumeAdjustment?.decision === 'hold') {
      count++;
    } else {
      break;
    }
  }
  return count;
}
