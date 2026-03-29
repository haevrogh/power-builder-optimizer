import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../stores/useStore';
import type { SetLog, ExerciseSessionEntry } from '../../types';
import { formatLoadConfig, formatTime, formatDecision } from '../../utils/format';
import { REST_TIMES } from '../../engine/constants';
import { calculatePerformanceScore, getDecisionFromScore, countConsecutiveHolds } from '../../engine/scoring';
import ProgressRing from '../common/ProgressRing';
import WeightSelector from '../common/WeightSelector';

export default function ProgramSession() {
  const activeSession = useStore(s => s.activeTrainingSession);
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const programs = useStore(s => s.programs);
  const sessionLogs = useStore(s => s.sessionLogs);
  const logProgramSession = useStore(s => s.logProgramSession);

  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [completedSets, setCompletedSets] = useState<SetLog[]>([]);
  const [exerciseResults, setExerciseResults] = useState<ExerciseSessionEntry[]>([]);
  const [currentReps, setCurrentReps] = useState(0);
  const [currentRPE, setCurrentRPE] = useState(8);
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [rpeNote, setRpeNote] = useState<string | null>(null);
  const [undoSet, setUndoSet] = useState<SetLog | null>(null);
  const undoRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [result, setResult] = useState<{
    entries: ExerciseSessionEntry[];
    totalSets: number;
    totalReps: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer
  useEffect(() => {
    if (!showTimer || timerSeconds <= 0) return;
    const iv = setInterval(() => {
      setTimerSeconds(s => {
        if (s <= 1) { setShowTimer(false); if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50, 50]); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [showTimer, timerSeconds]);

  // Undo timer
  useEffect(() => {
    if (!undoSet) return;
    undoRef.current = setTimeout(() => setUndoSet(null), 5000);
    return () => { if (undoRef.current) clearTimeout(undoRef.current); };
  }, [undoSet]);

  if (!activeSession) return null;

  const program = programs.find(p => p.id === activeSession.programId);
  if (!program) return null;

  const exerciseIds = program.exerciseIds;
  const currentExId = exerciseIds[currentExerciseIdx];
  const exercise = exercises.find(e => e.id === currentExId);
  const meso = mesocycles.find(m => m.exerciseId === currentExId && m.status === 'active');

  if (!exercise || !meso) return null;

  const week = meso.weeks[meso.currentWeek - 1];
  const plan = activeSession.adjustedPlan
    ? activeSession.adjustedPlans?.[currentExId] ?? week?.sessions.find(s => s.sessionNumber === meso.currentSession)
    : week?.sessions.find(s => s.sessionNumber === meso.currentSession);
  if (!plan) return null;

  const currentSetNum = completedSets.length + 1;
  const totalSets = plan.sets;
  const totalExercises = exerciseIds.length;
  const isLastExercise = currentExerciseIdx >= totalExercises - 1;

  // Sync reps target
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { setCurrentReps(plan.reps); }, [plan.reps]);

  const finishCurrentExercise = () => {
    // Calculate score for this exercise
    const mockLog = {
      id: '', date: '', exerciseId: currentExId, mesocycleId: meso.id,
      weekNumber: meso.currentWeek, sessionNumber: meso.currentSession,
      preCheckinId: activeSession.preCheckinId ?? '', sets: completedSets,
      usedAdjustedPlan: activeSession.usedAdjustedPlan ?? true,
    };
    const score = calculatePerformanceScore(
      mockLog as any, plan, activeSession.readinessScore ?? 0, activeSession.usedAdjustedPlan ?? true
    );
    const consecutiveHolds = countConsecutiveHolds(sessionLogs, currentExId);
    const decision = getDecisionFromScore(score, false, consecutiveHolds);

    const entry: ExerciseSessionEntry = {
      exerciseId: currentExId,
      mesocycleId: meso.id,
      sets: [...completedSets],
      performanceScore: score,
      decision: decision.decision,
      reason: decision.reason,
    };

    const newResults = [...exerciseResults, entry];
    setExerciseResults(newResults);
    setCompletedSets([]);
    setRpeNote(null);

    if (isLastExercise) {
      // All exercises done — submit
      submitAll(newResults);
    } else {
      // Move to next exercise
      setCurrentExerciseIdx(i => i + 1);
    }
  };

  const submitAll = async (entries: ExerciseSessionEntry[]) => {
    setIsSubmitting(true);
    try {
      await logProgramSession({
        programId: program.id,
        preCheckinId: activeSession.preCheckinId ?? '',
        exerciseLogs: entries,
      });
      const totalS = entries.reduce((s, e) => s + e.sets.length, 0);
      const totalR = entries.reduce((s, e) => s + e.sets.reduce((ss, st) => ss + st.reps, 0), 0);
      setResult({ entries, totalSets: totalS, totalReps: totalR });
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const recordSet = () => {
    const set: SetLog = {
      setNumber: currentSetNum,
      reps: currentReps,
      rpe: currentRPE,
      loadConfig: plan.loadConfig,
      completed: true,
    };
    setCompletedSets(prev => [...prev, set]);
    setUndoSet(set);
    if (navigator.vibrate) navigator.vibrate(50);

    // RPE note
    const dev = currentRPE - plan.targetRPE;
    if (dev >= 2) setRpeNote('RPE высокий — снизь повторения');
    else if (dev <= -2) setRpeNote('Слишком легко — прибавь');
    else setRpeNote(null);

    if (dev >= 2) setCurrentReps(r => Math.max(1, r - 1));
    else if (dev <= -2) setCurrentReps(r => r + 1);

    if (currentSetNum < totalSets) {
      setTimerSeconds(REST_TIMES[plan.sessionType] ?? 120);
      setShowTimer(true);
    } else {
      finishCurrentExercise();
    }
  };

  const handleUndo = () => {
    if (!undoSet) return;
    setCompletedSets(prev => prev.filter(s => s.setNumber !== undoSet.setNumber));
    setUndoSet(null);
    setShowTimer(false);
    setTimerSeconds(0);
    setRpeNote(null);
  };

  const handleBack = () => {
    useStore.setState({ activeTrainingSession: null });
  };

  // === RESULT ===
  if (result) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8 animate-fade-in">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-center mb-4">Тренировка завершена!</h1>

        <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="font-[family-name:var(--font-data)] text-2xl">{result.totalSets}</div>
              <div className="text-xs text-[var(--color-on-surface-variant)]">подходов</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-data)] text-2xl">{result.totalReps}</div>
              <div className="text-xs text-[var(--color-on-surface-variant)]">повторений</div>
            </div>
          </div>
        </div>

        {result.entries.map(entry => {
          const ex = exercises.find(e => e.id === entry.exerciseId);
          return (
            <div key={entry.exerciseId} className="bg-[var(--color-surface-dim)] rounded-2xl p-3 mb-2 border border-[var(--color-outline-variant)]/50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{ex?.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-[family-name:var(--font-data)] text-sm font-medium ${
                    entry.performanceScore >= 1 ? 'text-[var(--color-progress)]' : entry.performanceScore < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'
                  }`}>
                    {entry.performanceScore > 0 ? '+' : ''}{entry.performanceScore}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg ${
                    entry.decision === 'progress' ? 'bg-[var(--color-progress-container)] text-[var(--color-progress)]' :
                    entry.decision === 'deload' || entry.decision === 'stop' || entry.decision === 'unload' ? 'bg-[var(--color-danger-container)] text-[var(--color-danger)]' :
                    entry.decision === 'reduce' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
                    'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                  }`}>{formatDecision(entry.decision)}</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-on-surface-variant)] mt-1">
                {entry.sets.length} подх · {entry.sets.reduce((s, c) => s + c.reps, 0)} повт · {entry.reason}
              </div>
            </div>
          );
        })}

        <button onClick={handleBack} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-4">
          Понятно
        </button>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-[family-name:var(--font-display)] text-xl font-bold">Обрабатываем...</div>
      </div>
    );
  }

  // === ACTIVE TRAINING ===
  return (
    <div className="flex-1 flex flex-col px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={handleBack} className="text-[var(--color-primary)] text-sm font-medium">← Выход</button>
        <span className="text-xs text-[var(--color-on-surface-variant)]">
          Упражнение {currentExerciseIdx + 1}/{totalExercises}
        </span>
      </div>

      {/* Exercise progress dots */}
      <div className="flex gap-1 justify-center mb-3">
        {exerciseIds.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i < currentExerciseIdx ? 'w-6 bg-[var(--color-progress)]' :
            i === currentExerciseIdx ? 'w-6 bg-[var(--color-primary)]' :
            'w-3 bg-[var(--color-outline-variant)]'
          }`} />
        ))}
      </div>

      {/* Exercise name */}
      <div className="text-center mb-2">
        <h2 className="font-[family-name:var(--font-display)] text-[28px] font-bold">{exercise.name}</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          {formatLoadConfig(plan.loadConfig)} · Подход {currentSetNum}/{totalSets}
        </p>
      </div>

      {/* Weight selector for dumbbells */}
      {exercise.type === 'dumbbell' && exercise.availableWeights && exercise.availableWeights.length > 0 && (
        <div className="mb-2">
          <WeightSelector
            weights={exercise.availableWeights}
            selected={'weight' in plan.loadConfig ? plan.loadConfig.weight : exercise.availableWeights[0]}
            onChange={() => {}}
          />
        </div>
      )}

      {/* Progress ring */}
      <div className="flex justify-center mb-3">
        <ProgressRing progress={completedSets.length / totalSets} size={100} strokeWidth={10} color="var(--color-progress)">
          <div className="text-center">
            <span className="font-[family-name:var(--font-display)] text-[40px] font-bold leading-none">{plan.reps}</span>
            <br />
            <span className="text-[11px] text-[var(--color-on-surface-variant)]">цель</span>
          </div>
        </ProgressRing>
      </div>

      {rpeNote && (
        <div className="bg-[var(--color-intensity-container)] text-[var(--color-intensity)] text-xs font-medium px-3 py-2 rounded-xl mb-2 text-center">
          {rpeNote}
        </div>
      )}

      {/* Rep input */}
      <p className="text-sm font-medium mb-1">Сколько сделал:</p>
      <div className="flex items-center justify-center gap-6 mb-2">
        <button onClick={() => { setCurrentReps(r => Math.max(0, r - 1)); if (navigator.vibrate) navigator.vibrate(20); }}
          className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container)] flex items-center justify-center text-2xl font-bold active:scale-95 transition-transform">−</button>
        <span className="font-[family-name:var(--font-display)] text-4xl font-bold w-16 text-center">{currentReps}</span>
        <button onClick={() => { setCurrentReps(r => r + 1); if (navigator.vibrate) navigator.vibrate(20); }}
          className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container)] flex items-center justify-center text-2xl font-bold active:scale-95 transition-transform">+</button>
      </div>

      {/* RPE */}
      <p className="text-sm font-medium mb-1">RPE:</p>
      <div className="flex gap-2 justify-center mb-1">
        {[6, 7, 8, 9, 10].map(rpe => {
          const isTarget = rpe >= plan.targetRPE - 0.5 && rpe <= plan.targetRPE + 0.5;
          return (
            <button key={rpe} onClick={() => { setCurrentRPE(rpe); if (navigator.vibrate) navigator.vibrate(30); }}
              className={`w-12 h-10 rounded-xl text-sm font-medium transition-colors ${
                currentRPE === rpe ? 'bg-[var(--color-primary)] text-white'
                  : isTarget ? 'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                  : 'bg-[var(--color-surface-container)]'
              }`}>{rpe}</button>
          );
        })}
      </div>
      <div className="flex justify-center mb-3">
        <span className="text-[11px] text-[var(--color-on-surface-variant)]">RPE {plan.targetRPE}</span>
      </div>

      <button onClick={recordSet}
        className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mb-3 active:scale-[0.98] transition-transform">
        Записать подход
      </button>

      {/* Completed sets */}
      <div className="flex flex-col gap-1">
        {completedSets.map(s => (
          <div key={s.setNumber} className="flex items-center gap-2 text-sm text-[var(--color-progress)] animate-slide-up">
            <span>✓</span>
            <span>Подход {s.setNumber}: {s.reps} повт · RPE {s.rpe}</span>
          </div>
        ))}
      </div>

      {/* Undo */}
      {undoSet && (
        <div className="fixed bottom-20 left-4 right-4 max-w-[396px] mx-auto bg-[var(--color-on-surface)] text-white rounded-xl h-12 px-4 flex items-center justify-between z-50 animate-slide-up">
          <span className="text-sm">Подход записан</span>
          <button onClick={handleUndo} className="text-[var(--color-primary)] text-sm font-medium">Отменить</button>
        </div>
      )}

      {/* Timer */}
      {showTimer && (
        <div className="fixed inset-x-0 bottom-0 bg-[var(--color-surface)] rounded-t-3xl shadow-lg p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-[428px] mx-auto border-t border-[var(--color-outline-variant)] z-40 animate-slide-up">
          <div className="w-10 h-1 bg-[var(--color-outline)] rounded-full mx-auto mb-4" />
          <div className="flex justify-center mb-4">
            <ProgressRing progress={timerSeconds / (REST_TIMES[plan.sessionType] ?? 120)} size={160} strokeWidth={8} color="var(--color-rest)">
              <span className="font-[family-name:var(--font-data)] text-[32px]">{formatTime(timerSeconds)}</span>
            </ProgressRing>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setTimerSeconds(s => s + 30)}
              className="flex-1 h-12 rounded-xl border border-[var(--color-outline)] text-sm font-medium active:scale-95 transition-transform">+30с</button>
            <button onClick={() => { setShowTimer(false); setTimerSeconds(0); }}
              className="flex-1 h-12 rounded-xl text-[var(--color-primary)] text-sm font-medium">Пропустить</button>
          </div>
        </div>
      )}
    </div>
  );
}
