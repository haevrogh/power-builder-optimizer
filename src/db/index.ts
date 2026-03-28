import Dexie, { type Table } from 'dexie';
import type { UserProfile, ExerciseConfig, Mesocycle, SessionLog, VacationPeriod, PreWorkoutCheckin, TrainingProgram, ProgramSessionLog } from '../types';

class VolumeOptimizerDB extends Dexie {
  users!: Table<UserProfile, string>;
  exercises!: Table<ExerciseConfig, string>;
  mesocycles!: Table<Mesocycle, string>;
  sessionLogs!: Table<SessionLog, string>;
  vacations!: Table<VacationPeriod, string>;
  precheckins!: Table<PreWorkoutCheckin, string>;
  programs!: Table<TrainingProgram, string>;
  programSessions!: Table<ProgramSessionLog, string>;

  constructor() {
    super('VolumeOptimizerDB');
    this.version(1).stores({
      users: 'id',
      exercises: 'id, muscleGroup, type',
      mesocycles: 'id, exerciseId, status, startDate',
      sessionLogs: 'id, exerciseId, date, mesocycleId',
      vacations: 'id, startDate, endDate',
    });
    this.version(2).stores({
      users: 'id',
      exercises: 'id, muscleGroup, type',
      mesocycles: 'id, exerciseId, status, startDate',
      sessionLogs: 'id, exerciseId, date, mesocycleId',
      vacations: 'id, startDate, endDate',
      precheckins: 'id, date',
    });
    this.version(3).stores({
      users: 'id',
      exercises: 'id, muscleGroup, type',
      mesocycles: 'id, exerciseId, status, startDate',
      sessionLogs: 'id, exerciseId, date, mesocycleId',
      vacations: 'id, startDate, endDate',
      precheckins: 'id, date',
      programs: 'id, isActive',
      programSessions: 'id, programId, date',
    });
  }
}

export const db = new VolumeOptimizerDB();
