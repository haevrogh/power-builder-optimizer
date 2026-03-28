import { useStore } from '../../stores/useStore';
import { formatDecision } from '../../utils/format';
import ProgressRing from '../common/ProgressRing';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';

export default function ProgressScreen() {
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const sessionLogs = useStore(s => s.sessionLogs);

  if (exercises.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-[var(--color-on-surface-variant)]">Нет данных для отображения</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-4">Прогресс</h1>

      {exercises.map(exercise => {
        const meso = mesocycles.find(m => m.exerciseId === exercise.id && m.status === 'active');
        const logs = sessionLogs.filter(l => l.exerciseId === exercise.id);
        const phase = exercise.progressionPhase;

        // Chart data from mesocycle weeks
        const volumeData = meso?.weeks.map(w => ({
          name: `Н${w.weekNumber}`,
          volume: w.targetSets,
          intensity: Math.round((w.sessions[0]?.intensityPercent ?? 0.6) * 100),
        })) ?? [];

        // Performance score data from logs
        const scoreData = logs.slice(-10).map((l, i) => ({
          name: `#${i + 1}`,
          score: l.performanceScore ?? 0,
        }));

        return (
          <div key={exercise.id} className="mb-6">
            {/* Exercise card */}
            <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
              <div className="flex items-center gap-4">
                <ProgressRing
                  progress={phase ? (phase / 4) : 1}
                  size={80} strokeWidth={8}
                  color="var(--color-progress)"
                >
                  <div className="text-center">
                    <span className="font-[family-name:var(--font-data)] text-xl">{exercise.repMax}</span>
                    {exercise.repMaxAssisted != null && (
                      <span className="font-[family-name:var(--font-data)] text-xs text-[var(--color-on-surface-variant)]">/{exercise.repMaxAssisted}</span>
                    )}
                  </div>
                </ProgressRing>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">{exercise.name}</h2>
                  {phase && <p className="text-sm text-[var(--color-on-surface-variant)]">Фаза {phase}</p>}
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    repMax BW: {exercise.repMax}
                    {exercise.repMaxAssisted != null && ` · резина: ${exercise.repMaxAssisted}`}
                  </p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    Коэфф: {(exercise.progressionCoefficient * 100).toFixed(2)}%/нед
                  </p>
                </div>
              </div>
            </div>

            {/* Volume & Intensity chart */}
            {volumeData.length > 0 && (
              <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
                <h3 className="text-sm font-medium mb-3">Объём и интенсивность</h3>
                <div className="flex gap-3 mb-2 text-xs text-[var(--color-on-surface-variant)]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[var(--color-primary)]" /> Объём</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[var(--color-intensity)]" /> Интенс.</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={volumeData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="volume" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="intensity" fill="var(--color-intensity)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Performance Score chart */}
            {scoreData.length > 0 && (
              <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
                <h3 className="text-sm font-medium mb-3">Performance Score</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={scoreData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[-5, 5]} />
                    <Line type="monotone" dataKey="score" stroke="var(--color-progress)" strokeWidth={2} dot={{ fill: 'var(--color-progress)', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Volume Landmarks bar */}
            <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
              <h3 className="text-sm font-medium mb-3">Volume Landmarks</h3>
              <div className="relative h-8 bg-[var(--color-surface-container)] rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 left-0 bg-[var(--color-primary)]/20 rounded-full"
                  style={{ width: `${(exercise.volumeLandmarks.mrv / (exercise.volumeLandmarks.mrv + 4)) * 100}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 bg-[var(--color-progress)]/30 rounded-full"
                  style={{
                    left: `${(exercise.volumeLandmarks.mev / (exercise.volumeLandmarks.mrv + 4)) * 100}%`,
                    width: `${((exercise.volumeLandmarks.mav - exercise.volumeLandmarks.mev) / (exercise.volumeLandmarks.mrv + 4)) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[var(--color-on-surface-variant)]">
                <span>MV {exercise.volumeLandmarks.mv}</span>
                <span>MEV {exercise.volumeLandmarks.mev}</span>
                <span>MAV {exercise.volumeLandmarks.mav}</span>
                <span>MRV {exercise.volumeLandmarks.mrv}</span>
              </div>
              {meso && (
                <p className="text-xs text-[var(--color-on-surface-variant)] mt-2">
                  Текущий: {meso.weeks[meso.currentWeek - 1]?.targetSets ?? '?'} подх/нед
                </p>
              )}
            </div>

            {/* Recent sessions */}
            {logs.length > 0 && (
              <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50">
                <h3 className="text-sm font-medium mb-3">Последние тренировки</h3>
                {logs.slice(-5).reverse().map(log => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-[var(--color-outline-variant)] last:border-b-0">
                    <div>
                      <span className="text-sm">{new Date(log.date).toLocaleDateString('ru-RU')}</span>
                      <span className="text-xs text-[var(--color-on-surface-variant)] ml-2">
                        {log.sets.length} подх · RPE {log.overallRPE}
                      </span>
                    </div>
                    {log.volumeAdjustment && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        log.volumeAdjustment.decision === 'progress' ? 'bg-[var(--color-progress-container)] text-[var(--color-progress)]' :
                        log.volumeAdjustment.decision === 'deload' || log.volumeAdjustment.decision === 'stop' ? 'bg-[var(--color-danger-container)] text-[var(--color-danger)]' :
                        log.volumeAdjustment.decision === 'reduce' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
                        'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                      }`}>
                        {formatDecision(log.volumeAdjustment.decision)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
