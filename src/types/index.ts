export type TrainingLevel = 'absolute_beginner' | 'beginner' | 'intermediate_early' | 'intermediate_late' | 'advanced';
export type MuscleGroup = 'back_lats' | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'core';
export type WeekType = 'accumulation' | 'intensification' | 'peak' | 'deload';
export type SessionType = 'heavy' | 'light';
export type VolumeDecision = 'progress' | 'hold' | 'observe' | 'reduce' | 'unload' | 'deload' | 'stop';

export type FailureReason = 'soreness' | 'sleep' | 'joint_pain' | 'just_hard';

export interface FailureSurveyResponse {
  reason: FailureReason;
  sessionDate: string;
}
export type ExerciseType = 'bodyweight' | 'dumbbell';
export type LoadMode = 'bodyweight' | 'band_assisted' | 'eccentric_only';

export interface UserProfile {
  id: string;
  bodyweight: number;
  height: number;
  age: number;
  trainingAgeMonths: number;
  sessionsPerWeek: number;
  goals: 'strength' | 'hypertrophy' | 'both';
  createdAt: Date;
}

export interface VolumeLandmarks {
  mv: number;
  mev: number;
  mav: number;
  mrv: number;
  lastCalibrated?: Date;
}

export interface ExerciseConfig {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  type: ExerciseType;
  assistOptions?: { hasBand: boolean; bandAssistPercent: number };
  eccentricOption?: boolean;
  availableWeights?: number[];
  currentWeight?: number;
  volumeLandmarks: VolumeLandmarks;
  repMax: number;
  repMaxAssisted?: number;
  repMaxLastUpdated?: Date;
  progressionCoefficient: number;
  progressionPhase?: 1 | 2 | 3 | 4;
}

export interface BodyweightLoadConfig {
  mode: LoadMode;
  bandAssistPercent?: number;
  eccentricSeconds?: number;
}

export interface DumbbellLoadConfig {
  weight: number;
  repRange: [number, number];
}

export type LoadConfig = BodyweightLoadConfig | DumbbellLoadConfig;

export interface SessionPlan {
  sessionNumber: number;
  sets: number;
  reps: number;
  targetRPE: number;
  sessionType: SessionType;
  loadConfig: LoadConfig;
  intensityPercent: number;
}

export interface WeekPlan {
  weekNumber: number;
  weekType: WeekType;
  targetSets: number;
  intensityZone: 'light' | 'medium' | 'heavy' | 'peak';
  targetRPE: number;
  sessions: SessionPlan[];
}

export interface Mesocycle {
  id: string;
  exerciseId: string;
  startDate: string;
  endDate?: string;
  durationWeeks: number;
  status: 'active' | 'completed' | 'deload' | 'paused';
  weeks: WeekPlan[];
  currentWeek: number;
  currentSession: number;
}

export interface SetLog {
  setNumber: number;
  reps: number;
  rpe: number;
  loadConfig: LoadConfig;
  completed: boolean;
  notes?: string;
}

export interface SessionLog {
  id: string;
  date: string;
  exerciseId: string;
  mesocycleId: string;
  weekNumber: number;
  sessionNumber: number;
  preCheckinId: string;
  sets: SetLog[];
  performanceScore?: number;
  volumeAdjustment?: VolumeAdjustment;
  usedAdjustedPlan: boolean;
}

export interface PreWorkoutCheckin {
  id: string;
  date: string;
  sorenessFromPrevious: 0 | 1 | 2 | 3;
  jointPain: boolean;
  jointPainLocation?: string;
  sleepQuality: 1 | 2 | 3;
  readinessScore: number;
  planAdjustment: PlanAdjustment | null;
}

export interface PlanAdjustment {
  intensityChange: number;
  setsChange: number;
  message: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface VolumeAdjustment {
  setsChange: number;
  rpeChange: number;
  decision: VolumeDecision;
  reason: string;
}

export interface VacationPeriod {
  id: string;
  startDate: string;
  endDate: string;
  label?: string;
  partialTraining: boolean;
}

export interface WeeklySnapshot {
  weekStartDate: string;
  totalSets: number;
  totalReps: number;
  avgRPE: number;
  avgPerformanceScore: number;
  mesocycleId: string;
  weekInMesocycle: number;
}

export interface TrainingProgram {
  id: string;
  name: string;
  exerciseIds: string[];          // ordered list
  sessionsPerWeek: number;
  isActive: boolean;
  createdAt: string;
}

// A full session log covering all exercises in a program session
export interface ProgramSessionLog {
  id: string;
  programId: string;
  date: string;
  preCheckinId: string;
  weekNumber: number;
  sessionNumber: number;
  sessionType: SessionType;
  exerciseLogs: ExerciseSessionEntry[];
}

export interface ExerciseSessionEntry {
  exerciseId: string;
  mesocycleId: string;
  sets: SetLog[];
  performanceScore: number;
  decision: VolumeDecision;
  reason: string;
}

export function getTrainingLevel(months: number): TrainingLevel {
  if (months < 6) return 'absolute_beginner';
  if (months < 18) return 'beginner';
  if (months < 36) return 'intermediate_early';
  if (months < 60) return 'intermediate_late';
  return 'advanced';
}
