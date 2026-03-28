import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { UserProfile, ExerciseConfig, Mesocycle, SessionLog, VacationPeriod } from '../types';
import { getTrainingLevel } from '../types';
import { generateMesocycle } from '../engine/mesocycle';
import { processSessionResult } from '../engine/autoregulation';
import { evaluatePullupPhase, recalibrateVolumeLandmarks } from '../engine/calibration';
import { handleMissedSessions } from '../engine/vacation';
import { DEFAULT_LANDMARKS, PROGRESSION_COEFFICIENTS } from '../engine/constants';
import { getPullupPhase, adjustLandmarksForBodyweight } from '../engine/progression';

interface AppState {
  user: UserProfile | null;
  exercises: ExerciseConfig[];
  mesocycles: Mesocycle[];
  sessionLogs: SessionLog[];
  vacations: VacationPeriod[];
  activeView: 'training' | 'progress' | 'settings';
  isOnboarding: boolean;
  activeTrainingSession: { exerciseId: string; mesocycleId: string; weekNumber: number; sessionNumber: number } | null;

  // Actions
  init: () => Promise<void>;
  setActiveView: (view: 'training' | 'progress' | 'settings') => void;
  saveUser: (profile: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<void>;
  addExercise: (config: Omit<ExerciseConfig, 'id' | 'progressionCoefficient' | 'volumeLandmarks'>) => Promise<void>;
  updateExercise: (exercise: ExerciseConfig) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  startMesocycle: (exerciseId: string) => Promise<void>;
  startTrainingSession: (exerciseId: string) => void;
  logSession: (log: Omit<SessionLog, 'id' | 'performanceScore' | 'volumeAdjustment'>) => Promise<{ score: number; decision: string; reason: string }>;
  addVacation: (vacation: Omit<VacationPeriod, 'id'>) => Promise<void>;
  deleteVacation: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  exercises: [],
  mesocycles: [],
  sessionLogs: [],
  vacations: [],
  activeView: 'training',
  isOnboarding: true,
  activeTrainingSession: null,

  init: async () => {
    const users = await db.users.toArray();
    const exercises = await db.exercises.toArray();
    const mesocycles = await db.mesocycles.toArray();
    const sessionLogs = await db.sessionLogs.toArray();
    const vacations = await db.vacations.toArray();

    set({
      user: users[0] ?? null,
      exercises,
      mesocycles,
      sessionLogs,
      vacations,
      isOnboarding: !users[0],
    });

    // Check for missed sessions
    const activeMesos = mesocycles.filter(m => m.status === 'active');
    for (const meso of activeMesos) {
      const ex = exercises.find(e => e.id === meso.exerciseId);
      const logs = sessionLogs.filter(l => l.mesocycleId === meso.id);
      const lastLog = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (ex && lastLog) {
        const result = handleMissedSessions(meso, ex, lastLog.date);
        if (result.action === 'soften' && result.adjustedMeso) {
          await db.mesocycles.put(result.adjustedMeso);
        }
      }
    }
  },

  setActiveView: (view) => set({ activeView: view }),

  saveUser: async (profile) => {
    const existing = get().user;
    const user: UserProfile = {
      ...profile,
      id: existing?.id ?? uuid(),
      createdAt: existing?.createdAt ?? new Date(),
    };
    await db.users.put(user);
    set({ user, isOnboarding: false });
  },

  addExercise: async (config) => {
    const user = get().user;
    if (!user) return;

    const level = getTrainingLevel(user.trainingAgeMonths);
    let landmarks = { ...DEFAULT_LANDMARKS[level] };

    if (config.type === 'bodyweight' && user.bodyweight > 85) {
      landmarks = adjustLandmarksForBodyweight(landmarks, user.bodyweight, config.repMax);
    }

    const exercise: ExerciseConfig = {
      ...config,
      id: uuid(),
      progressionCoefficient: PROGRESSION_COEFFICIENTS[level],
      volumeLandmarks: { ...landmarks, lastCalibrated: new Date() },
      progressionPhase: config.type === 'bodyweight' ? getPullupPhase({ ...config, id: '', progressionCoefficient: 0, volumeLandmarks: landmarks } as ExerciseConfig) : undefined,
    };

    await db.exercises.put(exercise);
    set(s => ({ exercises: [...s.exercises, exercise] }));

    // Auto-generate first mesocycle
    const meso = generateMesocycle(exercise, user.trainingAgeMonths, user.sessionsPerWeek);
    await db.mesocycles.put(meso);
    set(s => ({ mesocycles: [...s.mesocycles, meso] }));
  },

  updateExercise: async (exercise) => {
    await db.exercises.put(exercise);
    set(s => ({ exercises: s.exercises.map(e => e.id === exercise.id ? exercise : e) }));
  },

  deleteExercise: async (id) => {
    await db.exercises.delete(id);
    set(s => ({ exercises: s.exercises.filter(e => e.id !== id) }));
  },

  startMesocycle: async (exerciseId) => {
    const user = get().user;
    const exercise = get().exercises.find(e => e.id === exerciseId);
    if (!user || !exercise) return;

    const meso = generateMesocycle(exercise, user.trainingAgeMonths, user.sessionsPerWeek);
    await db.mesocycles.put(meso);
    set(s => ({ mesocycles: [...s.mesocycles, meso] }));
  },

  startTrainingSession: (exerciseId) => {
    const meso = get().mesocycles.find(m => m.exerciseId === exerciseId && m.status === 'active');
    if (!meso) return;

    set({
      activeTrainingSession: {
        exerciseId,
        mesocycleId: meso.id,
        weekNumber: meso.currentWeek,
        sessionNumber: meso.currentSession,
      },
    });
  },

  logSession: async (logData) => {
    const user = get().user;
    if (!user) return { score: 0, decision: 'hold', reason: '' };

    const exercise = get().exercises.find(e => e.id === logData.exerciseId);
    const meso = get().mesocycles.find(m => m.id === logData.mesocycleId);
    if (!exercise || !meso) return { score: 0, decision: 'hold', reason: '' };

    const week = meso.weeks.find(w => w.weekNumber === logData.weekNumber);
    const plan = week?.sessions.find(s => s.sessionNumber === logData.sessionNumber);
    if (!plan) return { score: 0, decision: 'hold', reason: '' };

    const { updatedExercise, updatedMesocycle, adjustment } = processSessionResult(
      { ...logData, id: '', performanceScore: 0 } as SessionLog,
      plan,
      exercise,
      meso,
      user.trainingAgeMonths,
    );

    // Evaluate pullup phase transition
    if (updatedExercise.type === 'bodyweight') {
      const allLogs = [...get().sessionLogs, { ...logData, id: '', performanceScore: 0, volumeAdjustment: adjustment } as SessionLog];
      const newPhase = evaluatePullupPhase(updatedExercise, allLogs);
      if (newPhase !== updatedExercise.progressionPhase) {
        updatedExercise.progressionPhase = newPhase;
      }
    }

    const score = adjustment.setsChange >= 2 ? 3 : adjustment.setsChange > 0 ? 2 : adjustment.setsChange === 0 ? 1 : -1;

    const sessionLog: SessionLog = {
      ...logData,
      id: uuid(),
      performanceScore: score,
      volumeAdjustment: adjustment,
    };

    // Advance session/week counters
    let newWeek = meso.currentWeek;
    let newSession = meso.currentSession + 1;
    const maxSessions = week?.sessions.length ?? 2;
    if (newSession > maxSessions) {
      newSession = 1;
      newWeek += 1;
    }
    const finalMeso: Mesocycle = {
      ...updatedMesocycle,
      currentWeek: newWeek,
      currentSession: newSession,
      status: newWeek > meso.durationWeeks ? 'completed' : updatedMesocycle.status,
    };

    await Promise.all([
      db.sessionLogs.put(sessionLog),
      db.exercises.put(updatedExercise),
      db.mesocycles.put(finalMeso),
    ]);

    set(s => ({
      sessionLogs: [...s.sessionLogs, sessionLog],
      exercises: s.exercises.map(e => e.id === updatedExercise.id ? updatedExercise : e),
      mesocycles: s.mesocycles.map(m => m.id === finalMeso.id ? finalMeso : m),
      activeTrainingSession: null,
    }));

    // If mesocycle completed, auto-generate next one
    if (finalMeso.status === 'completed') {
      // Recalibrate landmarks
      const allLogs = get().sessionLogs.filter(l => l.exerciseId === updatedExercise.id);
      const newLandmarks = recalibrateVolumeLandmarks(updatedExercise.volumeLandmarks, allLogs);
      if (newLandmarks !== updatedExercise.volumeLandmarks) {
        const recalibratedExercise = { ...updatedExercise, volumeLandmarks: newLandmarks };
        await db.exercises.put(recalibratedExercise);
        set(s => ({ exercises: s.exercises.map(e => e.id === recalibratedExercise.id ? recalibratedExercise : e) }));
      }

      const nextMeso = generateMesocycle(updatedExercise, user.trainingAgeMonths, user.sessionsPerWeek);
      await db.mesocycles.put(nextMeso);
      set(s => ({ mesocycles: [...s.mesocycles, nextMeso] }));
    }

    return { score, decision: adjustment.decision, reason: adjustment.reason };
  },

  addVacation: async (vacation) => {
    const v: VacationPeriod = { ...vacation, id: uuid() };
    await db.vacations.put(v);
    set(s => ({ vacations: [...s.vacations, v] }));
  },

  deleteVacation: async (id) => {
    await db.vacations.delete(id);
    set(s => ({ vacations: s.vacations.filter(v => v.id !== id) }));
  },
}));
