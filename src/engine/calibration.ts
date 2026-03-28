import type { ExerciseConfig, SessionLog, VolumeLandmarks } from '../types';

/**
 * Recalibrate volume landmarks based on training history.
 * Should run every 2 mesocycles or after each deload.
 * Requires minimum 6 weeks of data.
 */
export function recalibrateVolumeLandmarks(
  current: VolumeLandmarks,
  sessionLogs: SessionLog[],
): VolumeLandmarks {
  // Need minimum data
  if (sessionLogs.length < 6) return current;

  // Group by week and compute average performance score per volume level
  const weeklyData: { sets: number; avgScore: number }[] = [];
  const weekMap = new Map<string, { sets: number[]; scores: number[] }>();

  for (const log of sessionLogs) {
    const weekKey = `${log.mesocycleId}-${log.weekNumber}`;
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, { sets: [], scores: [] });
    const entry = weekMap.get(weekKey)!;
    entry.sets.push(log.sets.length);
    entry.scores.push(log.performanceScore ?? 0);
  }

  for (const entry of weekMap.values()) {
    const totalSets = entry.sets.reduce((a, b) => a + b, 0);
    const avgScore = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
    weeklyData.push({ sets: totalSets, avgScore });
  }

  if (weeklyData.length < 3) return current;

  // MEV = minimum volume where score > 0 consistently
  const positiveWeeks = weeklyData.filter(d => d.avgScore > 0);
  const calculatedMEV = positiveWeeks.length > 0
    ? Math.min(...positiveWeeks.map(d => d.sets))
    : current.mev;

  // MAV = volume with highest average score
  const sortedByScore = [...weeklyData].sort((a, b) => b.avgScore - a.avgScore);
  const calculatedMAV = sortedByScore[0]?.sets ?? current.mav;

  // MRV = volume after which score drops below 0
  const negativeWeeks = weeklyData.filter(d => d.avgScore < 0);
  const calculatedMRV = negativeWeeks.length > 0
    ? Math.min(...negativeWeeks.map(d => d.sets))
    : current.mrv;

  // Safety: MEV < MAV < MRV
  let mev = calculatedMEV;
  let mav = calculatedMAV;
  let mrv = calculatedMRV;

  if (mev > mav) mev = Math.min(current.mev, mev);
  if (mav > mrv) mav = current.mav;

  // Clamp changes to ±2 per calibration
  return {
    mv: Math.max(3, clamp(Math.max(4, mev - 2), current.mv - 2, current.mv + 2)),
    mev: Math.max(4, clamp(mev, current.mev - 2, current.mev + 2)),
    mav: Math.max(6, clamp(mav, current.mav - 2, current.mav + 2)),
    mrv: Math.max(10, clamp(mrv, current.mrv - 2, current.mrv + 2)),
    lastCalibrated: new Date(),
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Pullup phase transition using sliding window.
 * Returns the phase the athlete should be in based on recent performance.
 */
export function evaluatePullupPhase(
  exercise: ExerciseConfig,
  sessionLogs: SessionLog[],
): 1 | 2 | 3 | 4 {
  if (exercise.type !== 'bodyweight') return 4;

  const recentLogs = sessionLogs
    .filter(l => l.exerciseId === exercise.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentPhase = exercise.progressionPhase ?? 1;
  const maxBW = exercise.repMax;

  // Phase 1 → 2: 3 out of last 5 sessions achieved 4×10 band RPE ≤ 8
  if (currentPhase === 1) {
    const last5 = recentLogs.slice(0, 5);
    const qualifying = last5.filter(log => {
      const totalReps = log.sets.reduce((s, c) => s + c.reps, 0);
      const avgRPE = log.sets.reduce((s, c) => s + c.rpe, 0) / log.sets.length;
      return totalReps >= 40 && avgRPE <= 8;
    });
    if (qualifying.length >= 3) return 2;
    return 1;
  }

  // Phase 2 → 3: maxBW >= 5 in 2 out of last 3 tests
  if (currentPhase === 2) {
    if (maxBW >= 5) {
      const last3 = recentLogs.slice(0, 3);
      const bwSessions = last3.filter(log =>
        log.sets.some(s => 'mode' in s.loadConfig && s.loadConfig.mode === 'bodyweight')
      );
      const qualifying = bwSessions.filter(log => {
        const bwSets = log.sets.filter(s => 'mode' in s.loadConfig && s.loadConfig.mode === 'bodyweight');
        return bwSets.some(s => s.reps >= 5);
      });
      if (qualifying.length >= 2) return 3;
    }
    // Rollback check: if maxBW drops below 3 in 3+ of last 5
    const last5 = recentLogs.slice(0, 5);
    const failCount = last5.filter(log => {
      const bwSets = log.sets.filter(s => 'mode' in s.loadConfig && s.loadConfig.mode === 'bodyweight');
      return bwSets.length > 0 && bwSets.every(s => s.reps < 3);
    });
    if (failCount.length >= 3) return 1;
    return 2;
  }

  // Phase 3 → 4: maxBW >= 8 in 2 out of last 3 tests
  if (currentPhase === 3) {
    if (maxBW >= 8) {
      const last3 = recentLogs.slice(0, 3);
      const qualifying = last3.filter(log => {
        const bwSets = log.sets.filter(s => 'mode' in s.loadConfig && s.loadConfig.mode === 'bodyweight');
        return bwSets.some(s => s.reps >= 8);
      });
      if (qualifying.length >= 2) return 4;
    }
    // Rollback
    const last5 = recentLogs.slice(0, 5);
    const failCount = last5.filter(log => {
      const bwSets = log.sets.filter(s => 'mode' in s.loadConfig && s.loadConfig.mode === 'bodyweight');
      return bwSets.length > 0 && bwSets.every(s => s.reps < 5);
    });
    if (failCount.length >= 3) return 2;
    return 3;
  }

  return 4;
}
