import type { TrainingLevel, VolumeLandmarks } from '../types';

export const DEFAULT_LANDMARKS: Record<TrainingLevel, VolumeLandmarks> = {
  absolute_beginner: { mv: 3, mev: 4, mav: 8, mrv: 12 },
  beginner: { mv: 4, mev: 6, mav: 12, mrv: 16 },
  intermediate_early: { mv: 5, mev: 8, mav: 14, mrv: 20 },
  intermediate_late: { mv: 6, mev: 10, mav: 16, mrv: 22 },
  advanced: { mv: 8, mev: 12, mav: 20, mrv: 26 },
};

export const MESOCYCLE_WEEKS: Record<TrainingLevel, { working: number; total: number }> = {
  absolute_beginner: { working: 6, total: 7 },
  beginner: { working: 5, total: 6 },
  intermediate_early: { working: 4, total: 5 },
  intermediate_late: { working: 4, total: 5 },
  advanced: { working: 3, total: 4 },
};

export const PROGRESSION_COEFFICIENTS: Record<TrainingLevel, number> = {
  absolute_beginner: 0.015,
  beginner: 0.01,
  intermediate_early: 0.0075,
  intermediate_late: 0.005,
  advanced: 0.0025,
};

export const MAX_PROGRESSION: Record<TrainingLevel, number> = {
  absolute_beginner: 0.02,
  beginner: 0.015,
  intermediate_early: 0.01,
  intermediate_late: 0.0075,
  advanced: 0.005,
};

export const INTENSITY_ZONES = {
  light: { min: 0.40, max: 0.55 },
  medium: { min: 0.55, max: 0.70 },
  heavy: { min: 0.70, max: 0.85 },
  peak: { min: 0.85, max: 0.95 },
} as const;

export const REST_TIMES: Record<string, number> = {
  heavy: 180,
  light: 120,
  deload: 90,
};

export const DEFAULT_DUMBBELL_WEIGHTS = [5, 7, 9, 11, 13, 15, 18, 20, 22, 25, 27, 29, 32, 34, 36, 38, 40];
