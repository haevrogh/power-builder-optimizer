import { useRef, useEffect } from 'react';

interface Props {
  weights: number[];
  selected: number;
  onChange: (weight: number) => void;
}

export default function WeightSelector({ weights, selected, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 48;

  useEffect(() => {
    const idx = weights.indexOf(selected);
    if (idx >= 0 && containerRef.current) {
      containerRef.current.scrollTo({ top: idx * itemHeight - itemHeight, behavior: 'smooth' });
    }
  }, [selected, weights]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const idx = Math.round((scrollTop + itemHeight) / itemHeight);
    const clamped = Math.max(0, Math.min(weights.length - 1, idx));
    if (weights[clamped] !== selected) {
      onChange(weights[clamped]);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  return (
    <div className="relative h-[144px] overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ height: itemHeight }} />
        {weights.map(w => {
          const isSelected = w === selected;
          return (
            <div
              key={w}
              className="flex items-center justify-center snap-center"
              style={{ height: itemHeight, scrollSnapAlign: 'center' }}
              onClick={() => onChange(w)}
            >
              <span className={`font-[family-name:var(--font-data)] transition-all ${
                isSelected
                  ? 'text-[32px] text-[var(--color-primary)] font-medium'
                  : 'text-xl text-[var(--color-on-surface-variant)] opacity-50'
              }`}>
                {w}
              </span>
            </div>
          );
        })}
        <div style={{ height: itemHeight }} />
      </div>
      {/* Selection highlight */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ top: itemHeight, height: itemHeight }}>
        <div className="h-full border-y border-[var(--color-outline-variant)]" />
      </div>
    </div>
  );
}
