import { v4 as uuid } from 'uuid';
import type { ExerciseConfig, Mesocycle, WeekPlan, SessionPlan, TrainingLevel, WeekType, LoadConfig } from '../types';
import { getTrainingLevel } from '../types';
import { MESOCYCLE_WEEKS, INTENSITY_ZONES } from './constants';

function getWeekTypes(workingWeeks: number): WeekType[] {
  if (workingWeeks === 6) return ['accumulation', 'accumulation', 'intensification', 'accumulation', 'intensification', 'deload'];
  if (workingWeeks === 5) return ['accumulation', 'intensification', 'accumulation', 'intensification', 'deload'];
  if (workingWeeks === 4) return ['accumulation', 'intensification', 'accumulation', 'deload'];
  if (workingWeeks === 3) return ['accumulation', 'intensification', 'deload'];
  return ['accumulation', 'intensification', 'accumulation', 'intensification', 'deload'];
}

function getIntensityPercent(zone: 'light' | 'medium' | 'heavy' | 'peak'): number {
  const z = INTENSITY_ZONES[zone];
  return (z.min + z.max) / 2;
}

function weekTypeToZone(wt: WeekType): 'light' | 'medium' | 'heavy' | 'peak' {
  if (wt === 'deload') return 'light';
  if (wt === 'accumulation') return 'medium';
  if (wt === 'intensification') return 'heavy';
  return 'peak';
}

function buildLoadConfig(exercise: ExerciseConfig, sessionType: 'heavy' | 'light', _targetReps: number): LoadConfig {
  if (exercise.type === 'dumbbell') {
    const w = exercise.availableWeights ?? [];
    const currentWeight = exercise.currentWeight ?? (w.length > 0 ? w[Math.floor(w.length / 2)] : 20);
    return { weight: currentWeight, repRange: [6, 10] as [number, number] };
  }
  // bodyweight
  const phase = exercise.progressionPhase ?? 1;
  if (sessionType === 'light' || phase <= 1) {
    return { mode: 'band_assisted' as const, bandAssistPercent: exercise.assistOptions?.bandAssistPercent ?? 30 };
  }
  if (phase >= 4) {
    return { mode: 'bodyweight' as const };
  }
  if (sessionType === 'heavy') {
    return { mode: 'bodyweight' as const };
  }
  return { mode: 'band_assisted' as const, bandAssistPercent: exercise.assistOptions?.bandAssistPercent ?? 30 };
}

export function generateMesocycle(exercise: ExerciseConfig, trainingAgeMonths: number, sessionsPerWeek: number): Mesocycle {
  const level: TrainingLevel = getTrainingLevel(trainingAgeMonths);
  const config = MESOCYCLE_WEEKS[level];
  const totalWeeks = config.total;
  const weekTypes = getWeekTypes(totalWeeks);

  const weeks: WeekPlan[] = weekTypes.map((wt, i) => {
    const zone = weekTypeToZone(wt);
    const baseIntensity = getIntensityPercent(zone);
    const isDeload = wt === 'deload';
    const weekNumber = i + 1;

    // Volume progression within mesocycle
    const accumulationCount = weekTypes.slice(0, i).filter(t => t === 'accumulation').length;
    const volumeBoost = Math.min(accumulationCount, 2) * 2;
    const targetSets = isDeload ? exercise.volumeLandmarks.mv : exercise.volumeLandmarks.mev + volumeBoost;
    const clampedSets = Math.min(targetSets, exercise.volumeLandmarks.mrv);

    const repMax = exercise.type === 'bodyweight'
      ? (exercise.repMaxAssisted ?? exercise.repMax)
      : exercise.repMax;
    const baseReps = Math.max(1, Math.round(repMax * baseIntensity));
    const targetRPE = isDeload ? 5.5 : (zone === 'heavy' ? 8 : 7);

    const sessions: SessionPlan[] = [];
    const numSessions = Math.min(sessionsPerWeek, 2);

    if (numSessions >= 2) {
      const heavySets = Math.max(1, Math.round(clampedSets * 0.45));
      const lightSets = clampedSets - heavySets;
      const heavyIntensity = Math.min(baseIntensity + 0.10, 0.95);
      const lightIntensity = Math.max(baseIntensity - 0.10, 0.40);

      sessions.push({
        sessionNumber: 1,
        sets: heavySets,
        reps: Math.max(1, Math.round(repMax * heavyIntensity)),
        targetRPE: isDeload ? 5 : Math.min(targetRPE + 0.5, 9),
        sessionType: 'heavy',
        loadConfig: buildLoadConfig(exercise, 'heavy', Math.round(repMax * heavyIntensity)),
        intensityPercent: heavyIntensity,
      });
      sessions.push({
        sessionNumber: 2,
        sets: lightSets,
        reps: Math.max(1, Math.round(repMax * lightIntensity)),
        targetRPE: isDeload ? 5 : Math.max(targetRPE - 0.5, 6),
        sessionType: 'light',
        loadConfig: buildLoadConfig(exercise, 'light', Math.round(repMax * lightIntensity)),
        intensityPercent: lightIntensity,
      });
    } else {
      sessions.push({
        sessionNumber: 1,
        sets: clampedSets,
        reps: baseReps,
        targetRPE,
        sessionType: 'heavy',
        loadConfig: buildLoadConfig(exercise, 'heavy', baseReps),
        intensityPercent: baseIntensity,
      });
    }

    return {
      weekNumber,
      weekType: wt,
      targetSets: clampedSets,
      intensityZone: zone,
      targetRPE,
      sessions,
    };
  });

  return {
    id: uuid(),
    exerciseId: exercise.id,
    startDate: new Date().toISOString(),
    durationWeeks: totalWeeks,
    status: 'active',
    weeks,
    currentWeek: 1,
    currentSession: 1,
  };
}
