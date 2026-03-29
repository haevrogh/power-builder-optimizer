export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatWeekType(type: string): string {
  const map: Record<string, string> = {
    accumulation: 'Накопление',
    intensification: 'Интенсификация',
    peak: 'Пик',
    deload: 'Деload',
  };
  return map[type] ?? type;
}

export function formatSessionType(type: string): string {
  return type === 'heavy' ? 'Тяжёлая' : 'Лёгкая';
}

export function formatLoadConfig(config: any): string {
  if ('weight' in config) return `${config.weight} кг`;
  if (config.mode === 'band_assisted') return 'с резиной';
  if (config.mode === 'eccentric_only') return 'эксцентрика';
  return 'собственный вес';
}

export function formatDecision(decision: string): string {
  const map: Record<string, string> = {
    progress: 'ПРОГРЕССИЯ',
    hold: 'УДЕРЖАНИЕ',
    observe: 'НАБЛЮДЕНИЕ',
    reduce: 'ОТКАТ',
    unload: 'ОБЛЕГЧЕНИЕ',
    deload: 'ДЕLOAD',
    stop: 'СТОП',
  };
  return map[decision] ?? decision;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
