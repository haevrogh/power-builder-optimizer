import { useMemo } from 'react';
import { useStore } from '../../stores/useStore';
import { formatDate, formatWeekType, formatSessionType, formatLoadConfig } from '../../utils/format';
import ProgressRing from '../common/ProgressRing';

const RECOMMENDATIONS: Record<string, string> = {
  accumulation: 'Неделя накопления — работаем на объём со средней интенсивностью.',
  intensification: 'Неделя интенсификации — повышенная нагрузка. Силовой стимул!',
  peak: 'Пиковая неделя — максимальная нагрузка. После неё — деload.',
  deload: 'Разгрузочная неделя. Восстановление = прогресс.',
};

export default function SessionView() {
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const programs = useStore(s => s.programs);
  const sessionLogs = useStore(s => s.sessionLogs);
  const beginPreCheckin = useStore(s => s.beginPreCheckin);

  const activeProgram = programs.find(p => p.isActive);

  const missedDays = useMemo(() => {
    if (sessionLogs.length === 0) return 0;
    const lastLog = [...sessionLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return Math.floor((Date.now() - new Date(lastLog.date).getTime()) / (1000 * 60 * 60 * 24));
  }, [sessionLogs]);

  if (exercises.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-xl font-bold mb-2">Нет упражнений</div>
          <p className="text-sm text-[var(--color-on-surface-variant)]">Добавьте упражнения и создайте программу в настройках</p>
        </div>
      </div>
    );
  }

  if (!activeProgram) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-xl font-bold mb-2">Нет активной программы</div>
          <p className="text-sm text-[var(--color-on-surface-variant)]">Создайте программу в настройках, чтобы начать</p>
        </div>
      </div>
    );
  }

  // Get the first exercise's mesocycle to determine week info
  const firstExId = activeProgram.exerciseIds[0];
  const firstMeso = mesocycles.find(m => m.exerciseId === firstExId && m.status === 'active');
  const currentWeek = firstMeso?.weeks[(firstMeso?.currentWeek ?? 1) - 1];
  const currentSession = currentWeek?.sessions.find(s => s.sessionNumber === (firstMeso?.currentSession ?? 1));
  const weekProgress = firstMeso ? firstMeso.currentWeek / firstMeso.durationWeeks : 0;
  const recommendation = currentWeek ? RECOMMENDATIONS[currentWeek.weekType] : '';

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
      <div className="mb-4">
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

      {/* Program session card */}
      <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{activeProgram.name}</h2>
          {currentWeek && (
            <div className="flex gap-1.5">
              <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                currentWeek.weekType === 'deload' ? 'bg-[var(--color-rest-container)] text-[var(--color-rest)]' :
                currentWeek.weekType === 'intensification' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
                'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
              }`}>
                {formatWeekType(currentWeek.weekType)}
              </span>
              {currentSession && (
                <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                  currentSession.sessionType === 'heavy'
                    ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]'
                    : 'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                }`}>
                  {formatSessionType(currentSession.sessionType)}
                </span>
              )}
            </div>
          )}
        </div>

        {firstMeso && (
          <div className="flex items-center gap-3 mb-3">
            <ProgressRing progress={weekProgress} size={40} strokeWidth={5} color="var(--color-progress)">
              <span className="font-[family-name:var(--font-data)] text-[10px]">{Math.round(weekProgress * 100)}%</span>
            </ProgressRing>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Неделя {firstMeso.currentWeek}/{firstMeso.durationWeeks} · Сессия {firstMeso.currentSession}
            </p>
          </div>
        )}

        {/* Exercise list */}
        <div className="flex flex-col gap-2 mb-4">
          {activeProgram.exerciseIds.map((exId, i) => {
            const exercise = exercises.find(e => e.id === exId);
            const meso = mesocycles.find(m => m.exerciseId === exId && m.status === 'active');
            if (!exercise || !meso) return null;

            const week = meso.weeks[meso.currentWeek - 1];
            const session = week?.sessions.find(s => s.sessionNumber === meso.currentSession);
            if (!session) return null;

            return (
              <div key={exId} className="flex items-center gap-3 bg-[var(--color-surface)] rounded-xl p-3">
                <span className="font-[family-name:var(--font-data)] text-xs text-[var(--color-on-surface-variant)] w-5">{i + 1}.</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{exercise.name}</div>
                  <div className="font-[family-name:var(--font-data)] text-sm text-[var(--color-on-surface)]">
                    {session.sets} × {session.reps} <span className="text-xs text-[var(--color-on-surface-variant)]">{formatLoadConfig(session.loadConfig)}</span>
                  </div>
                </div>
                <span className="text-xs text-[var(--color-on-surface-variant)]">
                  RPE {session.targetRPE}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={() => beginPreCheckin(activeProgram.id)}
          className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium active:scale-[0.98] transition-transform"
        >
          Начать тренировку
        </button>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 animate-fade-in">
          <p className="text-xs font-medium text-[var(--color-on-surface-variant)] mb-1">ℹ️ Рекомендация</p>
          <p className="text-sm text-[var(--color-on-surface)]">{recommendation}</p>
        </div>
      )}
    </div>
  );
}
