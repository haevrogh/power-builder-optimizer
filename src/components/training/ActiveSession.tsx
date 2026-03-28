import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../stores/useStore';
import type { SetLog, SessionPlan } from '../../types';
import { formatLoadConfig, formatTime, formatDecision } from '../../utils/format';
import { REST_TIMES } from '../../engine/constants';
import ProgressRing from '../common/ProgressRing';

function useSessionData() {
  const activeTrainingSession = useStore(s => s.activeTrainingSession);
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);

  if (!activeTrainingSession) return null;

  const exercise = exercises.find(e => e.id === activeTrainingSession.exerciseId);
  const meso = mesocycles.find(m => m.id === activeTrainingSession.mesocycleId);
  if (!exercise || !meso) return null;

  const week = meso.weeks[activeTrainingSession.weekNumber - 1];
  const plan = week?.sessions.find(s => s.sessionNumber === activeTrainingSession.sessionNumber);
  if (!plan) return null;

  return { session: activeTrainingSession, exercise, meso, week, plan };
}

export default function ActiveSession() {
  const data = useSessionData();
  const logSession = useStore(s => s.logSession);

  const [completedSets, setCompletedSets] = useState<SetLog[]>([]);
  const [currentReps, setCurrentReps] = useState(0);
  const [currentRPE, setCurrentRPE] = useState(8);
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({
    sorenessFromPrevious: 1 as 0 | 1 | 2 | 3,
    pumpQuality: 2 as 1 | 2 | 3,
    jointPain: false,
    sleepQuality: 2 as 1 | 2 | 3,
  });
  const [result, setResult] = useState<{ score: number; decision: string; reason: string } | null>(null);
  const [undoSet, setUndoSet] = useState<SetLog | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [rpeAdjustNote, setRpeAdjustNote] = useState<string | null>(null);

  // Sync target reps from plan
  useEffect(() => {
    if (data?.plan) {
      setCurrentReps(data.plan.reps);
    }
  }, [data?.plan?.reps]);

  // Rest timer countdown
  useEffect(() => {
    if (!showTimer || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => {
        if (s <= 1) {
          setShowTimer(false);
          // Haptic on timer end
          if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50, 50]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showTimer, timerSeconds]);

  // Clear undo after 5 seconds
  useEffect(() => {
    if (!undoSet) return;
    undoTimerRef.current = setTimeout(() => setUndoSet(null), 5000);
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, [undoSet]);

  if (!data) return null;
  const { session, exercise, plan } = data;

  const currentSetNumber = completedSets.length + 1;
  const totalSets = plan.sets;

  // Real-time RPE adjustment logic (ТЗ 2.2.2)
  const getRpeAdjustment = (lastSet: SetLog, plan: SessionPlan): string | null => {
    const deviation = lastSet.rpe - plan.targetRPE;
    if (deviation >= 2) return 'RPE слишком высокий. Снизь повторения на 1 или используй резину.';
    if (deviation >= 1) return 'Чуть тяжелее плана. Оставляем как есть.';
    if (deviation <= -2) return 'Слишком легко! Прибавь повторения или вес.';
    if (deviation <= -1) return 'Можешь прибавить нагрузку.';
    return null;
  };

  const recordSet = () => {
    const set: SetLog = {
      setNumber: currentSetNumber,
      reps: currentReps,
      rpe: currentRPE,
      loadConfig: plan.loadConfig,
      completed: true,
    };
    setCompletedSets(prev => [...prev, set]);
    setUndoSet(set);

    // Haptic on record
    if (navigator.vibrate) navigator.vibrate(50);

    // RPE real-time adjustment
    const note = getRpeAdjustment(set, plan);
    setRpeAdjustNote(note);

    // Adjust suggested reps for next set based on RPE
    const rpeDeviation = currentRPE - plan.targetRPE;
    if (rpeDeviation >= 2) {
      setCurrentReps(r => Math.max(1, r - 1));
    } else if (rpeDeviation <= -2) {
      setCurrentReps(r => r + 1);
    }

    if (currentSetNumber < totalSets) {
      const restTime = REST_TIMES[plan.sessionType] ?? 120;
      setTimerSeconds(restTime);
      setShowTimer(true);
    } else {
      setShowFeedback(true);
    }
  };

  const handleUndo = () => {
    if (!undoSet) return;
    setCompletedSets(prev => prev.filter(s => s.setNumber !== undoSet.setNumber));
    setUndoSet(null);
    setShowTimer(false);
    setTimerSeconds(0);
    setRpeAdjustNote(null);
    if (showFeedback) setShowFeedback(false);
  };

  const submitFeedback = async () => {
    const res = await logSession({
      date: new Date().toISOString(),
      exerciseId: session.exerciseId,
      mesocycleId: session.mesocycleId,
      weekNumber: session.weekNumber,
      sessionNumber: session.sessionNumber,
      sets: completedSets,
      overallRPE: Math.round(completedSets.reduce((s, c) => s + c.rpe, 0) / completedSets.length),
      ...feedback,
    });
    setResult(res);
    // Haptic on completion
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  const handleBack = () => {
    useStore.setState({ activeTrainingSession: null });
  };

  // === RESULT SCREEN ===
  if (result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 animate-fade-in">
        <div className={`font-[family-name:var(--font-display)] text-5xl font-bold mb-3 ${
          result.score >= 1 ? 'text-[var(--color-progress)]' : result.score < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'
        }`}>
          Score: {result.score > 0 ? '+' : ''}{result.score}
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-lg mb-4 ${
          result.decision === 'progress' ? 'bg-[var(--color-progress-container)] text-[var(--color-progress)]' :
          result.decision === 'deload' || result.decision === 'stop' ? 'bg-[var(--color-danger-container)] text-[var(--color-danger)]' :
          result.decision === 'reduce' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
          'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
        }`}>
          {formatDecision(result.decision)}
        </span>
        <p className="text-center text-[var(--color-on-surface-variant)] text-base mb-8 px-4">{result.reason}</p>

        <div className="w-full bg-[var(--color-surface-dim)] rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-medium mb-2">Итого тренировка</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-[family-name:var(--font-data)] text-xl">{completedSets.length}</div>
              <div className="text-xs text-[var(--color-on-surface-variant)]">подходов</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-data)] text-xl">{completedSets.reduce((s, c) => s + c.reps, 0)}</div>
              <div className="text-xs text-[var(--color-on-surface-variant)]">повторений</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-data)] text-xl">
                {completedSets.length > 0 ? (completedSets.reduce((s, c) => s + c.rpe, 0) / completedSets.length).toFixed(1) : '—'}
              </div>
              <div className="text-xs text-[var(--color-on-surface-variant)]">ср. RPE</div>
            </div>
          </div>
        </div>

        <button onClick={handleBack} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium">
          Понятно
        </button>
      </div>
    );
  }

  // === FEEDBACK FORM ===
  if (showFeedback) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-8 animate-fade-in">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1 text-center">Готово!</h1>
        <p className="text-sm text-[var(--color-on-surface-variant)] text-center mb-6">Как ощущения?</p>

        <FeedbackSection label="Крепатура от прошлой тренировки"
          options={[['Нет', 0], ['Лёгкая', 1], ['Средняя', 2], ['Сильная', 3]]}
          value={feedback.sorenessFromPrevious}
          onChange={v => setFeedback(f => ({ ...f, sorenessFromPrevious: v as 0 | 1 | 2 | 3 }))} />

        <FeedbackSection label="Пампинг"
          options={[['Нет', 1], ['Умеренный', 2], ['Сильный', 3]]}
          value={feedback.pumpQuality}
          onChange={v => setFeedback(f => ({ ...f, pumpQuality: v as 1 | 2 | 3 }))} />

        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Боль в суставах?</p>
          <div className="flex gap-2">
            {([['Нет', false], ['Да', true]] as const).map(([label, val]) => (
              <button key={label} onClick={() => {
                setFeedback(f => ({ ...f, jointPain: val }));
                if (val && navigator.vibrate) navigator.vibrate([100, 30, 100]);
              }}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                  feedback.jointPain === val
                    ? (val ? 'bg-[var(--color-danger)] text-white' : 'bg-[var(--color-primary)] text-white')
                    : 'bg-[var(--color-surface-container)]'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        <FeedbackSection label="Сон прошлой ночью"
          options={[['Плохой', 1], ['Норм', 2], ['Хороший', 3]]}
          value={feedback.sleepQuality}
          onChange={v => setFeedback(f => ({ ...f, sleepQuality: v as 1 | 2 | 3 }))} />

        <button onClick={submitFeedback} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-4">
          Сохранить
        </button>
      </div>
    );
  }

  // === ACTIVE TRAINING ===
  return (
    <div className="flex-1 flex flex-col px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handleBack} className="text-[var(--color-primary)] text-sm font-medium">← Назад</button>
        <span className="font-medium text-sm">Подход {currentSetNumber} / {totalSets}</span>
      </div>

      <div className="text-center mb-2">
        <h2 className="font-[family-name:var(--font-display)] text-[28px] font-bold">{exercise.name}</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">{formatLoadConfig(plan.loadConfig)}</p>
      </div>

      <div className="flex justify-center mb-4">
        <ProgressRing progress={completedSets.length / totalSets} size={120} strokeWidth={12} color="var(--color-progress)">
          <div className="text-center">
            <span className="font-[family-name:var(--font-display)] text-[48px] font-bold leading-none">{plan.reps}</span>
            <br />
            <span className="text-[11px] text-[var(--color-on-surface-variant)]">цель</span>
          </div>
        </ProgressRing>
      </div>

      {/* RPE adjustment note */}
      {rpeAdjustNote && (
        <div className="bg-[var(--color-intensity-container)] text-[var(--color-intensity)] text-xs font-medium px-3 py-2 rounded-xl mb-3 text-center">
          {rpeAdjustNote}
        </div>
      )}

      <p className="text-sm font-medium mb-2">Сколько сделал:</p>
      <div className="flex items-center justify-center gap-6 mb-3">
        <button
          onClick={() => { setCurrentReps(r => Math.max(0, r - 1)); if (navigator.vibrate) navigator.vibrate(20); }}
          className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container)] flex items-center justify-center text-2xl font-bold active:scale-95 transition-transform"
        >−</button>
        <span className="font-[family-name:var(--font-display)] text-4xl font-bold w-16 text-center">{currentReps}</span>
        <button
          onClick={() => { setCurrentReps(r => r + 1); if (navigator.vibrate) navigator.vibrate(20); }}
          className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container)] flex items-center justify-center text-2xl font-bold active:scale-95 transition-transform"
        >+</button>
      </div>

      <p className="text-sm font-medium mb-2">RPE:</p>
      <div className="flex gap-2 justify-center mb-1">
        {[6, 7, 8, 9, 10].map(rpe => {
          const isTarget = rpe >= plan.targetRPE - 0.5 && rpe <= plan.targetRPE + 0.5;
          return (
            <button key={rpe} onClick={() => { setCurrentRPE(rpe); if (navigator.vibrate) navigator.vibrate(30); }}
              className={`w-12 h-10 rounded-xl text-sm font-medium transition-colors ${
                currentRPE === rpe
                  ? 'bg-[var(--color-primary)] text-white'
                  : isTarget
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-surface-container)]'
              }`}>
              {rpe}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center mb-5">
        <span className="text-[11px] text-[var(--color-on-surface-variant)]">
          целевая зона: RPE {plan.targetRPE}
        </span>
      </div>

      <button onClick={recordSet}
        className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mb-4 active:scale-[0.98] transition-transform">
        Записать подход
      </button>

      {/* Completed sets list */}
      <div className="flex flex-col gap-1">
        {completedSets.map(s => (
          <div key={s.setNumber} className="flex items-center gap-2 text-sm text-[var(--color-progress)] animate-slide-up">
            <span>✓</span>
            <span>Подход {s.setNumber}: {s.reps} повт · RPE {s.rpe}</span>
          </div>
        ))}
      </div>

      {/* Undo snackbar */}
      {undoSet && (
        <div className="fixed bottom-20 left-4 right-4 max-w-[396px] mx-auto bg-[var(--color-on-surface)] text-white rounded-xl h-12 px-4 flex items-center justify-between z-50 animate-slide-up">
          <span className="text-sm">Подход записан</span>
          <button onClick={handleUndo} className="text-[var(--color-primary)] text-sm font-medium">Отменить</button>
        </div>
      )}

      {/* Timer bottom sheet */}
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

function FeedbackSection({ label, options, value, onChange }: {
  label: string; options: [string, number][]; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(([text, val]) => (
          <button key={text} onClick={() => { onChange(val); if (navigator.vibrate) navigator.vibrate(20); }}
            className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors ${
              value === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)]'
            }`}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
