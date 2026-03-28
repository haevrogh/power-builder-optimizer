import type { SessionLog, SessionPlan, ExerciseConfig, Mesocycle, VolumeAdjustment } from '../types';
import { getTrainingLevel } from '../types';
import { calculatePerformanceScore, getDecisionFromScore } from './scoring';
import { MAX_PROGRESSION } from './constants';

export function processSessionResult(
  log: SessionLog,
  plan: SessionPlan,
  exercise: ExerciseConfig,
  mesocycle: Mesocycle,
  trainingAgeMonths: number,
): { updatedExercise: ExerciseConfig; updatedMesocycle: Mesocycle; adjustment: VolumeAdjustment } {
  const score = calculatePerformanceScore(log, plan);
  const decision = getDecisionFromScore(score, log.jointPain);
  const level = getTrainingLevel(trainingAgeMonths);
  const maxCoeff = MAX_PROGRESSION[level];

  // Update progression coefficient
  let newCoeff = exercise.progressionCoefficient;
  if (decision.coefficientChange === -999) {
    newCoeff = 0;
  } else {
    newCoeff = Math.max(0, Math.min(maxCoeff, newCoeff + decision.coefficientChange));
  }

  // Update repMax weekly
  const newRepMax = decision.decision === 'deload' || decision.decision === 'stop'
    ? exercise.repMax
    : Math.round((exercise.repMax * (1 + newCoeff)) * 100) / 100;

  const updatedExercise: ExerciseConfig = {
    ...exercise,
    progressionCoefficient: newCoeff,
    repMax: newRepMax,
    repMaxLastUpdated: new Date(),
  };

  // Adjust future weeks in mesocycle
  const updatedWeeks = mesocycle.weeks.map(week => {
    if (week.weekNumber <= mesocycle.currentWeek) return week;

    if (decision.decision === 'deload') {
      return {
        ...week,
        weekType: 'deload' as const,
        targetSets: exercise.volumeLandmarks.mv,
        intensityZone: 'light' as const,
        targetRPE: 5.5,
        sessions: week.sessions.map(s => ({
          ...s,
          sets: Math.max(1, Math.round(exercise.volumeLandmarks.mv * (s.sessionType === 'heavy' ? 0.45 : 0.55))),
          targetRPE: 5,
        })),
      };
    }

    return {
      ...week,
      targetSets: Math.max(
        exercise.volumeLandmarks.mv,
        Math.min(exercise.volumeLandmarks.mrv, week.targetSets + decision.setsChange)
      ),
      sessions: week.sessions.map(s => ({
        ...s,
        sets: Math.max(1, s.sets + Math.round(decision.setsChange * (s.sessionType === 'heavy' ? 0.45 : 0.55))),
        intensityPercent: Math.max(0.40, Math.min(0.95, s.intensityPercent + decision.intensityChange)),
      })),
    };
  });

  const updatedMesocycle: Mesocycle = { ...mesocycle, weeks: updatedWeeks };

  const adjustment: VolumeAdjustment = {
    setsChange: decision.setsChange,
    rpeChange: decision.intensityChange * 10,
    decision: decision.decision,
    reason: decision.reason,
  };

  return { updatedExercise, updatedMesocycle, adjustment };
}
