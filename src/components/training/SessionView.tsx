import { useMemo } from 'react';
import { useStore } from '../../stores/useStore';
import { formatDate, formatWeekType, formatSessionType, formatLoadConfig } from '../../utils/format';
import ProgressRing from '../common/ProgressRing';

const RECOMMENDATIONS: Record<string, string> = {
  accumulation: 'Неделя накопления — работаем на объём со средней интенсивностью. Фокус на технику и тоннаж.',
  intensification: 'Неделя интенсификации — повышенная нагрузка при том же объёме. Силовой стимул!',
  peak: 'Пиковая неделя — максимальная нагрузка. После неё — деload.',
  deload: 'Разгрузочная неделя — снижаем объём и интенсивность. Восстановление = прогресс.',
};

export default function SessionView() {
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const sessionLogs = useStore(s => s.sessionLogs);
  const startTrainingSession = useStore(s => s.startTrainingSession);

  const missedDays = useMemo(() => {
    if (sessionLogs.length === 0) return 0;
    const lastLog = sessionLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return Math.floor((Date.now() - new Date(lastLog.date).getTime()) / (1000 * 60 * 60 * 24));
  }, [sessionLogs]);

  if (exercises.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-xl font-bold mb-2">Нет упражнений</div>
          <p className="text-sm text-[var(--color-on-surface-variant)]">Добавьте упражнение в настройках</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
      <div className="mb-5">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold">Тренировка</h1>
        <p className="text-sm text-[var(--color-on-surface-variant)]">{formatDate(new Date())}</p>
      </div>

      {missedDays > 10 && (
        <div className="bg-[var(--color-intensity-container)] rounded-2xl p-3 mb-3 border border-[var(--color-intensity)]/20">
          <p className="text-sm text-[var(--color-intensity)] font-medium">
            {missedDays > 14
              ? `${missedDays} дней без тренировки. Начинаем мягче.`
              : `Давно не тренировались (${missedDays} дн). План скорректирован.`}
          </p>
        </div>
      )}

      <div className="animate-stagger flex flex-col gap-3">
        {exercises.map(exercise => {
          const meso = mesocycles.find(m => m.exerciseId === exercise.id && m.status === 'active');
          if (!meso) return null;
          const week = meso.weeks[meso.currentWeek - 1];
          if (!week) return null;
          const session = week.sessions.find(s => s.sessionNumber === meso.currentSession);
          if (!session) return null;

          const weekProgress = meso.currentWeek / meso.durationWeeks;

          return (
            <div key={exercise.id} className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50">
              {/* Header chips */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                    week.weekType === 'deload' ? 'bg-[var(--color-rest-container)] text-[var(--color-rest)]' :
                    week.weekType === 'intensification' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
                    'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                  }`}>
                    {formatWeekType(week.weekType)}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                    session.sessionType === 'heavy'
                      ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]'
                      : 'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                  }`}>
                    {formatSessionType(session.sessionType)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--color-on-surface-variant)] mb-3">
                Неделя {meso.currentWeek}/{meso.durationWeeks} · Сессия {meso.currentSession}
              </p>

              {/* Exercise info */}
              <div className="flex items-center gap-4 mb-4">
                <ProgressRing progress={weekProgress} size={48} strokeWidth={6} color="var(--color-progress)">
                  <span className="font-[family-name:var(--font-data)] text-[11px]">{Math.round(weekProgress * 100)}%</span>
                </ProgressRing>
                <div className="flex-1">
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold leading-tight">{exercise.name}</h2>
                  <p className="font-[family-name:var(--font-data)] text-[var(--color-on-surface)] text-lg">
                    {session.sets} × {session.reps} <span className="text-sm text-[var(--color-on-surface-variant)]">{formatLoadConfig(session.loadConfig)}</span>
                  </p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    {Math.round(session.intensityPercent * 100)}% от макс · RPE {session.targetRPE}
                  </p>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => startTrainingSession(exercise.id)}
                className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium active:scale-[0.98] transition-transform"
              >
                Начать тренировку
              </button>

              <p className="text-xs text-[var(--color-on-surface-variant)] mt-2 text-center">
                Коэфф: {(exercise.progressionCoefficient * 100).toFixed(2)}%/нед
              </p>
            </div>
          );
        })}
      </div>

      {/* Recommendation card */}
      {(() => {
        const firstExercise = exercises[0];
        const meso = mesocycles.find(m => m.exerciseId === firstExercise?.id && m.status === 'active');
        const week = meso?.weeks[(meso?.currentWeek ?? 1) - 1];
        if (!week) return null;
        const rec = RECOMMENDATIONS[week.weekType];
        if (!rec) return null;

        return (
          <div className="mt-4 bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 animate-fade-in">
            <p className="text-xs font-medium text-[var(--color-on-surface-variant)] mb-1">ℹ️ Рекомендация</p>
            <p className="text-sm text-[var(--color-on-surface)]">{rec}</p>
          </div>
        );
      })()}
    </div>
  );
}
