import { useState } from 'react';
import { useStore } from '../../stores/useStore';
import type { ExerciseType, MuscleGroup } from '../../types';
import { DEFAULT_DUMBBELL_WEIGHTS } from '../../engine/constants';

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: 'back_lats', label: 'Спина (широчайшие)' },
  { value: 'chest', label: 'Грудные' },
  { value: 'shoulders', label: 'Дельты' },
  { value: 'biceps', label: 'Бицепс' },
  { value: 'triceps', label: 'Трицепс' },
  { value: 'quads', label: 'Квадрицепс' },
  { value: 'hamstrings', label: 'Бицепс бедра' },
  { value: 'glutes', label: 'Ягодицы' },
  { value: 'core', label: 'Кор' },
];

export default function ExerciseSetup({ onDone }: { onDone: () => void }) {
  const addExercise = useStore(s => s.addExercise);
  const exercises = useStore(s => s.exercises);
  const [adding, setAdding] = useState(true);
  const [form, setForm] = useState({
    name: '',
    type: 'bodyweight' as ExerciseType,
    muscleGroup: 'back_lats' as MuscleGroup,
    hasBand: true,
    bandAssistPercent: 30,
    eccentricOption: true,
    repMax: 3,
    repMaxAssisted: 10,
    availableWeights: [...DEFAULT_DUMBBELL_WEIGHTS],
  });

  const handleAdd = async () => {
    if (!form.name.trim()) return;

    await addExercise({
      name: form.name,
      type: form.type,
      muscleGroup: form.muscleGroup,
      repMax: form.type === 'bodyweight' ? form.repMax : form.repMax,
      ...(form.type === 'bodyweight'
        ? {
            assistOptions: form.hasBand ? { hasBand: true, bandAssistPercent: form.bandAssistPercent } : undefined,
            eccentricOption: form.eccentricOption,
            repMaxAssisted: form.repMaxAssisted,
          }
        : {
            availableWeights: form.availableWeights,
          }),
    });
    setAdding(false);
  };

  if (!adding && exercises.length > 0) {
    return (
      <div className="flex-1 flex flex-col px-4 pt-12 pb-8">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1">Упражнения</h1>
        <p className="text-[var(--color-on-surface-variant)] text-sm mb-6">Добавлено: {exercises.length}</p>

        <div className="flex flex-col gap-3 flex-1">
          {exercises.map(e => (
            <div key={e.id} className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50">
              <div className="font-[family-name:var(--font-display)] font-bold text-lg">{e.name}</div>
              <div className="text-sm text-[var(--color-on-surface-variant)]">
                {e.type === 'bodyweight' ? 'Свой вес' : 'Гантели'} · Макс: {e.repMax}
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              setForm(f => ({ ...f, name: '' }));
              setAdding(true);
            }}
            className="h-12 border border-dashed border-[var(--color-outline)] rounded-2xl text-[var(--color-primary)] font-medium"
          >
            + Добавить ещё
          </button>
        </div>

        <button onClick={onDone} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-6">
          Начать тренировки
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pt-12 pb-8">
      <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1">Добавить упражнение</h1>
      <p className="text-[var(--color-on-surface-variant)] text-sm mb-6">Начни с основного упражнения</p>

      <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Название</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Например: Подтягивания"
            className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] text-base outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Тип</label>
          <div className="flex gap-2">
            {([['bodyweight', 'Свой вес'], ['dumbbell', 'Гантели']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setForm(f => ({ ...f, type: val }))}
                className={`flex-1 h-12 rounded-xl text-sm font-medium ${
                  form.type === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Мышечная группа</label>
          <select
            value={form.muscleGroup}
            onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value as MuscleGroup }))}
            className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] text-base outline-none"
          >
            {MUSCLE_GROUPS.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>

        {form.type === 'bodyweight' ? (
          <>
            <div>
              <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Максимум повторений (BW)</label>
              <input type="number" value={form.repMax} onChange={e => setForm(f => ({ ...f, repMax: parseInt(e.target.value) || 0 }))}
                className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] font-[family-name:var(--font-data)] text-base outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.hasBand} onChange={e => setForm(f => ({ ...f, hasBand: e.target.checked }))}
                className="w-5 h-5 rounded accent-[var(--color-primary)]" />
              <span className="text-base">Есть резина</span>
            </div>
            {form.hasBand && (
              <>
                <div>
                  <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Максимум повторений (с резиной)</label>
                  <input type="number" value={form.repMaxAssisted} onChange={e => setForm(f => ({ ...f, repMaxAssisted: parseInt(e.target.value) || 0 }))}
                    className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] font-[family-name:var(--font-data)] text-base outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Помощь резины (%)</label>
                  <input type="number" value={form.bandAssistPercent} onChange={e => setForm(f => ({ ...f, bandAssistPercent: parseInt(e.target.value) || 0 }))}
                    className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] font-[family-name:var(--font-data)] text-base outline-none" />
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Макс повторений с текущим весом</label>
            <input type="number" value={form.repMax} onChange={e => setForm(f => ({ ...f, repMax: parseInt(e.target.value) || 0 }))}
              className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] font-[family-name:var(--font-data)] text-base outline-none" />
            <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mt-3 mb-1 block">Доступные веса (кг)</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_DUMBBELL_WEIGHTS.map(w => (
                <button
                  key={w}
                  onClick={() => setForm(f => ({
                    ...f,
                    availableWeights: f.availableWeights.includes(w)
                      ? f.availableWeights.filter(x => x !== w)
                      : [...f.availableWeights, w].sort((a, b) => a - b),
                  }))}
                  className={`w-11 h-11 rounded-xl text-sm font-medium font-[family-name:var(--font-data)] ${
                    form.availableWeights.includes(w)
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button onClick={handleAdd} disabled={!form.name.trim()} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-6 disabled:opacity-40">
        Добавить
      </button>
    </div>
  );
}
