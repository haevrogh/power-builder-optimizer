import type { Mesocycle, ExerciseConfig, VacationPeriod } from '../types';
import { generateMesocycle } from './mesocycle';

/**
 * Handle missed sessions.
 * Returns adjustments to apply to the current mesocycle.
 */
export function handleMissedSessions(
  meso: Mesocycle,
  _exercise: ExerciseConfig,
  lastSessionDate: string | null,
): { action: 'continue' | 'soften' | 'restart'; adjustedMeso?: Mesocycle; message: string } {
  if (!lastSessionDate) return { action: 'continue', message: '' };

  const daysSinceLastSession = Math.floor(
    (Date.now() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Less than 7 days: no change
  if (daysSinceLastSession < 7) {
    return { action: 'continue', message: '' };
  }

  // 7-10 days (missed 1-2 sessions)
  if (daysSinceLastSession <= 10) {
    const adjustedWeeks = meso.weeks.map(w => {
      if (w.weekNumber !== meso.currentWeek) return w;
      return {
        ...w,
        sessions: w.sessions.map(s => ({
          ...s,
          sets: Math.max(1, s.sets - 1),
          targetRPE: Math.max(6, s.targetRPE - 0.5),
        })),
      };
    });
    return {
      action: 'soften',
      adjustedMeso: { ...meso, weeks: adjustedWeeks },
      message: 'Давно не тренировались, начинаем мягче',
    };
  }

  // 11-14 days (missed 2+ weeks)
  if (daysSinceLastSession <= 14) {
    // Go back one week
    const newWeek = Math.max(1, meso.currentWeek - 1);
    return {
      action: 'soften',
      adjustedMeso: { ...meso, currentWeek: newWeek, currentSession: 1 },
      message: 'Пропущено 2+ недели, повторяем прошлую рабочую неделю',
    };
  }

  // 14+ days: restart mesocycle
  return {
    action: 'restart',
    message: 'Длинный перерыв — начинаем новый цикл',
  };
}

/**
 * Adapt mesocycle around a vacation period.
 * Per spec section 6.5.
 */
export function adaptMesocycleForVacation(
  meso: Mesocycle,
  exercise: ExerciseConfig,
  vacation: VacationPeriod,
  trainingAgeMonths: number,
  sessionsPerWeek: number,
): { updatedMeso: Mesocycle; newMeso?: Mesocycle; message: string } {
  const vacStart = new Date(vacation.startDate);
  const vacEnd = new Date(vacation.endDate);
  const vacDays = Math.ceil((vacEnd.getTime() - vacStart.getTime()) / (1000 * 60 * 60 * 24));

  // <= 7 days: replace vacation week with deload
  if (vacDays <= 7) {
    const updatedWeeks = meso.weeks.map(w => {
      if (w.weekNumber !== meso.currentWeek) return w;
      return {
        ...w,
        weekType: 'deload' as const,
        targetSets: exercise.volumeLandmarks.mv,
        intensityZone: 'light' as const,
        targetRPE: 5.5,
        sessions: w.sessions.map(s => ({
          ...s,
          sets: Math.max(1, Math.round(exercise.volumeLandmarks.mv * 0.5)),
          targetRPE: 5,
          intensityPercent: 0.45,
        })),
      };
    });
    return {
      updatedMeso: { ...meso, weeks: updatedWeeks },
      message: 'Отпуск совпадает с разгрузочной неделей — отличное время!',
    };
  }

  // 8-14 days: deload + pause, then go back one week
  if (vacDays <= 14) {
    const newWeek = Math.max(1, meso.currentWeek - 1);
    return {
      updatedMeso: { ...meso, currentWeek: newWeek, currentSession: 1 },
      message: 'Возвращаемся мягко — повторяем прошлую рабочую неделю',
    };
  }

  // > 14 days: end mesocycle, start new one
  const updatedMeso: Mesocycle = { ...meso, status: 'completed', endDate: new Date().toISOString() };
  const newMeso = generateMesocycle(exercise, trainingAgeMonths, sessionsPerWeek);

  return {
    updatedMeso,
    newMeso,
    message: 'Длинный перерыв — начинаем новый цикл с нуля',
  };
}
