import { useState } from 'react';
import { useStore } from '../../stores/useStore';
import type { MuscleGroup, ExerciseType } from '../../types';
import { DEFAULT_DUMBBELL_WEIGHTS } from '../../engine/constants';
import { getTrainingLevel } from '../../types';
import { db } from '../../db';
import ProgramEditor from './ProgramEditor';

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

export default function SettingsScreen() {
  const user = useStore(s => s.user);
  const exercises = useStore(s => s.exercises);
  const saveUser = useStore(s => s.saveUser);
  const addExercise = useStore(s => s.addExercise);
  const deleteExercise = useStore(s => s.deleteExercise);
  const vacations = useStore(s => s.vacations);
  const addVacation = useStore(s => s.addVacation);
  const deleteVacation = useStore(s => s.deleteVacation);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(user ? { ...user } : null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddVacation, setShowAddVacation] = useState(false);
  const [vacForm, setVacForm] = useState({ startDate: '', endDate: '', label: '', partialTraining: false });

  if (!user) return null;

  const level = getTrainingLevel(user.trainingAgeMonths);
  const levelNames: Record<string, string> = {
    absolute_beginner: 'Абсолютный новичок',
    beginner: 'Новичок',
    intermediate_early: 'Средний (ранний)',
    intermediate_late: 'Средний (поздний)',
    advanced: 'Продвинутый',
  };

  const handleExport = () => {
    const data = { user, exercises, mesocycles: useStore.getState().mesocycles, sessionLogs: useStore.getState().sessionLogs, vacations };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volume-optimizer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold mb-4">Настройки</h1>

      {/* Profile section */}
      <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-[family-name:var(--font-display)] font-bold">Профиль</h2>
          <button onClick={() => { setEditingProfile(!editingProfile); setProfileForm({ ...user }); }} className="text-sm text-[var(--color-primary)]">
            {editingProfile ? 'Отмена' : 'Изменить'}
          </button>
        </div>
        {editingProfile && profileForm ? (
          <div className="flex flex-col gap-3">
            <ProfileField label="Вес (кг)" value={profileForm.bodyweight} onChange={v => setProfileForm(p => p ? { ...p, bodyweight: v } : p)} />
            <ProfileField label="Рост (см)" value={profileForm.height} onChange={v => setProfileForm(p => p ? { ...p, height: v } : p)} />
            <ProfileField label="Возраст" value={profileForm.age} onChange={v => setProfileForm(p => p ? { ...p, age: v } : p)} />
            <ProfileField label="Стаж (мес)" value={profileForm.trainingAgeMonths} onChange={v => setProfileForm(p => p ? { ...p, trainingAgeMonths: v } : p)} />
            <button onClick={async () => {
              if (profileForm) {
                const { id, createdAt, ...rest } = profileForm;
                await saveUser(rest);
                setEditingProfile(false);
              }
            }} className="h-12 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium">Сохранить</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-[var(--color-on-surface-variant)]">Вес:</span> {user.bodyweight} кг</div>
            <div><span className="text-[var(--color-on-surface-variant)]">Рост:</span> {user.height} см</div>
            <div><span className="text-[var(--color-on-surface-variant)]">Возраст:</span> {user.age}</div>
            <div><span className="text-[var(--color-on-surface-variant)]">Стаж:</span> {user.trainingAgeMonths} мес</div>
            <div className="col-span-2"><span className="text-[var(--color-on-surface-variant)]">Уровень:</span> {levelNames[level]}</div>
          </div>
        )}
      </div>

      {/* Exercises */}
      <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
        <h2 className="font-[family-name:var(--font-display)] font-bold mb-2">Упражнения</h2>
        {exercises.map(e => (
          <div key={e.id} className="flex items-center justify-between py-2 border-b border-[var(--color-outline-variant)] last:border-b-0">
            <div>
              <div className="font-medium text-sm">{e.name}</div>
              <div className="text-xs text-[var(--color-on-surface-variant)]">
                {e.type === 'bodyweight' ? 'Свой вес' : 'Гантели'} · {MUSCLE_GROUPS.find(g => g.value === e.muscleGroup)?.label}
                {e.type === 'dumbbell' && e.availableWeights ? ` · ${e.availableWeights[0]}–${e.availableWeights[e.availableWeights.length - 1]} кг` : ''}
                {e.type === 'bodyweight' ? ` · макс ${e.repMax} повт` : ''}
              </div>
            </div>
            <button onClick={() => {
              if (confirm(`Удалить "${e.name}"? Это действие нельзя отменить.`)) deleteExercise(e.id);
            }} className="text-xs text-[var(--color-danger)]">Удалить</button>
          </div>
        ))}
        {showAddExercise ? (
          <AddExerciseForm
            onAdd={addExercise}
            onCancel={() => setShowAddExercise(false)}
          />
        ) : (
          <button onClick={() => setShowAddExercise(true)} className="mt-2 h-10 w-full border border-dashed border-[var(--color-outline)] rounded-xl text-sm text-[var(--color-primary)]">
            + Добавить упражнение
          </button>
        )}
      </div>

      {/* Program */}
      <ProgramEditor />

      {/* Vacations */}
      <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
        <h2 className="font-[family-name:var(--font-display)] font-bold mb-2">Отпуск / Каникулы</h2>
        {vacations.map(v => (
          <div key={v.id} className="flex items-center justify-between py-2 border-b border-[var(--color-outline-variant)] last:border-b-0">
            <div className="text-sm">{v.label || 'Отпуск'}: {new Date(v.startDate).toLocaleDateString('ru-RU')} — {new Date(v.endDate).toLocaleDateString('ru-RU')}</div>
            <button onClick={() => deleteVacation(v.id)} className="text-xs text-[var(--color-danger)]">✕</button>
          </div>
        ))}
        {showAddVacation ? (
          <div className="mt-2 flex flex-col gap-2">
            <Label text="Название (опционально)" />
            <input type="text" value={vacForm.label} onChange={e => setVacForm(f => ({ ...f, label: e.target.value }))} placeholder="Отпуск, Командировка..."
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <Label text="Начало" />
            <input type="date" value={vacForm.startDate} onChange={e => setVacForm(f => ({ ...f, startDate: e.target.value }))}
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <Label text="Конец" />
            <input type="date" value={vacForm.endDate} onChange={e => setVacForm(f => ({ ...f, endDate: e.target.value }))}
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <div className="flex gap-2 mt-1">
              <button onClick={async () => {
                if (vacForm.startDate && vacForm.endDate) {
                  await addVacation(vacForm);
                  setShowAddVacation(false);
                  setVacForm({ startDate: '', endDate: '', label: '', partialTraining: false });
                }
              }} className="flex-1 h-10 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium">Добавить</button>
              <button onClick={() => setShowAddVacation(false)} className="h-10 px-4 rounded-xl text-sm text-[var(--color-on-surface-variant)]">Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddVacation(true)} className="mt-2 h-10 w-full border border-dashed border-[var(--color-outline)] rounded-xl text-sm text-[var(--color-primary)]">
            + Добавить отпуск
          </button>
        )}
      </div>

      {/* Import */}
      <label className="w-full h-12 border border-[var(--color-outline)] rounded-2xl text-sm font-medium text-[var(--color-primary)] mb-3 flex items-center justify-center cursor-pointer">
        Импортировать данные (JSON)
        <input type="file" accept=".json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.user) await db.users.put(data.user);
            if (data.exercises) for (const ex of data.exercises) await db.exercises.put(ex);
            if (data.mesocycles) for (const m of data.mesocycles) await db.mesocycles.put(m);
            if (data.sessionLogs) for (const l of data.sessionLogs) await db.sessionLogs.put(l);
            if (data.vacations) for (const v of data.vacations) await db.vacations.put(v);
            window.location.reload();
          } catch { alert('Ошибка чтения файла'); }
        }} />
      </label>

      {/* Export */}
      <button onClick={handleExport} className="w-full h-12 border border-[var(--color-outline)] rounded-2xl text-sm font-medium text-[var(--color-primary)] mb-3">
        Экспортировать данные (JSON)
      </button>
    </div>
  );
}

