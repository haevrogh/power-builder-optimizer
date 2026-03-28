import { useState, useEffect } from 'react';
import { useStore } from '../../stores/useStore';

export default function ProfileSetup({ onNext }: { onNext: () => void }) {
  const saveUser = useStore(s => s.saveUser);
  const [form, setForm] = useState({
    bodyweight: 80,
    height: 175,
    age: 30,
    trainingAgeMonths: 24,
    sessionsPerWeek: 2,
    goals: 'both' as 'strength' | 'hypertrophy' | 'both',
  });

  const handleSubmit = async () => {
    await saveUser(form);
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col px-4 pt-12 pb-8">
      <h1 className="font-[family-name:var(--font-display)] text-[28px] font-bold mb-1">Volume Optimizer</h1>
      <p className="text-[var(--color-on-surface-variant)] text-sm mb-8">Заполни профиль для начала</p>

      <div className="flex flex-col gap-4 flex-1">
        <Field label="Вес (кг)" value={form.bodyweight} onChange={v => setForm(f => ({ ...f, bodyweight: v }))} min={40} max={200} />
        <Field label="Рост (см)" value={form.height} onChange={v => setForm(f => ({ ...f, height: v }))} min={140} max={220} />
        <Field label="Возраст" value={form.age} onChange={v => setForm(f => ({ ...f, age: v }))} min={14} max={70} />
        <Field label="Стаж тренировок (мес)" value={form.trainingAgeMonths} onChange={v => setForm(f => ({ ...f, trainingAgeMonths: v }))} min={0} max={240} />

        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Тренировок в неделю</label>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setForm(f => ({ ...f, sessionsPerWeek: n }))}
                className={`flex-1 h-12 rounded-xl text-base font-medium transition-colors ${
                  form.sessionsPerWeek === n
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">Цель</label>
          <div className="flex gap-2">
            {([['strength', 'Сила'], ['hypertrophy', 'Масса'], ['both', 'Оба']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setForm(f => ({ ...f, goals: val }))}
                className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                  form.goals === val
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full h-14 bg-[var(--color-primary)] text-white rounded-2xl text-base font-medium mt-6"
      >
        Далее
      </button>
    </div>
  );
}

function Field({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Sync draft when value changes externally (and field is not focused)
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-1 block">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={focused ? draft : String(value)}
        onFocus={() => {
          setFocused(true);
          setDraft(String(value));
        }}
        onChange={e => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          setFocused(false);
          const v = parseInt(draft) || min;
          onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-full h-12 px-4 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-outline-variant)] text-base font-[family-name:var(--font-data)] outline-none focus:border-[var(--color-primary)] transition-colors"
      />
    </div>
  );
}
