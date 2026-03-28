import { useStore } from '../../stores/useStore';

export default function BottomNav() {
  const activeView = useStore(s => s.activeView);
  const setActiveView = useStore(s => s.setActiveView);

  const tabs = [
    { id: 'training' as const, label: 'Тренировка', icon: '🏋️' },
    { id: 'progress' as const, label: 'Прогресс', icon: '📊' },
    { id: 'settings' as const, label: 'Настройки', icon: '⚙️' },
  ];

  return (
    <nav className="flex items-center border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]" style={{ height: 56 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveView(tab.id)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
            activeView === tab.id ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)]'
          }`}
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          <span className="text-[11px] font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
