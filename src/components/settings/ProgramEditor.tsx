import { useState } from 'react';
import { useStore } from '../../stores/useStore';

export default function ProgramEditor() {
  const exercises = useStore(s => s.exercises);
  const programs = useStore(s => s.programs);
  const createProgram = useStore(s => s.createProgram);
  const deleteProgram = useStore(s => s.deleteProgram);
  const setActiveProgram = useStore(s => s.setActiveProgram);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const activeProgram = programs.find(p => p.isActive);

  const toggleExercise = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelectedIds(prev => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  };

  const moveDown = (idx: number) => {
    if (idx >= selectedIds.length - 1) return;
    setSelectedIds(prev => {
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.length === 0) return;
    await createProgram(name.trim(), selectedIds);
    setShowCreate(false);
    setName('');
    setSelectedIds([]);
  };

  return (
    <div className="bg-[var(--color-surface-dim)] rounded-2xl p-4 border border-[var(--color-outline-variant)]/50 mb-3">
      <h2 className="font-[family-name:var(--font-display)] font-bold mb-2">Программа тренировок</h2>

      {activeProgram && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-medium">{activeProgram.name}</span>
              <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[var(--color-progress-container)] text-[var(--color-progress)]">Активна</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {activeProgram.exerciseIds.map((id, i) => {
              const ex = exercises.find(e => e.id === id);
              return (
                <div key={id} className="flex items-center gap-2 py-1.5 px-2 bg-[var(--color-surface)] rounded-lg text-sm">
                  <span className="font-[family-name:var(--font-data)] text-xs text-[var(--color-on-surface-variant)] w-5">{i + 1}.</span>
                  <span className="flex-1">{ex?.name ?? '?'}</span>
                  <span className="text-xs text-[var(--color-on-surface-variant)]">{ex?.type === 'bodyweight' ? 'BW' : 'DB'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other (inactive) programs */}
      {programs.filter(p => !p.isActive).map(prog => (
        <div key={prog.id} className="flex items-center justify-between py-2 border-b border-[var(--color-outline-variant)] last:border-b-0">
          <div>
            <span className="text-sm">{prog.name}</span>
            <span className="text-xs text-[var(--color-on-surface-variant)] ml-2">{prog.exerciseIds.length} упр.</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveProgram(prog.id)} className="text-xs text-[var(--color-primary)]">Активировать</button>
            <button onClick={() => {
              if (confirm(`Удалить программу "${prog.name}"?`)) deleteProgram(prog.id);
            }} className="text-xs text-[var(--color-danger)]">Удалить</button>
          </div>
        </div>
      ))}

      {showCreate ? (
        <div className="mt-3 flex flex-col gap-3 animate-fade-in">
          <div>
            <p className="text-xs font-medium text-[var(--color-on-surface-variant)] mb-1">Название программы</p>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Например: Push-Pull, Верх тела..."
              className="w-full h-10 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline-variant)] text-sm outline-none focus:border-[var(--color-primary)]" />
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--color-on-surface-variant)] mb-1">
              Выбери упражнения (порядок = порядок в тренировке)
            </p>
            {exercises.length === 0 && (
              <p className="text-xs text-[var(--color-on-surface-variant)]">Сначала добавь упражнения выше</p>
            )}
            {exercises.map(ex => {
              const isSelected = selectedIds.includes(ex.id);
              const idx = selectedIds.indexOf(ex.id);
              return (
                <div key={ex.id} className="flex items-center gap-2 py-1.5">
                  <button onClick={() => toggleExercise(ex.id)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]'
                    }`}>
                    {isSelected ? idx + 1 : ''}
                  </button>
                  <span className={`flex-1 text-sm ${isSelected ? 'font-medium' : 'text-[var(--color-on-surface-variant)]'}`}>
                    {ex.name}
                  </span>
                  {isSelected && (
                    <div className="flex gap-1">
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="w-7 h-7 rounded-md bg-[var(--color-surface-container)] text-xs disabled:opacity-30">↑</button>
                      <button onClick={() => moveDown(idx)} disabled={idx >= selectedIds.length - 1}
                        className="w-7 h-7 rounded-md bg-[var(--color-surface-container)] text-xs disabled:opacity-30">↓</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(false); setSelectedIds([]); setName(''); }}
              className="h-10 px-4 rounded-xl text-sm text-[var(--color-on-surface-variant)]">Отмена</button>
            <button onClick={handleCreate} disabled={!name.trim() || selectedIds.length === 0}
              className="flex-1 h-12 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium disabled:opacity-40">
              Создать программу
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)}
          className="mt-2 h-10 w-full border border-dashed border-[var(--color-outline)] rounded-xl text-sm text-[var(--color-primary)]">
          + Создать программу
        </button>
      )}
    </div>
  );
}
