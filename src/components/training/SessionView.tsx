import { useStore } from '../../stores/useStore';
import { formatDate, formatWeekType, formatSessionType, formatLoadConfig } from '../../utils/format';
import ProgressRing from '../common/ProgressRing';

export default function SessionView() {
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const startTrainingSession = useStore(s => s.startTrainingSession);

  if (exercises.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[var(--color-on-surface-variant)] text-base mb-2">Нет упражнений</p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">Добавьте упражнение в настройках</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <div className="mb-4">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold">Тренировка</h1>
        <p className="text-sm text-[var(--color-on-surface-variant)]">{formatDate(new Date())}</p>
      </div>

      {exercises.map(exercise => {
        const meso = mesocycles.find(m => m.exerciseId === exercise.id && m.status === 'active');
        if (!meso) return null;
        const week = meso.weeks[meso.currentWeek - 1];
        if (!week) return null;
        const session = week.sessions.find(s => s.sessionNumber === meso.currentSession);
        if (!session) return null;

        const weekProgress = meso.currentWeek / meso.durationWeeks;

        return (
          <div key={exercise.id} className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                week.weekType === 'deload' ? 'bg-[var(--color-rest-container)] text-[var(--color-rest)]' :
                week.weekType === 'intensification' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
                'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
              }`}>
                {formatWeekType(week.weekType)}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                session.sessionType === 'heavy'
                  ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]'
                  : 'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
              }`}>
                {formatSessionType(session.sessionType)}
              </span>
            </div>

            <p className="text-xs text-[var(--color-on-surface-variant)] mb-3">
              Неделя {meso.currentWeek} · Сессия {meso.currentSession} · Мезоцикл
            </p>

            <div className="flex items-center gap-4 mb-3">
              <ProgressRing progress={weekProgress} size={48} strokeWidth={6} color="var(--color-progress)">
                <span className="font-[family-name:var(--font-data)] text-xs">{Math.round(weekProgress * 100)}%</span>
              </ProgressRing>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{exercise.name}</h2>
                <p className="font-[family-name:var(--font-data)] text-[var(--color-on-surface)] text-base">
                  {session.sets} × {session.reps} {formatLoadConfig(session.loadConfig)}
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  {Math.round(session.intensityPercent * 100)}% от макс · RPE {session.targetRPE}
                </p>
              </div>
            </div>

            <button
              onClick={() => startTrainingSession(exercise.id)}
              className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium"
            >
              Начать тренировку
            </button>

            <p className="text-xs text-[var(--color-on-surface-variant)] mt-2 text-center">
              Коэфф. прогрессии: {(exercise.progressionCoefficient * 100).toFixed(2)}%/нед
            </p>
          </div>
        );
      })}
    </div>
  );
}
