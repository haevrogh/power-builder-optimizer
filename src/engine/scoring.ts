import type { SessionLog, SessionPlan, PlanAdjustment } from '../types';

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
 */
export function adjustPlanForReadiness(plan: SessionPlan, readiness: number, jointPain: boolean): {
  adjustedPlan: SessionPlan;
  adjustment: PlanAdjustment;
} {
  if (jointPain) {
    return {
      adjustedPlan: { ...plan, sets: 0 },
      adjustment: {
        intensityChange: 0,
        setsChange: -plan.sets,
        message: 'Боль в суставе — упражнение убрано из тренировки. Здоровье важнее.',
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
 * Calculate performance score AFTER the training session.
 * Simplified: only reps vs plan + RPE deviation + readiness bonus.
 * Range: -4 to +4
 */
export function calculatePerformanceScore(
  log: SessionLog,
  adjustedPlan: SessionPlan,
  readinessScore: number,
  usedAdjustedPlan: boolean,
): number {
  const plan = usedAdjustedPlan ? adjustedPlan : adjustedPlan; // compare against the plan that was shown
  let score = 0;

  // 1. Reps completion
  const actualTotalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);
  const plannedTotalReps = plan.sets * plan.reps;
  if (plannedTotalReps > 0) {
    const repRatio = actualTotalReps / plannedTotalReps;
    if (repRatio >= 1.05) score += 2;
    else if (repRatio >= 0.95) score += 1;
    else if (repRatio >= 0.90) score += 0;
    else if (repRatio >= 0.80) score -= 1;
    else score -= 2;
  }

  // 2. RPE deviation
  if (log.sets.length > 0) {
    const avgRPE = log.sets.reduce((sum, s) => sum + s.rpe, 0) / log.sets.length;
    const rpeDeviation = avgRPE - plan.targetRPE;
    if (rpeDeviation <= -1) score += 1;
    else if (rpeDeviation >= 2) score -= 2;
    else if (rpeDeviation >= 1) score -= 1;
  }

  // 3. Readiness bonus: came in with bad readiness but executed the plan
  if (readinessScore < 0) {
    const actualTotalReps2 = log.sets.reduce((sum, s) => sum + s.reps, 0);
    const plannedTotalReps2 = plan.sets * plan.reps;
    if (plannedTotalReps2 > 0 && actualTotalReps2 / plannedTotalReps2 >= 0.95) {
      score += 1;
    }
  }

  return Math.max(-4, Math.min(4, score));
}

export interface ScoreDecision {
  decision: 'progress' | 'hold' | 'observe' | 'reduce' | 'deload' | 'stop';
  setsChange: number;
  intensityChange: number;
  coefficientChange: number;
  reason: string;
}

/**
 * Map performance score to volume adjustment decision.
 * Updated thresholds: deload at <= -3 (narrower range).
 */
export function getDecisionFromScore(score: number, jointPain: boolean): ScoreDecision {
  if (jointPain) {
    return { decision: 'stop', setsChange: 0, intensityChange: 0, coefficientChange: -999, reason: 'Боль в суставе — берём паузу' };
  }
  if (score >= 3) {
    return { decision: 'progress', setsChange: 2, intensityChange: 0, coefficientChange: 0.0025, reason: 'Прогресс отличный, прибавляем объём' };
  }
  if (score >= 1) {
    return { decision: 'hold', setsChange: 0, intensityChange: 0, coefficientChange: 0, reason: 'Всё идёт по плану' };
  }
  if (score >= 0) {
    return { decision: 'observe', setsChange: 0, intensityChange: -0.05, coefficientChange: -0.0025, reason: 'Небольшая усталость, снижаем интенсивность' };
  }
  if (score >= -2) {
    return { decision: 'reduce', setsChange: -1, intensityChange: -0.10, coefficientChange: -999, reason: 'Накопилась усталость, снижаем объём' };
  }
  return { decision: 'deload', setsChange: 0, intensityChange: 0, coefficientChange: -999, reason: 'Нужна разгрузка, переходим к деload' };
}
