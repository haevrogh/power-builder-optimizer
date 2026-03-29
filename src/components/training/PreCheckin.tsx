import { useState } from 'react';
import type { PlanAdjustment, SessionPlan } from '../../types';
import { calculateReadinessScore, adjustPlanForReadiness } from '../../engine/scoring';
import { formatLoadConfig } from '../../utils/format';

interface Props {
  plan: SessionPlan;
  exerciseName: string;
  onStart: (checkin: {
    sorenessFromPrevious: 0 | 1 | 2 | 3;
    jointPain: boolean;
    sleepQuality: 1 | 2 | 3;
    readinessScore: number;
    planAdjustment: PlanAdjustment | null;
  }, adjustedPlan: SessionPlan, usedAdjustedPlan: boolean) => void;
  onSkip: () => void;
}

export default function PreCheckin({ plan, exerciseName, onStart, onSkip }: Props) {
  const [step, setStep] = useState<'questions' | 'adjustment'>('questions');
  const [soreness, setSoreness] = useState<0 | 1 | 2 | 3>(0);
  const [jointPain, setJointPain] = useState(false);
  const [sleep, setSleep] = useState<1 | 2 | 3>(2);
  const [readiness, setReadiness] = useState(0);
  const [adjustedPlan, setAdjustedPlan] = useState<SessionPlan>(plan);
  const [adjustment, setAdjustment] = useState<PlanAdjustment | null>(null);

  const handleSubmitCheckin = () => {
    const score = calculateReadinessScore({ sorenessFromPrevious: soreness, jointPain, sleepQuality: sleep });
    setReadiness(score);

    const { adjustedPlan: adj, adjustment: planAdj } = adjustPlanForReadiness(plan, score, jointPain);
    setAdjustedPlan(adj);
    setAdjustment(planAdj);

    if (score < 0) {
      setStep('adjustment');
    } else {
      // No adjustment needed, go straight to training
      onStart(
        { sorenessFromPrevious: soreness, jointPain, sleepQuality: sleep, readinessScore: score, planAdjustment: null },
        plan,
        true,
      );
    }
  };

  const handleAcceptAdjustment = () => {
    onStart(
      { sorenessFromPrevious: soreness, jointPain, sleepQuality: sleep, readinessScore: readiness, planAdjustment: adjustment },
      adjustedPlan,
      true,
    );
  };

  const handleIgnoreAdjustment = () => {
    onStart(
      { sorenessFromPrevious: soreness, jointPain, sleepQuality: sleep, readinessScore: readiness, planAdjustment: adjustment },
      plan,
      false,
    );
  };

  // === ADJUSTMENT SCREEN ===
  if (step === 'adjustment' && adjustment) {
    const severityColor = adjustment.severity === 'severe'
      ? 'text-[var(--color-danger)]'
      : adjustment.severity === 'moderate'
        ? 'text-[var(--color-intensity)]'
        : 'text-[var(--color-primary)]';

    return (
      <div className="flex-1 flex flex-col px-4 pt-12 pb-8 animate-fade-in">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`font-[family-name:var(--font-data)] text-[32px] font-medium mb-2 ${severityColor}`}>
            Готовность: {readiness}
          </div>

          <p className="text-center text-[var(--color-on-surface)] text-base mb-6 px-4">
            {adjustment.message}
          </p>

          {adjustment.severity !== 'severe' && (
            <div className="w-full bg-[var(--color-surface-dim)] rounded-2xl p-4 mb-6">
              <h3 className="text-sm font-medium mb-2">Скорректированный план:</h3>
              <p className="font-[family-name:var(--font-data)] text-lg">
                {adjustedPlan.sets} × {adjustedPlan.reps} {formatLoadConfig(adjustedPlan.loadConfig)}
              </p>
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {Math.round(adjustedPlan.intensityPercent * 100)}% от макс · RPE {adjustedPlan.targetRPE}
              </p>
            </div>
          )}

          {adjustment.severity === 'severe' && (
            <div className="w-full flex flex-col gap-3 mb-6">
              <button onClick={handleAcceptAdjustment}
                className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium">
                {jointPain ? 'Восстановительная тренировка' : 'Лёгкая тренировка'}
              </button>
              <button onClick={onSkip}
                className="w-full h-12 rounded-2xl text-base font-medium text-[var(--color-on-surface-variant)]">
                Пропустить тренировку
              </button>
            </div>
          )}
        </div>

        {adjustment.severity !== 'severe' && (
          <div className="flex flex-col gap-3">
            <button onClick={handleAcceptAdjustment}
              className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium active:scale-[0.98] transition-transform">
              Принять корректировку
            </button>
            <button onClick={handleIgnoreAdjustment}
              className="w-full h-12 rounded-2xl text-sm font-medium text-[var(--color-on-surface-variant)]">
              Работать по исходному плану
            </button>
          </div>
        )}

        {jointPain && adjustment.severity !== 'severe' && (
          <button onClick={onSkip}
            className="w-full h-14 bg-[var(--color-danger)] text-white rounded-2xl text-base font-medium">
            Пропустить упражнение
          </button>
        )}
      </div>
    );
  }

  // === QUESTIONS SCREEN ===
  return (
    <div className="flex-1 flex flex-col px-4 pt-12 pb-8 animate-fade-in">
      <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1">Как себя чувствуешь?</h1>
      <p className="text-sm text-[var(--color-on-surface-variant)] mb-6">{exerciseName}</p>

      <div className="flex flex-col gap-5 flex-1">
        <div>
          <p className="text-sm font-medium mb-2">Крепатура от прошлой тренировки</p>
          <div className="flex gap-2 flex-wrap">
            {([['Нет', 0], ['Лёгкая', 1], ['Средняя', 2], ['Сильная', 3]] as const).map(([label, val]) => (
              <button key={label} onClick={() => { setSoreness(val); if (navigator.vibrate) navigator.vibrate(20); }}
                className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors ${
                  soreness === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)]'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Боль в суставах?</p>
          <div className="flex gap-2">
            {([['Нет', false], ['Да', true]] as const).map(([label, val]) => (
              <button key={label} onClick={() => {
                setJointPain(val);
                if (val && navigator.vibrate) navigator.vibrate([100, 30, 100]);
              }}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                  jointPain === val
                    ? (val ? 'bg-[var(--color-danger)] text-white' : 'bg-[var(--color-primary)] text-white')
                    : 'bg-[var(--color-surface-container)]'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Сон прошлой ночью</p>
          <div className="flex gap-2">
            {([['Плохой', 1], ['Норм', 2], ['Хороший', 3]] as const).map(([label, val]) => (
              <button key={label} onClick={() => { setSleep(val); if (navigator.vibrate) navigator.vibrate(20); }}
                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                  sleep === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)]'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleSubmitCheckin}
        className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-6 active:scale-[0.98] transition-transform">
        Поехали!
      </button>
    </div>
  );
}
