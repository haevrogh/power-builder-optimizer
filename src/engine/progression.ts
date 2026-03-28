import type { ExerciseConfig } from '../types';

export function getNextDumbbellWeight(exercise: ExerciseConfig, currentMaxReps: number, targetRange: [number, number]): { weight: number; repRange: [number, number] } {
  const weights = exercise.availableWeights ?? [];
  if (weights.length === 0) return { weight: 0, repRange: targetRange };

  const currentIdx = weights.findIndex(w => {
    const lc = exercise.type === 'dumbbell' ? exercise.repMax : 0;
    return w >= lc;
  });
  const currentWeight = currentIdx >= 0 ? weights[currentIdx] : weights[0];

  if (currentMaxReps >= targetRange[1]) {
    const nextIdx = weights.findIndex(w => w > currentWeight);
    if (nextIdx === -1) return { weight: currentWeight, repRange: targetRange };

    const nextWeight = weights[nextIdx];
    const jumpPercent = ((nextWeight - currentWeight) / currentWeight) * 100;

    let newRange: [number, number] = [...targetRange];
    if (jumpPercent > 20) {
      newRange = [Math.max(3, targetRange[0] - 2), targetRange[1]];
    }
    return { weight: nextWeight, repRange: newRange };
  }

  if (currentMaxReps < targetRange[0]) {
    const prevIdx = weights.findLastIndex(w => w < currentWeight);
    if (prevIdx === -1) return { weight: currentWeight, repRange: targetRange };
    return { weight: weights[prevIdx], repRange: targetRange };
  }

  return { weight: currentWeight, repRange: targetRange };
}

export function getPullupPhase(exercise: ExerciseConfig): 1 | 2 | 3 | 4 {
  if (exercise.type !== 'bodyweight') return 4;
  const maxBW = exercise.repMax;
  if (maxBW < 3) return 1;
  if (maxBW < 5) return 2;
  if (maxBW < 8) return 3;
  return 4;
}

export function adjustLandmarksForBodyweight(
  defaults: { mv: number; mev: number; mav: number; mrv: number },
  bodyweight: number,
  currentMaxReps: number,
): { mv: number; mev: number; mav: number; mrv: number } {
  let difficultyFactor = 1.0;
  if (bodyweight > 100) difficultyFactor = 0.75;
  else if (bodyweight > 85) difficultyFactor = 0.85;

  if (currentMaxReps <= 3) difficultyFactor *= 0.8;

  return {
    mv: Math.max(3, Math.round(defaults.mv * difficultyFactor)),
    mev: Math.max(4, Math.round(defaults.mev * difficultyFactor)),
    mav: Math.max(6, Math.round(defaults.mav * difficultyFactor)),
    mrv: Math.max(10, Math.round(defaults.mrv * difficultyFactor)),
  };
}
