import type { SessionLog, SessionPlan } from '../types';

export function calculatePerformanceScore(log: SessionLog, plan: SessionPlan): number {
  let score = 0;

  const actualTotalReps = log.sets.reduce((sum, s) => sum + s.reps, 0);
  const plannedTotalReps = plan.sets * plan.reps;
  const repRatio = plannedTotalReps > 0 ? actualTotalReps / plannedTotalReps : 1;

  if (repRatio >= 1.05) score += 2;
  else if (repRatio >= 0.95) score += 1;
  else if (repRatio >= 0.90) score += 0;
  else if (repRatio >= 0.80) score -= 1;
  else score -= 2;

  const avgRPE = log.sets.length > 0
    ? log.sets.reduce((sum, s) => sum + s.rpe, 0) / log.sets.length
    : plan.targetRPE;
  const rpeDeviation = avgRPE - plan.targetRPE;

  if (rpeDeviation <= -1) score += 1;
  else if (rpeDeviation <= 0.5) score += 0;
  else if (rpeDeviation <= 1) score -= 1;
  else score -= 2;

  if (log.sorenessFromPrevious >= 3) score -= 1;
  if (log.jointPain) score -= 2;
  if (log.sleepQuality === 1) score -= 1;
  if (log.pumpQuality === 3) score += 1;
  if (log.pumpQuality === 1) score -= 1;

  return score;
}

export interface ScoreDecision {
  decision: 'progress' | 'hold' | 'observe' | 'reduce' | 'deload' | 'stop';
  setsChange: number;
  intensityChange: number;
  coefficientChange: number;
  reason: string;
}

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
  if (score >= -1) {
    return { decision: 'observe', setsChange: 0, intensityChange: -0.05, coefficientChange: -0.0025, reason: 'Небольшая усталость, снижаем интенсивность' };
  }
  if (score >= -3) {
    return { decision: 'reduce', setsChange: -2, intensityChange: -0.10, coefficientChange: -999, reason: 'Накопилась усталость, снижаем объём' };
  }
  return { decision: 'deload', setsChange: 0, intensityChange: 0, coefficientChange: -999, reason: 'Нужна разгрузка, переходим к деload' };
}
