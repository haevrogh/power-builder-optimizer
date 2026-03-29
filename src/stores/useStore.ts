import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type {
  UserProfile, ExerciseConfig, Mesocycle, SessionLog, VacationPeriod,
  PreWorkoutCheckin, SessionPlan, TrainingProgram, ExerciseSessionEntry,
} from '../types';
import { getTrainingLevel } from '../types';
import { generateMesocycle } from '../engine/mesocycle';
import { processSessionResult } from '../engine/autoregulation';
import { evaluatePullupPhase, recalibrateVolumeLandmarks } from '../engine/calibration';
import { handleMissedSessions } from '../engine/vacation';
import { calculatePerformanceScore, getDecisionFromScore, countConsecutiveHolds } from '../engine/scoring';
import { DEFAULT_LANDMARKS, PROGRESSION_COEFFICIENTS } from '../engine/constants';
import { getPullupPhase, adjustLandmarksForBodyweight } from '../engine/progression';

interface ActiveSession {
  // Program-based session
  programId?: string;
  // Legacy single exercise (fallback)
  exerciseId?: string;
  mesocycleId?: string;
  weekNumber?: number;
  sessionNumber?: number;
  // Common
  preCheckinId: string;
  usedAdjustedPlan: boolean;
  adjustedPlan?: SessionPlan;
  adjustedPlans?: Record<string, SessionPlan>;
  readinessScore: number;
}

interface AppState {
  user: UserProfile | null;
  exercises: ExerciseConfig[];
  mesocycles: Mesocycle[];
  sessionLogs: SessionLog[];
  vacations: VacationPeriod[];
  programs: TrainingProgram[];
  activeView: 'training' | 'progress' | 'settings';
  isOnboarding: boolean;
  activeTrainingSession: ActiveSession | null;
  showPreCheckin: { programId?: string; exerciseId?: string } | null;

