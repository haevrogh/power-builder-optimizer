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
  const [step, setStep] = useState<'basics' | 'test'>('basics');
  const [form, setForm] = useState({
    name: '',
    type: 'bodyweight' as ExerciseType,
    muscleGroup: 'back_lats' as MuscleGroup,
    // Bodyweight
    hasBand: true,
    bandAssistPercent: 30,
    eccentricOption: true,
    repMaxBW: 3,
    repMaxBand: 10,
    // Dumbbell
    tenRmWeight: 20,
    availableWeights: [...DEFAULT_DUMBBELL_WEIGHTS],
  });

  const handleAdd = async () => {
    if (!form.name.trim()) return;

    if (form.type === 'bodyweight') {
      await addExercise({
        name: form.name,
        type: 'bodyweight',
        muscleGroup: form.muscleGroup,
        repMax: form.repMaxBW,
        repMaxAssisted: form.hasBand ? form.repMaxBand : undefined,
        assistOptions: form.hasBand ? { hasBand: true, bandAssistPercent: form.bandAssistPercent } : undefined,
        eccentricOption: form.eccentricOption,
      });
    } else {
      const closest = form.availableWeights.length > 0
        ? form.availableWeights.reduce((prev, curr) =>
            Math.abs(curr - form.tenRmWeight) < Math.abs(prev - form.tenRmWeight) ? curr : prev)
        : form.tenRmWeight;
      await addExercise({
        name: form.name,
        type: 'dumbbell',
        muscleGroup: form.muscleGroup,
        repMax: 10,
        currentWeight: closest,
        availableWeights: form.availableWeights,
      });
    }
    setAdding(false);
    setStep('basics');
  };

  // === Exercise list (after adding at least one) ===
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
                {e.type === 'bodyweight' ? 'Свой вес' : 'Гантели'}
                {e.type === 'bodyweight' ? ` · макс ${e.repMax} повт` : ` · 10RM: ${e.currentWeight ?? '?'} кг`}
                {e.repMaxAssisted ? ` · резина: ${e.repMaxAssisted} повт` : ''}
              </div>
            </div>
          ))}

          <button onClick={() => { setForm(f => ({ ...f, name: '' })); setAdding(true); setStep('basics'); }}
            className="h-12 border border-dashed border-[var(--color-outline)] rounded-2xl text-[var(--color-primary)] font-medium">
            + Добавить ещё
          </button>
        </div>

        <button onClick={onDone} className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-6">
          Начать тренировки
        </button>
      </div>
    );
  }

  // === Step 2: 10RM Test ===
  if (step === 'test') {
    return (
      <div className="flex-1 flex flex-col px-4 pt-12 pb-8">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1">Тест нагрузки</h1>
        <p className="text-[var(--color-on-surface-variant)] text-sm mb-4">{form.name}</p>

        <div className="bg-[var(--color-primary-container)] rounded-2xl p-4 mb-6">
          {form.type === 'dumbbell' ? (
            <>
              <p className="text-sm font-medium text-[var(--color-primary)] mb-1">Как определить 10RM</p>
              <p className="text-xs text-[var(--color-on-surface)]">
                Возьми гантель и найди вес, который можешь поднять <strong>ровно 10 раз</strong> с правильной техникой.
                Последние 2 повтора должны быть тяжёлыми, но без отказа (RPE 8).
                Это твой стартовый рабочий вес.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--color-primary)] mb-1">Как протестировать</p>
              <p className="text-xs text-[var(--color-on-surface)]">
                Сделай максимум повторений с <strong>чистой техникой</strong>.
                Остановись когда техника начинает ломаться — не нужно до отказа.
                Это твой текущий максимум.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-5 flex-1 overflow-y-auto">
          {form.type === 'bodyweight' ? (
            <>
              <div>
                <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Максимум повторений (свой вес)</label>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] mb-1">Сколько раз можешь выполнить без помощи?</p>
                <NumInput value={form.repMaxBW} onChange={v => setForm(f => ({ ...f, repMaxBW: v }))} />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.hasBand} onChange={e => setForm(f => ({ ...f, hasBand: e.target.checked }))}
                  className="w-5 h-5 rounded accent-[var(--color-primary)]" />
                <span className="text-base">Есть резина (эспандер-ассистент)</span>
              </div>

              {form.hasBand && (
                <>
                  <div>
                    <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Максимум повторений (с резиной)</label>
                    <p className="text-[11px] text-[var(--color-on-surface-variant)] mb-1">Сколько раз с помощью резины?</p>
                    <NumInput value={form.repMaxBand} onChange={v => setForm(f => ({ ...f, repMaxBand: v }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Помощь резины (% от веса тела)</label>
                    <p className="text-[11px] text-[var(--color-on-surface-variant)] mb-1">Примерно: тонкая ~15%, средняя ~25%, толстая ~35%</p>
                    <NumInput value={form.bandAssistPercent} onChange={v => setForm(f => ({ ...f, bandAssistPercent: v }))} />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.eccentricOption} onChange={e => setForm(f => ({ ...f, eccentricOption: e.target.checked }))}
                  className="w-5 h-5 rounded accent-[var(--color-primary)]" />
                <span className="text-sm">Могу делать медленный спуск (эксцентрика 4-6 сек)</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Вес 10RM (кг)</label>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] mb-1">Какой вес поднимешь ровно 10 раз?</p>
                <NumInput value={form.tenRmWeight} onChange={v => setForm(f => ({ ...f, tenRmWeight: v }))} />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Доступные веса гантелей (кг)</label>
                <p className="text-[11px] text-[var(--color-on-surface-variant)] mb-1">Отметь все веса, которые есть в зале</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DEFAULT_DUMBBELL_WEIGHTS.map(w => (
                    <button key={w} onClick={() => setForm(f => ({
                      ...f,
                      availableWeights: f.availableWeights.includes(w)
                        ? f.availableWeights.filter(x => x !== w)
                        : [...f.availableWeights, w].sort((a, b) => a - b),
                    }))}
                      className={`w-11 h-11 rounded-xl text-sm font-medium font-[family-name:var(--font-data)] ${
                        form.availableWeights.includes(w)
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
                      }`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => setStep('basics')} className="h-14 px-6 rounded-2xl text-sm font-medium text-[var(--color-on-surface-variant)]">← Назад</button>
          <button onClick={handleAdd} className="flex-1 h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium">
            Добавить
          </button>
        </div>
      </div>
    );
  }

  // === Step 1: Basics ===
  return (
    <div className="flex-1 flex flex-col px-4 pt-12 pb-8">
      <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-1">Добавить упражнение</h1>
      <p className="text-[var(--color-on-surface-variant)] text-sm mb-6">Начни с основного упражнения</p>

      <div className="flex flex-col gap-5 flex-1">
        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Название упражнения</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Подтягивания, Жим гантелей..."
            className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] text-base outline-none focus:border-[var(--color-primary)]" />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Тип нагрузки</label>
          <div className="flex gap-2">
            {([['bodyweight', 'Свой вес'], ['dumbbell', 'Гантели']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setForm(f => ({ ...f, type: val }))}
                className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                  form.type === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1">
            {form.type === 'bodyweight' ? 'Подтягивания, отжимания, брусья — с собственным весом или резиной' : 'Жим, тяга, сгибания — с гантелями дискретных весов'}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Мышечная группа</label>
          <select value={form.muscleGroup} onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value as MuscleGroup }))}
            className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] text-base outline-none">
            {MUSCLE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
      </div>

      <button onClick={() => { if (form.name.trim()) setStep('test'); }}
        disabled={!form.name.trim()}
        className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-6 disabled:opacity-40">
        Далее: тест {form.type === 'dumbbell' ? '10RM' : 'максимума'} →
      </button>
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <input type="number" inputMode="numeric"
      value={focused ? draft : String(value)}
      onFocus={() => { setFocused(true); setDraft(String(value)); }}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setFocused(false); onChange(Math.max(0, parseInt(draft) || 0)); }}
      className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] font-[family-name:var(--font-data)] text-base outline-none focus:border-[var(--color-primary)]" />
  );
}
