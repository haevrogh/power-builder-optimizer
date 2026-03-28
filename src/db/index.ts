import Dexie, { type Table } from 'dexie';
import type { UserProfile, ExerciseConfig, Mesocycle, SessionLog, VacationPeriod } from '../types';

class VolumeOptimizerDB extends Dexie {
  users!: Table<UserProfile, string>;
  exercises!: Table<ExerciseConfig, string>;
  mesocycles!: Table<Mesocycle, string>;
  sessionLogs!: Table<SessionLog, string>;
  vacations!: Table<VacationPeriod, string>;

  constructor() {
    super('VolumeOptimizerDB');
    this.version(1).stores({
      users: 'id',
      exercises: 'id, muscleGroup, type',
      mesocycles: 'id, exerciseId, status, startDate',
      sessionLogs: 'id, exerciseId, date, mesocycleId',
      vacations: 'id, startDate, endDate',
    });
  }
}

export const db = new VolumeOptimizerDB();
