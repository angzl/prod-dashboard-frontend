import React, { useState, useEffect } from 'react';
import { useDataStore } from '../context/DataContext';

/* ─────────────────────────────────────────────────────────────
   Цветовые стопы (тёмная тема)
   t=0 → красный | t=0.5 → жёлтый | t=1 → зелёный
───────────────────────────────────────────────────────────── */
const BG_STOPS = [
  [0.00, [120, 20,  20]],
  [0.25, [160, 40,  10]],
  [0.50, [110, 80,   5]],
  [0.75, [ 15, 95,  40]],
  [1.00, [  8,110,  45]],
];
const TEXT_STOPS = [
  [0.00, [255,150,150]],
  [0.25, [255,185,120]],
  [0.50, [253,210, 80]],
  [0.75, [130,235,140]],
  [1.00, [ 90,225,130]],
];

function lerp(a, b, t) { return a + (b - a) * t; }

function interpStops(stops, t) {
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

function getCellStyle(value, rowMin, rowMax, invert = false) {
  const range = rowMax - rowMin;
  if (range === 0 || isNaN(value)) return null;
  let t = (value - rowMin) / range;
  if (invert) t = 1 - t;
  const [br, bg, bb] = interpStops(BG_STOPS,   t);
  const [tr, tg, tb] = interpStops(TEXT_STOPS, t);
  return {
    backgroundColor: `rgb(${br},${bg},${bb})`,
    color:           `rgb(${tr},${tg},${tb})`,
  };
}

/* ─────────────────────────────────────────────────────────────
   Метрики — ОБЪЕДИНЁННЫЕ (число + % в одной строке)
   
   Вместо отдельных строк для числа и процента —
   одна строка с числом и % под ним в одной ячейке.
   pctKey: ключ поля с процентом для этой строки.
───────────────────────────────────────────────────────────── */
const METRICS = [
  {
    key:   'total_on_platform',
    label: 'Всего ПУ',
    noBg:  true,
  },
  {
    key:    'active_pu',
    label:  'Активных',
    // процент считаем на фронте: active_pu / total_on_platform * 100
    pctFn:  (row) => {
      const total = parseFloat(row['total_on_platform']);
      const val   = parseFloat(row['active_pu']);
      return (total > 0 && !isNaN(val)) ? (val / total * 100) : NaN;
    },
  },
  {
    key:   't0_now',
    label: 'ТО сегодня',
    pctFn: (row) => {
      const total = parseFloat(row['total_on_platform']);
      const val   = parseFloat(row['t0_now']);
      return (total > 0 && !isNaN(val)) ? (val / total * 100) : NaN;
    },
  },
  {
    key:   't0_prev_day',
    label: 'ТО вчера',
    pctFn: (row) => {
      const total = parseFloat(row['total_on_platform']);
      const val   = parseFloat(row['t0_prev_day']);
      return (total > 0 && !isNaN(val)) ? (val / total * 100) : NaN;
    },
  },
  {
    key:   't0_three_days',
    label: 'ТО 3 дня',
    pctFn: (row) => {
      const total = parseFloat(row['total_on_platform']);
      const val   = parseFloat(row['t0_three_days']);
      return (total > 0 && !isNaN(val)) ? (val / total * 100) : NaN;
    },
  },
  {
    key:    'gap_pct',
    label:  'Разрыв →ТО-3',
    isPct:  true,  // поле уже процент, второй строки нет
    invert: true,
  },
  {
    key:   'bs_total',
    label: 'БС всего',
    noBg:  true,
  },
  {
    key:   'bs_online',
    label: 'БС онлайн',
    pctFn: (row) => {
      const total = parseFloat(row['bs_total']);
      const val   = parseFloat(row['bs_online']);
      return (total > 0 && !isNaN(val)) ? (val / total * 100) : NaN;
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   Форматирование
───────────────────────────────────────────────────────────── */
function fmt(num) {
  if (num == null || num === '') return '—';
  const n = parseFloat(String(num).replace(',', '.'));
  return isNaN(n) ? '—' : n.toLocaleString('ru-RU');
}
function fmtPct(num) {
  if (num == null || num === '') return '—';
  const n = parseFloat(String(num).replace(',', '.'));
  return isNaN(n) ? '—' : n.toFixed(1) + '%';
}
function parseNum(raw) {
  if (raw == null || raw === '') return NaN;
  return parseFloat(String(raw).replace(',', '.'));
}

/* ─────────────────────────────────────────────────────────────
   Хук: ширина окна
───────────────────────────────────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

/* ─────────────────────────────────────────────────────────────
   Sticky-константы
───────────────────────────────────────────────────────────── */
const PROJ_W   = 34;
const METRIC_W = 120;

/* ─────────────────────────────────────────────────────────────
   Компонент
───────────────────────────────────────────────────────────── */
function AllProjectsHistoryTable({ partners, days = 30 }) {
  const { getHistory, status } = useDataStore();
  const [hoverCol, setHoverCol] = useState(null);

  const winWidth   = useWindowWidth();
  const isMobile   = winWidth < 640;
  const metricLeft = isMobile ? 0 : PROJ_W;

  // Собираем данные из кеша контекста
  const allData = Object.fromEntries(
    (partners || []).map(p => [p, getHistory(p, days) ?? []])
  );

  const hasAnyData = Object.values(allData).some(arr => arr && arr.length > 0);

  if (!hasAnyData) {
    if (status === 'loading')
      return <div className="state-msg">⏳ Загрузка истории...</div>;
    return <div className="state-msg">Нет исторических данных в кеше</div>;
  }

  /* ── Группировка: последний срез за день ── */
  const projectGrouped = {};
  Object.keys(allData).forEach(partner => {
    const grouped = {};
    (allData[partner] || []).forEach(item => {
      const day = item.snap_datetime.split(' ')[0];
      if (!grouped[day] || item.snap_datetime > grouped[day].snap_datetime)
        grouped[day] = item;
    });
    projectGrouped[partner] = grouped;
  });



  const allDates = Array.from(
    new Set(Object.values(projectGrouped).flatMap(g => Object.keys(g)))
  ).sort();

  if (allDates.length === 0)
    return <div className="state-msg">Нет исторических данных</div>;

  const projectList  = Object.keys(projectGrouped).sort();
  const multiProject = projectList.length > 1;

  /* ── min/max по каждой строке (по всем датам) ── */
  const rowRanges = {};
  projectList.forEach(partner => {
    rowRanges[partner] = {};
    const grouped = projectGrouped[partner];
    METRICS.forEach(m => {
      if (m.noBg) return;
      // Градиент считаем по основному числовому ключу
      // (для isPct-строк — по самому полю, для остальных — по числу)
      const colorKey = m.isPct ? m.key : (m.key);
      const vals = allDates
        .map(d => {
          const row = grouped[d];
          if (!row) return NaN;
          return parseNum(row[colorKey]);
        })
        .filter(v => !isNaN(v));
      rowRanges[partner][m.key] = {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
      };
    });
  });

  /* ── Стили sticky ── */
  const stickyProj = {
    position:      'sticky',
    left:          0,
    zIndex:        12,
    width:         PROJ_W,
    minWidth:      PROJ_W,
    maxWidth:      PROJ_W,
    background:    'var(--surface2)',
    boxShadow:     'inset -1px 0 0 var(--border)',
    padding:       0,
    verticalAlign: 'middle',
    textAlign:     'center',
  };

  const stickyMetric = {
    position:    'sticky',
    left:        metricLeft,
    zIndex:      11,
    width:       METRIC_W,
    minWidth:    METRIC_W,
    maxWidth:    METRIC_W,
    background:  'var(--surface2)',
    // тень вместо border — нет просветов при прокрутке
    boxShadow:   '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border)',
    textAlign:   'left',
    paddingLeft: 10,
    paddingRight: 6,
    color:       'var(--text-muted)',
    fontSize:    11,
    fontWeight:  400,
    whiteSpace:  'nowrap',
  };

  /* ── Рендер одного проекта ── */
  const renderProject = (partner, projIdx) => {
    const grouped  = projectGrouped[partner];
    const ranges   = rowRanges[partner];
    const rowCount = METRICS.length;

    return (
      <React.Fragment key={partner}>
        {METRICS.map((metric, mIdx) => {
          const isPlain  = !!metric.noBg;
          const isPctOnly = !!metric.isPct; // строка только с %, без числа выше
          const range    = ranges[metric.key] || { min: 0, max: 0 };

          // Чередование фона
          const rowBg = mIdx % 2 === 0 ? 'var(--surface)' : 'rgba(255,255,255,0.02)';

          return (
            <tr key={`${partner}-${metric.key}`} style={{ background: rowBg }}>

              {/* Вертикальная полоса проекта — десктоп, только 1-я строка */}
              {!isMobile && mIdx === 0 && (
                <td rowSpan={rowCount} style={stickyProj}>
                  <span style={{
                    display:       'block',
                    writingMode:   'vertical-rl',
                    transform:     'rotate(180deg)',
                    fontSize:      10,
                    fontWeight:    700,
                    color:         '#a5b4fc',
                    letterSpacing: '0.5px',
                    whiteSpace:    'nowrap',
                    padding:       '8px 0',
                    userSelect:    'none',
                  }}>
                    {partner}
                  </span>
                </td>
              )}

              {/* Колонка «Метрика» — sticky */}
              <td style={stickyMetric}>
                {/* Имя проекта на мобиле перед первой метрикой */}
                {isMobile && mIdx === 0 && multiProject && (
                  <span style={{
                    display: 'block', color: '#a5b4fc',
                    fontWeight: 700, fontStyle: 'normal',
                    fontSize: 10, marginBottom: 2,
                  }}>
                    {partner}
                  </span>
                )}
                {metric.label}
              </td>

              {/* Данные */}
              {allDates.map((date, colIdx) => {
                const row = grouped[date];
                const isHovered = hoverCol === colIdx;

                if (!row) {
                  return (
                    <td key={date} style={{
                      padding: '5px 8px', minWidth: 70, textAlign: 'right',
                      color: 'var(--text-muted)', fontSize: 11,
                      outline: isHovered ? '1px solid rgba(165,180,252,0.4)' : undefined,
                      outlineOffset: '-1px',
                    }}
                      onMouseEnter={() => setHoverCol(colIdx)}
                      onMouseLeave={() => setHoverCol(null)}
                    >—</td>
                  );
                }

                // Значение для градиента — основное числовое поле
                const colorVal = parseNum(row[metric.key]);
                const gradStyle = (!isPlain && !isNaN(colorVal))
                  ? getCellStyle(colorVal, range.min, range.max, metric.invert)
                  : null;

                // Основное значение
                const numDisplay = isPctOnly
                  ? fmtPct(row[metric.key])
                  : fmt(row[metric.key]);

                // Процент — считаем через pctFn прямо здесь
                const pctVal     = metric.pctFn ? metric.pctFn(row) : null;
                const pctDisplay = (pctVal !== null && !isNaN(pctVal))
                  ? pctVal.toFixed(1) + '%'
                  : null;

                const textColor = gradStyle
                  ? gradStyle.color
                  : isPlain ? 'var(--text-muted)' : 'var(--text)';

                // Цвет % — тот же оттенок что и основной, но чуть прозрачнее
                const pctColor = gradStyle
                  ? (() => {
                      const parts = gradStyle.color.match(/\d+/g);
                      return parts
                        ? `rgba(${parts[0]},${parts[1]},${parts[2]},0.72)`
                        : 'var(--text-muted)';
                    })()
                  : 'var(--text-muted)';

                return (
                  <td
                    key={date}
                    style={{
                      padding:    '4px 8px',
                      minWidth:   70,
                      textAlign:  'right',
                      fontVariantNumeric: 'tabular-nums',
                      verticalAlign: 'middle',
                      backgroundColor: gradStyle ? gradStyle.backgroundColor : undefined,
                      outline:    isHovered ? '1px solid rgba(165,180,252,0.4)' : undefined,
                      outlineOffset: '-1px',
                    }}
                    onMouseEnter={() => setHoverCol(colIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                  >
                    {/* Основное число */}
                    <div style={{
                      fontSize:   isPlain ? 11 : 12,
                      fontWeight: isPlain ? 400 : 700,
                      color:      textColor,
                      lineHeight: pctDisplay ? 1.2 : 1.4,
                    }}>
                      {numDisplay}
                    </div>

                    {/* % под числом */}
                    {pctDisplay && (
                      <div style={{
                        fontSize:   10,
                        fontWeight: 500,
                        color:      pctColor,
                        lineHeight: 1.2,
                        marginTop:  1,
                      }}>
                        {pctDisplay}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}

        {/* Разделитель между проектами */}
        {multiProject && projIdx < projectList.length - 1 && (
          <tr>
            <td
              colSpan={allDates.length + (isMobile ? 1 : 2)}
              style={{
                height: 6, padding: 0,
                background: 'var(--bg)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}
            />
          </tr>
        )}
      </React.Fragment>
    );
  };

  /* ── Стили заголовков thead ── */
  const thBase = {
    position:      'sticky',
    top:           0,
    background:    'var(--surface2)',
    color:         'var(--text-muted)',
    fontSize:      10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding:       '8px 8px',
    fontWeight:    600,
    whiteSpace:    'nowrap',
    boxShadow:     'inset 0 -1px 0 var(--border)',
  };

  return (
    <div
      className="hist-wrap"
      style={{
        overflowX:    'auto',
        overflowY:    'auto',
        maxHeight:    '70vh',
        borderRadius: 'var(--radius)',
        border:       '1px solid var(--border)',
        boxShadow:    'var(--shadow)',
        position:     'relative',
        background:   'var(--surface)',
      }}
    >
      <table style={{
        borderCollapse: 'collapse',
        fontSize:       12,
        width:          '100%',
        tableLayout:    'auto',
      }}>
        <thead>
          <tr>
            {/* Угловая: проект (десктоп) */}
            {!isMobile && (
              <th style={{
                ...thBase,
                position:  'sticky', top: 0, left: 0,
                zIndex:    130,
                width:     PROJ_W, minWidth: PROJ_W, maxWidth: PROJ_W,
                padding:   '8px 2px', textAlign: 'center',
                boxShadow: 'inset 0 -1px 0 var(--border), inset -1px 0 0 var(--border)',
              }} />
            )}

            {/* Угловая: метрика */}
            <th style={{
              ...thBase,
              position:  'sticky', top: 0, left: metricLeft,
              zIndex:    130,
              width:     METRIC_W, minWidth: METRIC_W,
              textAlign: 'left',
              boxShadow: '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border)',
            }}>
              Метрика
            </th>

            {/* Даты — sticky только top */}
            {allDates.map((date, colIdx) => (
              <th
                key={date}
                style={{
                  ...thBase,
                  zIndex:    100,
                  minWidth:  70,
                  textAlign: 'right',
                  cursor:    'default',
                  color:     hoverCol === colIdx ? '#a5b4fc' : 'var(--text-muted)',
                  transition:'color 0.15s',
                  outline:   hoverCol === colIdx
                    ? '1px solid rgba(165,180,252,0.4)' : undefined,
                  outlineOffset: '-1px',
                }}
                onMouseEnter={() => setHoverCol(colIdx)}
                onMouseLeave={() => setHoverCol(null)}
              >
                {date.slice(5)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {projectList.map((partner, idx) => renderProject(partner, idx))}
        </tbody>
      </table>
    </div>
  );
}

export default AllProjectsHistoryTable;