// ─── Add Exercise Form (full, with 10RM approach) ───

function AddExerciseForm({ onAdd, onCancel }: {
  onAdd: (config: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'basics' | 'test'>('basics');
  const [form, setForm] = useState({
    name: '',
    type: 'bodyweight' as ExerciseType,
    muscleGroup: 'back_lats' as MuscleGroup,
    // Bodyweight fields
    hasBand: true,
    bandAssistPercent: 30,
    eccentricOption: true,
    repMaxBW: 3,
    repMaxBand: 10,
    // Dumbbell fields
    tenRmWeight: 20,
    availableWeights: [...DEFAULT_DUMBBELL_WEIGHTS],
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    if (form.type === 'bodyweight') {
      await onAdd({
        name: form.name,
        type: 'bodyweight',
        muscleGroup: form.muscleGroup,
        repMax: form.repMaxBW,
        repMaxAssisted: form.hasBand ? form.repMaxBand : undefined,
        assistOptions: form.hasBand ? { hasBand: true, bandAssistPercent: form.bandAssistPercent } : undefined,
        eccentricOption: form.eccentricOption,
      });
    } else {
      // Find the closest available weight to the 10RM weight
      const closest = form.availableWeights.length > 0
        ? form.availableWeights.reduce((prev, curr) =>
            Math.abs(curr - form.tenRmWeight) < Math.abs(prev - form.tenRmWeight) ? curr : prev)
        : form.tenRmWeight;
      await onAdd({
        name: form.name,
        type: 'dumbbell',
        muscleGroup: form.muscleGroup,
        repMax: 10, // 10RM by definition
        currentWeight: closest,
        availableWeights: form.availableWeights,
      });
    }
    onCancel();
  };

  // === STEP 2: 10RM Test ===
  if (step === 'test') {
    return (
      <div className="mt-3 flex flex-col gap-4 animate-fade-in">
        <div className="bg-[var(--color-primary-container)] rounded-xl p-3">
          <p className="text-xs font-medium text-[var(--color-primary)] mb-1">Тест для определения нагрузки</p>
          {form.type === 'dumbbell' ? (
            <p className="text-xs text-[var(--color-on-surface)]">
              Возьми гантель и найди вес, который можешь поднять <strong>ровно 10 раз</strong> с хорошей техникой. Последние 2 повтора должны быть тяжёлыми, но без отказа (RPE 8).
            </p>
          ) : (
            <p className="text-xs text-[var(--color-on-surface)]">
              Сделай максимум повторений с <strong>чистой техникой</strong>. Не нужно до отказа — остановись когда техника начинает ломаться.
            </p>
          )}
        </div>

        {form.type === 'bodyweight' ? (
          <>
            <div>
              <Label text="Максимум повторений (свой вес)" />
              <Hint text="Сколько раз можешь выполнить без помощи?" />
              <NumInput value={form.repMaxBW} onChange={v => setForm(f => ({ ...f, repMaxBW: v }))} />
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.hasBand} onChange={e => setForm(f => ({ ...f, hasBand: e.target.checked }))}
                className="w-5 h-5 rounded accent-[var(--color-primary)]" />
              <span className="text-sm">Есть резина (эспандер-ассистент)</span>
            </div>

            {form.hasBand && (
              <>
                <div>
                  <Label text="Максимум повторений (с резиной)" />
                  <Hint text="Сколько раз с помощью резины?" />
                  <NumInput value={form.repMaxBand} onChange={v => setForm(f => ({ ...f, repMaxBand: v }))} />
                </div>
                <div>
                  <Label text="Помощь резины (% от веса тела)" />
                  <Hint text="Примерно: тонкая ~15%, средняя ~25%, толстая ~35%" />
                  <NumInput value={form.bandAssistPercent} onChange={v => setForm(f => ({ ...f, bandAssistPercent: v }))} />
                </div>
              </>
            )}

            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.eccentricOption} onChange={e => setForm(f => ({ ...f, eccentricOption: e.target.checked }))}
                className="w-5 h-5 rounded accent-[var(--color-primary)]" />
              <span className="text-sm">Могу делать медленный спуск (эксцентрика)</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label text="Вес 10RM (кг)" />
              <Hint text="Какой вес поднимешь ровно 10 раз?" />
              <NumInput value={form.tenRmWeight} onChange={v => setForm(f => ({ ...f, tenRmWeight: v }))} />
            </div>

            <div>
              <Label text="Доступные веса гантелей (кг)" />
              <Hint text="Отметь все веса, которые есть в зале" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {DEFAULT_DUMBBELL_WEIGHTS.map(w => (
                  <button key={w} onClick={() => setForm(f => ({
                    ...f,
                    availableWeights: f.availableWeights.includes(w)
                      ? f.availableWeights.filter(x => x !== w)
                      : [...f.availableWeights, w].sort((a, b) => a - b),
                  }))}
                    className={`w-10 h-10 rounded-lg text-xs font-medium font-[family-name:var(--font-data)] ${
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

        <div className="flex gap-2 mt-1">
          <button onClick={() => setStep('basics')} className="h-10 px-4 rounded-xl text-sm text-[var(--color-on-surface-variant)]">← Назад</button>
          <button onClick={handleSubmit} className="flex-1 h-12 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium">
            Добавить упражнение
          </button>
        </div>
      </div>
    );
  }

  // === STEP 1: Basics ===
  return (
    <div className="mt-3 flex flex-col gap-3 animate-fade-in">
      <div>
        <Label text="Название упражнения" />
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Подтягивания, Жим гантелей..."
          className="w-full h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none focus:border-[var(--color-primary)]" />
      </div>

      <div>
        <Label text="Тип нагрузки" />
        <div className="flex gap-2">
          {([['bodyweight', 'Свой вес'], ['dumbbell', 'Гантели']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setForm(f => ({ ...f, type: val }))}
              className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                form.type === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface)]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label text="Мышечная группа" />
        <select value={form.muscleGroup} onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value as MuscleGroup }))}
          className="w-full h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none">
          {MUSCLE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="h-10 px-4 rounded-xl text-sm text-[var(--color-on-surface-variant)]">Отмена</button>
        <button onClick={() => { if (form.name.trim()) setStep('test'); }}
          disabled={!form.name.trim()}
          className="flex-1 h-12 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium disabled:opacity-40">
          Далее: тест 10RM →
        </button>
      </div>
    </div>
  );
}

// ─── Small UI helpers ───

function Label({ text }: { text: string }) {
  return <p className="text-xs font-medium text-[var(--color-on-surface-variant)] mb-1">{text}</p>;
}

function Hint({ text }: { text: string }) {
  return <p className="text-[11px] text-[var(--color-on-surface-variant)] mb-1">{text}</p>;
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
      className="w-full h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm font-[family-name:var(--font-data)] outline-none focus:border-[var(--color-primary)]" />
  );
}

function ProfileField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--color-on-surface-variant)]">{label}</span>
      <input type="number" inputMode="numeric"
        value={focused ? draft : String(value)}
        onFocus={() => { setFocused(true); setDraft(String(value)); }}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setFocused(false); onChange(parseInt(draft) || 0); }}
        className="w-24 h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm font-[family-name:var(--font-data)] text-right outline-none" />
    </div>
  );
}
