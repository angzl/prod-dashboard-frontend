import React, { useState, useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────
   Цветовые стопы (тёмная тема)
   t=0 → красный | t=0.5 → жёлтый | t=1 → зелёный
───────────────────────────────────────────── */
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

function cellStyle(value, rowMin, rowMax, invert = false) {
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

/* ─────────────────────────────────────────────
   Метрики
───────────────────────────────────────────── */
const METRICS = [
  { key: 'total_on_platform',  label: 'Всего ПУ',        noBg: true              },
  { key: 'active_pu',          label: 'Активных'                                  },
  { key: 'active_pct',         label: '% активных',      isPct: true              },
  { key: 't0_now',             label: 'ТО сегодня'                                },
  { key: 't0_now_pct',         label: '% ТО сег.',       isPct: true              },
  { key: 't0_prev_day',        label: 'ТО вчера'                                  },
  { key: 't0_prev_day_pct',    label: '% ТО вч.',        isPct: true              },
  { key: 't0_three_days',      label: 'ТО 3 дня'                                  },
  { key: 't0_three_days_pct',  label: '% ТО 3д.',        isPct: true              },
  { key: 'gap_pct',            label: 'Разрыв →ТО-3',    isPct: true, invert: true },
  { key: 'bs_total',           label: 'БС всего',         noBg: true              },
  { key: 'bs_online',          label: 'БС онлайн'                                 },
  { key: 'bs_metric_pct',      label: '% БС',             isPct: true             },
];

/* ─────────────────────────────────────────────
   Форматирование
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   Хук: ширина окна
───────────────────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

/* ─────────────────────────────────────────────
   Компонент
───────────────────────────────────────────── */
function AllProjectsHistoryTable({ partners, days = 30 }) {
  const apiBase  = import.meta.env.VITE_API_URL || '';
  const [allData, setAllData]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const wrapRef  = useRef(null);
  const winWidth = useWindowWidth();

  // На мобиле (< 640px) не показываем sticky-полосу проекта
  const isMobile = winWidth < 640;

  // Ширины sticky-колонок
  const PROJ_W   = isMobile ? 0   : 36;   // вертикальная полоса проекта
  const METRIC_W = isMobile ? 110 : 130;  // колонка метрики

  useEffect(() => {
    if (!partners || partners.length === 0) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    Promise.all(
      partners.map(p =>
        fetch(`${apiBase}/api/history?partner=${encodeURIComponent(p)}&days=${days}`)
          .then(r => { if (!r.ok) throw new Error(`Ошибка для ${p}`); return r.json(); })
          .then(data => ({ partner: p, data }))
          .catch(err => ({ partner: p, data: [], error: err.message }))
      )
    ).then(results => {
      const nd = {};
      results.forEach(({ partner, data }) => { nd[partner] = data || []; });
      setAllData(nd);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [partners, days, apiBase]);

  if (loading) return <div className="state-msg">⏳ Загрузка истории...</div>;
  if (error)   return <div className="state-msg error">❌ {error}</div>;

  /* Группировка по дням */
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

  /* Все даты */
  const allDates = Array.from(
    new Set(Object.values(projectGrouped).flatMap(g => Object.keys(g)))
  ).sort();

  if (allDates.length === 0)
    return <div className="state-msg">Нет исторических данных</div>;

  const projectList  = Object.keys(projectGrouped).sort();
  const multiProject = projectList.length > 1;

  /* min/max по каждой строке */
  const rowRanges = {};
  projectList.forEach(partner => {
    rowRanges[partner] = {};
    const grouped = projectGrouped[partner];
    METRICS.forEach(m => {
      if (m.noBg) return;
      const vals = allDates
        .map(d => {
          const row = grouped[d];
          if (!row) return NaN;
          return parseFloat(String(row[m.key]).replace(',', '.'));
        })
        .filter(v => !isNaN(v));
      rowRanges[partner][m.key] = {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
      };
    });
  });

  /* ── Рендер одного проекта ── */
  const renderProject = (partner, projIdx) => {
    const grouped = projectGrouped[partner];
    const ranges  = rowRanges[partner];
    const rowCount = METRICS.length;

    return (
      <React.Fragment key={partner}>
        {METRICS.map((metric, mIdx) => {
          const isPlain = !!metric.noBg;
          const range   = ranges[metric.key] || { min: 0, max: 0 };

          return (
            <tr key={`${partner}-${metric.key}`}>

              {/* ── Вертикальная полоса «Проект» — только на десктопе, первая строка группы ── */}
              {!isMobile && mIdx === 0 && (
                <td
                  rowSpan={rowCount}
                  style={{
                    position:      'sticky',
                    left:          0,
                    zIndex:        12,
                    width:         PROJ_W,
                    minWidth:      PROJ_W,
                    maxWidth:      PROJ_W,
                    background:    'var(--surface2)',
                    borderRight:   '2px solid var(--border)',
                    padding:       0,
                    verticalAlign: 'middle',
                    textAlign:     'center',
                  }}
                >
                  {/* Текст повёрнут вертикально */}
                  <span style={{
                    display:       'block',
                    writingMode:   'vertical-rl',
                    transform:     'rotate(180deg)',
                    fontSize:      10,
                    fontWeight:    700,
                    color:         '#a5b4fc',
                    letterSpacing: '0.5px',
                    whiteSpace:    'nowrap',
                    padding:       '6px 0',
                    userSelect:    'none',
                  }}>
                    {partner}
                  </span>
                </td>
              )}

              {/* ── Колонка «Метрика» — sticky всегда ── */}
              <td
                style={{
                  position:    'sticky',
                  left:        isMobile ? 0 : PROJ_W,
                  zIndex:      11,
                  width:       METRIC_W,
                  minWidth:    METRIC_W,
                  background:  'var(--surface2)',
                  borderRight: '1px solid var(--border)',
                  textAlign:   'left',
                  paddingLeft: 10,
                  color:       'var(--text-muted)',
                  fontSize:    11,
                  fontWeight:  400,
                  whiteSpace:  'nowrap',
                }}
              >
                {/* На мобиле добавляем имя проекта перед первой метрикой */}
                {isMobile && mIdx === 0 && multiProject && (
                  <span style={{
                    display:     'block',
                    color:       '#a5b4fc',
                    fontWeight:  700,
                    fontSize:    10,
                    marginBottom: 1,
                    letterSpacing: '0.3px',
                  }}>
                    {partner}
                  </span>
                )}
                {metric.label}
              </td>

              {/* ── Данные ── */}
              {allDates.map((date, colIdx) => {
                const row = grouped[date];
                let display = '—';
                let style   = {};

                if (row) {
                  const raw = row[metric.key];
                  display   = metric.isPct ? fmtPct(raw) : fmt(raw);
                  if (!isPlain) {
                    const val = parseFloat(String(raw).replace(',', '.'));
                    const s   = cellStyle(val, range.min, range.max, metric.invert);
                    if (s) style = s;
                  }
                }

                return (
                  <td
                    key={date}
                    style={{
                      ...style,
                      minWidth:  60,
                      textAlign: 'right',
                      outline:   hoverCol === colIdx
                        ? '1px solid rgba(165,180,252,0.35)'
                        : undefined,
                    }}
                    onMouseEnter={() => setHoverCol(colIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                  >
                    {display}
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
              style={{ height: 6, background: 'var(--bg)', padding: 0 }}
            />
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div
      ref={wrapRef}
      className="hist-wrap"
      style={{ position: 'relative' }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            {/* Sticky: ячейка «Проект» в thead */}
            {!isMobile && (
              <th style={{
                position:    'sticky',
                top:         0,
                left:        0,
                zIndex:      120,
                width:       PROJ_W,
                minWidth:    PROJ_W,
                background:  'var(--surface2)',
                borderRight: '2px solid var(--border)',
                borderBottom:'1px solid var(--border)',
                color:       'var(--text-muted)',
                fontSize:    10,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                padding:     '9px 4px',
                textAlign:   'center',
              }}>
                ПР
              </th>
            )}

            {/* Sticky: ячейка «Метрика» в thead */}
            <th style={{
              position:    'sticky',
              top:         0,
              left:        isMobile ? 0 : PROJ_W,
              zIndex:      120,
              width:       METRIC_W,
              minWidth:    METRIC_W,
              background:  'var(--surface2)',
              borderRight: '1px solid var(--border)',
              borderBottom:'1px solid var(--border)',
              color:       'var(--text-muted)',
              fontSize:    10,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              padding:     '9px 10px',
              textAlign:   'left',
            }}>
              Метрика
            </th>

            {/* Даты — sticky только по вертикали */}
            {allDates.map((date, colIdx) => (
              <th
                key={date}
                style={{
                  position:    'sticky',
                  top:         0,
                  zIndex:      100,
                  minWidth:    60,
                  background:  'var(--surface2)',
                  borderBottom:'1px solid var(--border)',
                  color:       hoverCol === colIdx ? '#a5b4fc' : 'var(--text-muted)',
                  fontSize:    10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  padding:     '9px 10px',
                  textAlign:   'right',
                  cursor:      'default',
                  transition:  'color 0.15s',
                  outline:     hoverCol === colIdx
                    ? '1px solid rgba(165,180,252,0.35)'
                    : undefined,
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
