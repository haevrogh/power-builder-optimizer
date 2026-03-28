import { useStore } from '../../stores/useStore';
import { formatDecision, formatWeekType, formatSessionType, formatLoadConfig } from '../../utils/format';
import ProgressRing from '../common/ProgressRing';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';

export default function ProgressScreen() {
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const sessionLogs = useStore(s => s.sessionLogs);
  const programs = useStore(s => s.programs);

  const activeProgram = programs.find(p => p.isActive);

  if (exercises.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-[var(--color-on-surface-variant)]">Нет данных для отображения</p>
      </div>
    );
  }

  // Show exercises in program order if there's an active program
  const displayExercises = activeProgram
    ? activeProgram.exerciseIds.map(id => exercises.find(e => e.id === id)).filter(Boolean) as typeof exercises
    : exercises;

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-4">Прогресс</h1>

      {displayExercises.map(exercise => {
        const meso = mesocycles.find(m => m.exerciseId === exercise.id && m.status === 'active');
        const logs = sessionLogs.filter(l => l.exerciseId === exercise.id);
        const phase = exercise.progressionPhase;

        const volumeData = meso?.weeks.map(w => ({
          name: `Н${w.weekNumber}`,
          volume: w.targetSets,
          intensity: Math.round((w.sessions[0]?.intensityPercent ?? 0.6) * 100),
        })) ?? [];

        const scoreData = logs.slice(-10).map((l, i) => ({
          name: `#${i + 1}`,
          score: l.performanceScore ?? 0,
        }));

        return (
          <div key={exercise.id} className="mb-6">
            {/* Exercise header */}
            <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
              <div className="flex items-center gap-4">
                <ProgressRing progress={phase ? (phase / 4) : 1} size={80} strokeWidth={8} color="var(--color-progress)">
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
                    {exercise.type === 'bodyweight'
                      ? `макс BW: ${exercise.repMax}${exercise.repMaxAssisted != null ? ` · резина: ${exercise.repMaxAssisted}` : ''}`
                      : `10RM: ${exercise.currentWeight ?? '?'} кг`
                    }
                  </p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    Коэфф: {(exercise.progressionCoefficient * 100).toFixed(2)}%/нед
                  </p>
                </div>
              </div>
            </div>

            {/* ═══ MESOCYCLE PLAN TABLE ═══ */}
            {meso && (
              <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
                <h3 className="text-sm font-medium mb-3">План мезоцикла</h3>
                <div className="flex flex-col gap-1.5">
                  {meso.weeks.map(week => {
                    const isCurrent = week.weekNumber === meso.currentWeek;
                    const isPast = week.weekNumber < meso.currentWeek;

                    return (
                      <div
                        key={week.weekNumber}
                        className={`rounded-xl p-3 transition-colors ${
                          isCurrent
                            ? 'bg-[var(--color-primary-container)] border border-[var(--color-primary)]/30'
                            : isPast
                              ? 'bg-[var(--color-surface)] opacity-60'
                              : 'bg-[var(--color-surface)]'
                        }`}
                      >
                        {/* Week header line */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-[family-name:var(--font-data)] text-xs text-[var(--color-on-surface-variant)] w-7">
                              Н{week.weekNumber}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                              week.weekType === 'deload' ? 'bg-[var(--color-rest-container)] text-[var(--color-rest)]' :
                              week.weekType === 'intensification' ? 'bg-[var(--color-intensity-container)] text-[var(--color-intensity)]' :
                              week.weekType === 'peak' ? 'bg-[var(--color-danger-container)] text-[var(--color-danger)]' :
                              'bg-[var(--color-primary-container)] text-[var(--color-primary)]'
                            }`}>
                              {formatWeekType(week.weekType)}
                            </span>
                            {isCurrent && (
                              <span className="text-[11px] font-medium text-[var(--color-primary)]">← сейчас</span>
                            )}
                            {isPast && (
                              <span className="text-[11px] text-[var(--color-progress)]">✓</span>
                            )}
                          </div>
                          <span className="font-[family-name:var(--font-data)] text-xs text-[var(--color-on-surface-variant)]">
                            {week.targetSets} подх/нед
                          </span>
                        </div>

                        {/* Sessions detail */}
                        <div className="flex gap-2">
                          {week.sessions.map(session => (
                            <div key={session.sessionNumber} className="flex-1 text-[11px] text-[var(--color-on-surface-variant)]">
                              <span className={`font-medium ${
                                session.sessionType === 'heavy' ? 'text-[var(--color-intensity)]' : 'text-[var(--color-primary)]'
                              }`}>
                                {formatSessionType(session.sessionType)}
                              </span>
                              {' · '}
                              <span className="font-[family-name:var(--font-data)]">
                                {session.sets}×{session.reps}
                              </span>
                              {' '}
                              <span>{formatLoadConfig(session.loadConfig)}</span>
                              {' · '}
                              <span>{Math.round(session.intensityPercent * 100)}%</span>
                              {' · RPE '}
                              <span>{session.targetRPE}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-[var(--color-on-surface-variant)]">
                  <span>Подходы×Повторения · Нагрузка · %repMax · RPE</span>
                </div>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1 italic">
                  План корректируется автоматически по результатам каждой тренировки
                </p>
              </div>
            )}

            {/* Volume & Intensity chart */}
            {volumeData.length > 0 && (
              <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
                <h3 className="text-sm font-medium mb-3">Объём и интенсивность</h3>
                <div className="flex gap-3 mb-2 text-xs text-[var(--color-on-surface-variant)]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[var(--color-primary)]" /> Объём (подх)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[var(--color-intensity)]" /> Интенс. (%)</span>
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
                {/* Current volume marker */}
                {meso && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-[var(--color-on-surface)] rounded-full"
                    style={{ left: `${((meso.weeks[meso.currentWeek - 1]?.targetSets ?? 0) / (exercise.volumeLandmarks.mrv + 4)) * 100}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between mt-2 text-xs text-[var(--color-on-surface-variant)]">
                <span>MV {exercise.volumeLandmarks.mv}</span>
                <span>MEV {exercise.volumeLandmarks.mev}</span>
                <span>MAV {exercise.volumeLandmarks.mav}</span>
                <span>MRV {exercise.volumeLandmarks.mrv}</span>
              </div>
              {meso && (
                <p className="text-xs text-[var(--color-on-surface-variant)] mt-1">
                  Текущий объём: <strong>{meso.weeks[meso.currentWeek - 1]?.targetSets ?? '?'}</strong> подх/нед
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
                        {log.sets.length} подх{log.sets.length > 0 ? ` · RPE ${(log.sets.reduce((s, c) => s + c.rpe, 0) / log.sets.length).toFixed(1)}` : ''}
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