  init: () => Promise<void>;
  setActiveView: (view: 'training' | 'progress' | 'settings') => void;
  saveUser: (profile: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<void>;
  addExercise: (config: Omit<ExerciseConfig, 'id' | 'progressionCoefficient' | 'volumeLandmarks'>) => Promise<void>;
  updateExercise: (exercise: ExerciseConfig) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  startMesocycle: (exerciseId: string) => Promise<void>;

  // Program management
  createProgram: (name: string, exerciseIds: string[]) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;
  setActiveProgram: (id: string) => Promise<void>;

  // Training flow
  beginPreCheckin: (programIdOrExerciseId: string) => void;
  startTrainingSession: (id: string, checkin: Omit<PreWorkoutCheckin, 'id' | 'date'>, adjustedPlan: SessionPlan, usedAdjustedPlan: boolean) => Promise<void>;
  skipTraining: () => void;
  logSession: (log: Omit<SessionLog, 'id' | 'performanceScore' | 'volumeAdjustment'>) => Promise<{ score: number; decision: string; reason: string }>;
  logProgramSession: (data: { programId: string; preCheckinId: string; exerciseLogs: ExerciseSessionEntry[] }) => Promise<void>;

  addVacation: (vacation: Omit<VacationPeriod, 'id'>) => Promise<void>;
  deleteVacation: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  exercises: [],
  mesocycles: [],
  sessionLogs: [],
  vacations: [],
  programs: [],
  activeView: 'training',
  isOnboarding: true,
  activeTrainingSession: null,
  showPreCheckin: null,

  init: async () => {
    const users = await db.users.toArray();
    const exercises = await db.exercises.toArray();
    const mesocycles = await db.mesocycles.toArray();
    const sessionLogs = await db.sessionLogs.toArray();
    const vacations = await db.vacations.toArray();
    const programs = await db.programs.toArray();

    set({
      user: users[0] ?? null,
      exercises,
      mesocycles,
      sessionLogs,
      vacations,
      programs,
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

    // Generate mesocycle for the exercise
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

  // ─── Program management ───

  createProgram: async (name, exerciseIds) => {
    const user = get().user;
    if (!user) return;

    const prog: TrainingProgram = {
      id: uuid(),
      name,
      exerciseIds,
      sessionsPerWeek: user.sessionsPerWeek,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // Deactivate other programs
    const oldProgs = get().programs.filter(p => p.isActive);
    for (const p of oldProgs) {
      const updated = { ...p, isActive: false };
      await db.programs.put(updated);
    }

    await db.programs.put(prog);

    // Ensure all exercises in program have active mesocycles
    for (const exId of exerciseIds) {
      const hasMeso = get().mesocycles.some(m => m.exerciseId === exId && m.status === 'active');
      if (!hasMeso) {
        const ex = get().exercises.find(e => e.id === exId);
        if (ex) {
          const meso = generateMesocycle(ex, user.trainingAgeMonths, user.sessionsPerWeek);
          await db.mesocycles.put(meso);
          set(s => ({ mesocycles: [...s.mesocycles, meso] }));
        }
      }
    }

    set(s => ({
      programs: [...s.programs.map(p => ({ ...p, isActive: false })), prog],
    }));
  },

  deleteProgram: async (id) => {
    await db.programs.delete(id);
    set(s => ({ programs: s.programs.filter(p => p.id !== id) }));
  },

  setActiveProgram: async (id) => {
    const progs = get().programs;
    for (const p of progs) {
      const updated = { ...p, isActive: p.id === id };
      await db.programs.put(updated);
    }
    set(s => ({ programs: s.programs.map(p => ({ ...p, isActive: p.id === id })) }));
  },

  // ─── Training flow ───

  beginPreCheckin: (id) => {
    const prog = get().programs.find(p => p.id === id);
    if (prog) {
      set({ showPreCheckin: { programId: id } });
    } else {
      set({ showPreCheckin: { exerciseId: id } });
    }
  },

  startTrainingSession: async (id, checkinData, adjustedPlan, usedAdjustedPlan) => {
    const checkin: PreWorkoutCheckin = {
      ...checkinData,
      id: uuid(),
      date: new Date().toISOString(),
    };
    await db.precheckins.put(checkin);

    const prog = get().programs.find(p => p.id === id);
    if (prog) {
      // Program-based session
      set({
        showPreCheckin: null,
        activeTrainingSession: {
          programId: prog.id,
          preCheckinId: checkin.id,
          usedAdjustedPlan,
          adjustedPlan,
          readinessScore: checkinData.readinessScore,
        },
      });
    } else {
      // Single exercise session (legacy)
      const meso = get().mesocycles.find(m => m.exerciseId === id && m.status === 'active');
      if (!meso) return;
      set({
        showPreCheckin: null,
        activeTrainingSession: {
          exerciseId: id,
          mesocycleId: meso.id,
          weekNumber: meso.currentWeek,
          sessionNumber: meso.currentSession,
          preCheckinId: checkin.id,
          usedAdjustedPlan,
          adjustedPlan,
          readinessScore: checkinData.readinessScore,
        },
      });
    }
  },

  skipTraining: () => {
    set({ showPreCheckin: null, activeTrainingSession: null });
  },

  // Log a program session (all exercises at once)
  logProgramSession: async (data) => {
    const user = get().user;
    if (!user) return;

    for (const entry of data.exerciseLogs) {
      const exercise = get().exercises.find(e => e.id === entry.exerciseId);
      const meso = get().mesocycles.find(m => m.id === entry.mesocycleId);
      if (!exercise || !meso) continue;

      const week = meso.weeks.find(w => w.weekNumber === meso.currentWeek);
      const plan = week?.sessions.find(s => s.sessionNumber === meso.currentSession);
      if (!plan) continue;

      // Process autoregulation
      const mockLog = {
        id: '', date: new Date().toISOString(), exerciseId: entry.exerciseId,
        mesocycleId: entry.mesocycleId, weekNumber: meso.currentWeek,
        sessionNumber: meso.currentSession, preCheckinId: data.preCheckinId,
        sets: entry.sets, performanceScore: entry.performanceScore,
        usedAdjustedPlan: true,
      } as SessionLog;

      const { updatedExercise, updatedMesocycle } = processSessionResult(
        mockLog, plan, exercise, meso, user.trainingAgeMonths,
      );

      // Evaluate pullup phase
      if (updatedExercise.type === 'bodyweight') {
        const allLogs = get().sessionLogs.filter(l => l.exerciseId === entry.exerciseId);
        const newPhase = evaluatePullupPhase(updatedExercise, [...allLogs, mockLog]);
        if (newPhase !== updatedExercise.progressionPhase) {
          updatedExercise.progressionPhase = newPhase;
        }
      }

      // Save session log
      const sessionLog: SessionLog = {
        ...mockLog,
        id: uuid(),
        volumeAdjustment: { setsChange: 0, rpeChange: 0, decision: entry.decision, reason: entry.reason },
      };

      // Advance counters
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
      }));

      // If mesocycle completed, recalibrate and generate next
      if (finalMeso.status === 'completed') {
        const allLogs = get().sessionLogs.filter(l => l.exerciseId === updatedExercise.id);
        const newLandmarks = recalibrateVolumeLandmarks(updatedExercise.volumeLandmarks, allLogs);
        if (newLandmarks !== updatedExercise.volumeLandmarks) {
          const recal = { ...updatedExercise, volumeLandmarks: newLandmarks };
          await db.exercises.put(recal);
          set(s => ({ exercises: s.exercises.map(e => e.id === recal.id ? recal : e) }));
        }
        const nextMeso = generateMesocycle(updatedExercise, user.trainingAgeMonths, user.sessionsPerWeek);
        await db.mesocycles.put(nextMeso);
        set(s => ({ mesocycles: [...s.mesocycles, nextMeso] }));
      }
    }

    set({ activeTrainingSession: null });
  },

  // Legacy single-exercise log (kept for backward compat)
  logSession: async (logData) => {
    const user = get().user;
    if (!user) return { score: 0, decision: 'hold', reason: '' };

    const exercise = get().exercises.find(e => e.id === logData.exerciseId);
    const meso = get().mesocycles.find(m => m.id === logData.mesocycleId);
    if (!exercise || !meso) return { score: 0, decision: 'hold', reason: '' };

    const week = meso.weeks.find(w => w.weekNumber === logData.weekNumber);
    const plan = week?.sessions.find(s => s.sessionNumber === logData.sessionNumber);
    if (!plan) return { score: 0, decision: 'hold', reason: '' };

    const activeSession = get().activeTrainingSession;
    const effectivePlan = activeSession?.adjustedPlan ?? plan;
    const readinessScore = activeSession?.readinessScore ?? 0;
    const usedAdj = logData.usedAdjustedPlan ?? true;

    const perfScore = calculatePerformanceScore(
      { ...logData, id: '' } as SessionLog, effectivePlan, readinessScore, usedAdj,
    );

    let jointPain = false;
    if (logData.preCheckinId) {
      const checkin = await db.precheckins.get(logData.preCheckinId);
      if (checkin) jointPain = checkin.jointPain;
    }

    const consecutiveHolds = countConsecutiveHolds(get().sessionLogs, exercise.id);
    const decision = getDecisionFromScore(perfScore, jointPain, consecutiveHolds);

    const { updatedExercise, updatedMesocycle, adjustment } = processSessionResult(
      { ...logData, id: '', performanceScore: perfScore } as SessionLog,
      plan, exercise, meso, user.trainingAgeMonths, consecutiveHolds,
    );

    if (updatedExercise.type === 'bodyweight') {
      const allLogs = [...get().sessionLogs, { ...logData, id: '', performanceScore: perfScore, volumeAdjustment: adjustment } as SessionLog];
      const newPhase = evaluatePullupPhase(updatedExercise, allLogs);
      if (newPhase !== updatedExercise.progressionPhase) {
        updatedExercise.progressionPhase = newPhase;
      }
    }

    const sessionLog: SessionLog = {
      ...logData, id: uuid(), performanceScore: perfScore,
      volumeAdjustment: { ...adjustment, decision: decision.decision, reason: decision.reason },
    };

    let newWeek = meso.currentWeek;
    let newSession = meso.currentSession + 1;
    const maxSessions = week?.sessions.length ?? 2;
    if (newSession > maxSessions) { newSession = 1; newWeek += 1; }
    const finalMeso: Mesocycle = {
      ...updatedMesocycle, currentWeek: newWeek, currentSession: newSession,
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

    if (finalMeso.status === 'completed') {
      const allLogs = get().sessionLogs.filter(l => l.exerciseId === updatedExercise.id);
      const newLandmarks = recalibrateVolumeLandmarks(updatedExercise.volumeLandmarks, allLogs);
      if (newLandmarks !== updatedExercise.volumeLandmarks) {
        const recal = { ...updatedExercise, volumeLandmarks: newLandmarks };
        await db.exercises.put(recal);
        set(s => ({ exercises: s.exercises.map(e => e.id === recal.id ? recal : e) }));
      }
      const nextMeso = generateMesocycle(updatedExercise, user.trainingAgeMonths, user.sessionsPerWeek);
      await db.mesocycles.put(nextMeso);
      set(s => ({ mesocycles: [...s.mesocycles, nextMeso] }));
    }

    return { score: perfScore, decision: decision.decision, reason: decision.reason };
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
