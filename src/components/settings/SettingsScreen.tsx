import { useState } from 'react';
import { useStore } from '../../stores/useStore';
import type { MuscleGroup, ExerciseType } from '../../types';
import { DEFAULT_DUMBBELL_WEIGHTS } from '../../engine/constants';
import { getTrainingLevel } from '../../types';
import { db } from '../../db';

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
  const [newExercise, setNewExercise] = useState({
    name: '', type: 'bodyweight' as ExerciseType, muscleGroup: 'back_lats' as MuscleGroup,
    repMax: 5, repMaxAssisted: 10, hasBand: true, bandAssistPercent: 30, eccentricOption: true,
    availableWeights: [...DEFAULT_DUMBBELL_WEIGHTS],
  });
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
              </div>
            </div>
            <button onClick={() => {
              if (confirm(`Удалить "${e.name}"? Это действие нельзя отменить.`)) deleteExercise(e.id);
            }} className="text-xs text-[var(--color-danger)]">Удалить</button>
          </div>
        ))}
        {showAddExercise ? (
          <div className="mt-3 flex flex-col gap-2">
            <input type="text" value={newExercise.name} onChange={e => setNewExercise(f => ({ ...f, name: e.target.value }))}
              placeholder="Название" className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <div className="flex gap-2">
              {(['bodyweight', 'dumbbell'] as const).map(t => (
                <button key={t} onClick={() => setNewExercise(f => ({ ...f, type: t }))}
                  className={`flex-1 h-10 rounded-xl text-xs font-medium ${newExercise.type === t ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)]'}`}>
                  {t === 'bodyweight' ? 'Свой вес' : 'Гантели'}
                </button>
              ))}
            </div>
            <select value={newExercise.muscleGroup} onChange={e => setNewExercise(f => ({ ...f, muscleGroup: e.target.value as MuscleGroup }))}
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none">
              {MUSCLE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <input type="number" value={newExercise.repMax} onChange={e => setNewExercise(f => ({ ...f, repMax: parseInt(e.target.value) || 0 }))}
              placeholder="Макс повторений" className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm font-[family-name:var(--font-data)] outline-none" />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!newExercise.name) return;
                await addExercise({
                  name: newExercise.name, type: newExercise.type, muscleGroup: newExercise.muscleGroup,
                  repMax: newExercise.repMax,
                  ...(newExercise.type === 'bodyweight' ? {
                    assistOptions: newExercise.hasBand ? { hasBand: true, bandAssistPercent: newExercise.bandAssistPercent } : undefined,
                    eccentricOption: newExercise.eccentricOption, repMaxAssisted: newExercise.repMaxAssisted,
                  } : { availableWeights: newExercise.availableWeights }),
                });
                setShowAddExercise(false);
                setNewExercise(f => ({ ...f, name: '' }));
              }} className="flex-1 h-10 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium">Добавить</button>
              <button onClick={() => setShowAddExercise(false)} className="h-10 px-4 rounded-xl text-sm text-[var(--color-on-surface-variant)]">Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddExercise(true)} className="mt-2 h-10 w-full border border-dashed border-[var(--color-outline)] rounded-xl text-sm text-[var(--color-primary)]">
            + Добавить упражнение
          </button>
        )}
      </div>

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
            <input type="text" value={vacForm.label} onChange={e => setVacForm(f => ({ ...f, label: e.target.value }))} placeholder="Название (опционально)"
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <input type="date" value={vacForm.startDate} onChange={e => setVacForm(f => ({ ...f, startDate: e.target.value }))}
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <input type="date" value={vacForm.endDate} onChange={e => setVacForm(f => ({ ...f, endDate: e.target.value }))}
              className="h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none" />
            <div className="flex gap-2">
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

function ProfileField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--color-on-surface-variant)]">{label}</span>
      <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-24 h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm font-[family-name:var(--font-data)] text-right outline-none" />
    </div>
  );
}
