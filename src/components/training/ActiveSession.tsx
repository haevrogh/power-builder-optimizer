import { useState, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import type { SetLog } from '../../types';
import { formatLoadConfig, formatTime } from '../../utils/format';
import { REST_TIMES } from '../../engine/constants';
import ProgressRing from '../common/ProgressRing';

export default function ActiveSession() {
  const activeTrainingSession = useStore(s => s.activeTrainingSession);
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const logSession = useStore(s => s.logSession);

  const [completedSets, setCompletedSets] = useState<SetLog[]>([]);
  const [currentReps, setCurrentReps] = useState(0);
  const [currentRPE, setCurrentRPE] = useState(8);
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({ sorenessFromPrevious: 1 as 0|1|2|3, pumpQuality: 2 as 1|2|3, jointPain: false, sleepQuality: 2 as 1|2|3 });
  const [result, setResult] = useState<{ score: number; decision: string; reason: string } | null>(null);

  const session = activeTrainingSession;
  if (!session) return null;

  const exercise = exercises.find(e => e.id === session.exerciseId);
  const meso = mesocycles.find(m => m.id === session.mesocycleId);
  if (!exercise || !meso) return null;

  const week = meso.weeks[session.weekNumber - 1];
  const plan = week?.sessions.find(s => s.sessionNumber === session.sessionNumber);
  if (!plan) return null;

  const currentSetNumber = completedSets.length + 1;
  const totalSets = plan.sets;
  const allDone = completedSets.length >= totalSets;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setCurrentReps(plan.reps);
  }, [plan.reps]);

  // Timer
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!showTimer || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => {
        if (s <= 1) { setShowTimer(false); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showTimer, timerSeconds]);

  const recordSet = () => {
    const set: SetLog = {
      setNumber: currentSetNumber,
      reps: currentReps,
      rpe: currentRPE,
      loadConfig: plan.loadConfig,
      completed: true,
    };
    setCompletedSets(prev => [...prev, set]);

    if (currentSetNumber < totalSets) {
      const restTime = REST_TIMES[plan.sessionType] ?? 120;
      setTimerSeconds(restTime);
      setShowTimer(true);
    } else {
      setShowFeedback(true);
    }
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
  };

  // Result screen
  if (result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div className={`font-[family-name:var(--font-display)] text-4xl font-bold mb-2 ${
          result.score >= 1 ? 'text-[var(--color-progress)]' : result.score < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'
        }`}>
          Score: {result.score > 0 ? '+' : ''}{result.score}
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-lg mb-4 ${
          result.decision === 'progress' ? 'bg-[var(--color-progress-container)] text-[var(--color-progress)]' :
          result.decision === 'deload' || result.decision === 'stop' ? 'bg-[var(--color-danger-container)] text-[var(--color-danger)]' :
          'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
        }`}>
          {result.decision.toUpperCase()}
        </span>
        <p className="text-center text-[var(--color-on-surface-variant)] mb-8">{result.reason}</p>
        <button onClick={() => window.location.reload()} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium">
          Понятно
        </button>
      </div>
    );
  }

  // Feedback form
  if (showFeedback) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-8">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1 text-center">Готово!</h1>
        <p className="text-sm text-[var(--color-on-surface-variant)] text-center mb-6">Как ощущения?</p>

        <FeedbackSection label="Крепатура от прошлой тренировки" options={[['Нет', 0], ['Лёгкая', 1], ['Средняя', 2], ['Сильная', 3]]}
          value={feedback.sorenessFromPrevious} onChange={v => setFeedback(f => ({ ...f, sorenessFromPrevious: v as 0|1|2|3 }))} />

        <FeedbackSection label="Пампинг" options={[['Нет', 1], ['Умеренный', 2], ['Сильный', 3]]}
          value={feedback.pumpQuality} onChange={v => setFeedback(f => ({ ...f, pumpQuality: v as 1|2|3 }))} />

        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Боль в суставах?</p>
          <div className="flex gap-2">
            {([['Нет', false], ['Да', true]] as const).map(([label, val]) => (
              <button key={label} onClick={() => setFeedback(f => ({ ...f, jointPain: val }))}
                className={`flex-1 h-10 rounded-xl text-sm font-medium ${
                  feedback.jointPain === val ? (val ? 'bg-[var(--color-danger)] text-white' : 'bg-[var(--color-primary)] text-white') : 'bg-[var(--color-surface-container)]'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        <FeedbackSection label="Сон прошлой ночью" options={[['Плохой', 1], ['Норм', 2], ['Хороший', 3]]}
          value={feedback.sleepQuality} onChange={v => setFeedback(f => ({ ...f, sleepQuality: v as 1|2|3 }))} />

        <button onClick={submitFeedback} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-4">
          Сохранить
        </button>
      </div>
    );
  }

  // Active training
  return (
    <div className="flex-1 flex flex-col px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => useStore.getState().startTrainingSession('')} className="text-[var(--color-primary)] text-sm">← Назад</button>
        <span className="font-medium text-sm">Подход {currentSetNumber} / {totalSets}</span>
      </div>

      <div className="text-center mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">{exercise.name}</h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">{formatLoadConfig(plan.loadConfig)}</p>
      </div>

      <div className="flex justify-center mb-6">
        <ProgressRing progress={completedSets.length / totalSets} size={120} strokeWidth={12} color="var(--color-progress)">
          <div className="text-center">
            <span className="font-[family-name:var(--font-display)] text-[48px] font-bold leading-none">{plan.reps}</span>
            <br />
            <span className="text-xs text-[var(--color-on-surface-variant)]">цель</span>
          </div>
        </ProgressRing>
      </div>

      <p className="text-sm font-medium mb-2">Сколько сделал:</p>
      <div className="flex items-center justify-center gap-6 mb-4">
        <button onClick={() => setCurrentReps(r => Math.max(0, r - 1))}
          className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container)] flex items-center justify-center text-2xl font-bold">−</button>
        <span className="font-[family-name:var(--font-display)] text-4xl font-bold w-16 text-center">{currentReps}</span>
        <button onClick={() => setCurrentReps(r => r + 1)}
          className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container)] flex items-center justify-center text-2xl font-bold">+</button>
      </div>

      <p className="text-sm font-medium mb-2">RPE:</p>
      <div className="flex gap-2 justify-center mb-6">
        {[6, 7, 8, 9, 10].map(rpe => (
          <button key={rpe} onClick={() => setCurrentRPE(rpe)}
            className={`w-12 h-10 rounded-xl text-sm font-medium ${
              currentRPE === rpe ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)]'
            }`}>
            {rpe}
          </button>
        ))}
      </div>

      <button onClick={recordSet} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mb-4">
        {allDone ? 'Завершить' : 'Записать подход'}
      </button>

      {completedSets.map(s => (
        <div key={s.setNumber} className="flex items-center gap-2 text-sm text-[var(--color-progress)] mb-1">
          <span>✓</span>
          <span>Подход {s.setNumber}: {s.reps} повт · RPE {s.rpe}</span>
        </div>
      ))}

      {/* Timer bottom sheet */}
      {showTimer && (
        <div className="fixed inset-x-0 bottom-0 bg-[var(--color-surface)] rounded-t-3xl shadow-lg p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-[428px] mx-auto border-t border-[var(--color-outline-variant)]">
          <div className="w-10 h-1 bg-[var(--color-outline)] rounded-full mx-auto mb-4" />
          <div className="flex justify-center mb-4">
            <ProgressRing progress={timerSeconds / (REST_TIMES[plan.sessionType] ?? 120)} size={160} strokeWidth={8} color="var(--color-rest)">
              <span className="font-[family-name:var(--font-data)] text-[32px]">{formatTime(timerSeconds)}</span>
            </ProgressRing>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setTimerSeconds(s => s + 30)} className="flex-1 h-12 rounded-xl border border-[var(--color-outline)] text-sm font-medium">+30с</button>
            <button onClick={() => { setShowTimer(false); setTimerSeconds(0); }} className="flex-1 h-12 rounded-xl text-[var(--color-primary)] text-sm font-medium">Пропустить</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackSection({ label, options, value, onChange }: { label: string; options: [string, number][]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(([text, val]) => (
          <button key={text} onClick={() => onChange(val)}
            className={`h-10 px-4 rounded-xl text-sm font-medium ${
              value === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)]'
            }`}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
