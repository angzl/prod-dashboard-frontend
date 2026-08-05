/**
 * Общие хелперы для тепловых таблиц истории.
 *
 * Цветовая заливка ячеек сделана по принципу «красно-зелёного градиента»:
 * чем больше значение относительно диапазона метрики — тем зеленее ячейка.
 * Для метрик вида «чем меньше, тем лучше» (например gap_pct) используется
 * инверсия — там зелёным будет маленькое значение.
 *
 * Раньше эти функции жили прямо внутри AllProjectsHistoryTable.jsx.
 * Вынесены в отдельный модуль, чтобы переиспользовать в агрегированной
 * таблице «Весь прод» без дублирования и без правок рабочего компонента.
 */

/* ── Цветовые стопы (тёмная тема) ──────────────────────────── */
export const BG_STOPS = [
  [0.00, [120, 20, 20]],
  [0.25, [160, 40, 10]],
  [0.50, [110, 80, 5]],
  [0.75, [15, 95, 40]],
  [1.00, [8, 110, 45]],
];

export const TEXT_STOPS = [
  [0.00, [255, 150, 150]],
  [0.25, [255, 185, 120]],
  [0.50, [253, 210, 80]],
  [0.75, [130, 235, 140]],
  [1.00, [90, 225, 130]],
];

export const COL_TYPE_BG = {
  year: '#1a2040',
  month: '#1e2438',
  day: 'var(--surface2)',
};

/* ── Математика градиента ──────────────────────────────────── */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function interpStops(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const u = (t - t0) / (t1 - t0);
      return [
        Math.round(lerp(c0[0], c1[0], u)),
        Math.round(lerp(c0[1], c1[1], u)),
        Math.round(lerp(c0[2], c1[2], u)),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Стиль ячейки по значению и диапазону метрики.
 * invert=true → «чем меньше, тем лучше» (зелёный слева).
 */
export function getCellStyle(value, rowMin, rowMax, invert = false) {
  const range = rowMax - rowMin;
  if (range === 0 || isNaN(value)) return null;
  let t = (value - rowMin) / range;
  if (invert) t = 1 - t;
  const [br, bg, bb] = interpStops(BG_STOPS, t);
  const [tr, tg, tb] = interpStops(TEXT_STOPS, t);
  return {
    backgroundColor: `rgb(${br},${bg},${bb})`,
    color: `rgb(${tr},${tg},${tb})`,
  };
}

/* ── Группировка колонок для шапки timeline ────────────────── */
export function buildColumnGroups(columns) {
  const groups = [];
  columns.forEach((col, idx) => {
    const label =
      col.type === 'year' ? 'Годы' : col.type === 'month' ? 'Месяцы' : 'Дни';
    const last = groups[groups.length - 1];
    if (last && last.type === col.type) {
      last.span += 1;
    } else {
      groups.push({ type: col.type, label, span: 1, startIdx: idx });
    }
  });
  return groups;
}

/* ── Форматирование ────────────────────────────────────────── */
export function fmt(num) {
  if (num == null || num === '') return '—';
  const n = parseFloat(String(num).replace(',', '.'));
  return isNaN(n) ? '—' : n.toLocaleString('ru-RU');
}

export function fmtPct(num) {
  if (num == null || num === '') return '—';
  const n = parseFloat(String(num).replace(',', '.'));
  return isNaN(n) ? '—' : n.toFixed(1) + '%';
}

export function parseNum(raw) {
  if (raw == null || raw === '') return NaN;
  return parseFloat(String(raw).replace(',', '.'));
}