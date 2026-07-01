import React, { useState, useEffect } from 'react';

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
   Метрики
───────────────────────────────────────────────────────────── */
const METRICS = [
  { key: 'total_on_platform', label: 'Всего ПУ',      noBg: true               },
  { key: 'active_pu',         label: 'Активных'                                 },
  { key: 'active_pct',        label: '% активных',    isPct: true               },
  { key: 't0_now',            label: 'ТО сегодня'                               },
  { key: 't0_now_pct',        label: '% ТО сег.',     isPct: true               },
  { key: 't0_prev_day',       label: 'ТО вчера'                                 },
  { key: 't0_prev_day_pct',   label: '% ТО вч.',      isPct: true               },
  { key: 't0_three_days',     label: 'ТО 3 дня'                                 },
  { key: 't0_three_days_pct', label: '% ТО 3д.',      isPct: true               },
  { key: 'gap_pct',           label: 'Разрыв →ТО-3',  isPct: true, invert: true },
  { key: 'bs_total',          label: 'БС всего',       noBg: true               },
  { key: 'bs_online',         label: 'БС онлайн'                                },
  { key: 'bs_metric_pct',     label: '% БС',           isPct: true              },
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
   Константы sticky
───────────────────────────────────────────────────────────── */
const PROJ_W   = 34;   // ширина вертикальной полосы проекта
const METRIC_W = 128;  // ширина колонки «Метрика»
const HEADER_H = 33;   // высота thead (для sticky позиционирования)

/*
  КЛЮЧЕВОЕ РЕШЕНИЕ просветов:
  Вместо border используем box-shadow — он не участвует в box-model
  и не создаёт «зазоры» при прокрутке.

  Sticky-ячейка проекта:   box-shadow: 1px 0 0 var(--border) (правый край)
  Sticky-ячейка метрики:   box-shadow: 2px 0 4px rgba(0,0,0,0.3) (тень-разделитель)
  Фон sticky-ячеек должен точно совпадать с фоном строки — поэтому
  передаём его явно как пропс, а не через CSS-класс.
*/

/* ─────────────────────────────────────────────────────────────
   Компонент
───────────────────────────────────────────────────────────── */
function AllProjectsHistoryTable({ partners, days = 30 }) {
  const apiBase    = import.meta.env.VITE_API_URL || '';
  const [allData,   setAllData]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [hoverCol,  setHoverCol]  = useState(null);
  const winWidth   = useWindowWidth();
  const isMobile   = winWidth < 640;

  useEffect(() => {
    if (!partners || partners.length === 0) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    Promise.all(
      partners.map(p =>
        fetch(`${apiBase}/api/history?partner=${encodeURIComponent(p)}&days=${days}`)
          .then(r => { if (!r.ok) throw new Error(`Ошибка для ${p}`); return r.json(); })
          .then(data => ({ partner: p, data }))
          .catch(err => ({ partner: p, data: [] }))
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

  /* ── Смещение sticky-колонок ── */
  const projLeft   = 0;
  const metricLeft = isMobile ? 0 : PROJ_W;
  // Суммарная ширина frozen-зоны (для padding первой data-ячейки не нужен,
  // браузер сам считает)

  /* ── Общие стили для sticky th/td ── */
  const stickyBase = {
    position: 'sticky',
    zIndex:   10,
  };

  /* ── Рендер одного проекта ── */
  const renderProject = (partner, projIdx) => {
    const grouped   = projectGrouped[partner];
    const ranges    = rowRanges[partner];
    const rowCount  = METRICS.length;

    // Чередование фона строк внутри группы
    const rowBgEven = 'var(--surface)';
    const rowBgOdd  = 'rgba(255,255,255,0.018)';

    return (
      <React.Fragment key={partner}>
        {METRICS.map((metric, mIdx) => {
          const isPlain = !!metric.noBg;
          const range   = ranges[metric.key] || { min: 0, max: 0 };
          const rowBg   = mIdx % 2 === 0 ? rowBgEven : rowBgOdd;

          return (
            <tr key={`${partner}-${metric.key}`}>

              {/* ── Вертикальная полоса «Проект» (только десктоп, только 1-я строка) ── */}
              {!isMobile && mIdx === 0 && (
                <td
                  rowSpan={rowCount}
                  style={{
                    ...stickyBase,
                    left:          projLeft,
                    zIndex:        12,
                    width:         PROJ_W,
                    minWidth:      PROJ_W,
                    maxWidth:      PROJ_W,
                    padding:       0,
                    verticalAlign: 'middle',
                    textAlign:     'center',
                    /*
                      Фон: var(--surface2) — фиксированный, не чередуется.
                      box-shadow вместо border — нет просвета при прокрутке.
                    */
                    background:    'var(--surface2)',
                    boxShadow:     'inset -1px 0 0 var(--border)',
                  }}
                >
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

              {/* ── Ячейка «Метрика» — sticky всегда ── */}
              <td
                style={{
                  ...stickyBase,
                  left:        metricLeft,
                  zIndex:      11,
                  width:       METRIC_W,
                  minWidth:    METRIC_W,
                  maxWidth:    METRIC_W,
                  /*
                    Фон должен точно совпадать с фоном строки,
                    иначе под ним будут просвечивать данные.
                    Но т.к. метрика — всегда surface2, используем его.
                  */
                  background:  'var(--surface2)',
                  /*
                    box-shadow вправо — имитирует правый border без зазоров.
                    Дополнительная тень добавляет глубину при прокрутке.
                  */
                  boxShadow:   '2px 0 6px rgba(0,0,0,0.35), inset -1px 0 0 var(--border)',
                  textAlign:   'left',
                  paddingLeft: 10,
                  paddingRight: 8,
                  color:       isPlain ? 'var(--text)' : 'var(--text-muted)',
                  fontSize:    11,
                  fontWeight:  isPlain ? 600 : 400,
                  whiteSpace:  'nowrap',
                  fontStyle:   metric.isPct ? 'italic' : 'normal',
                }}
              >
                {/* На мобиле: имя проекта над первой метрикой */}
                {isMobile && mIdx === 0 && multiProject && (
                  <span style={{
                    display:       'block',
                    color:         '#a5b4fc',
                    fontWeight:    700,
                    fontStyle:     'normal',
                    fontSize:      10,
                    marginBottom:  2,
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
                let display   = '—';
                let cellSt    = {};
                let isColored = false;

                if (row) {
                  const raw = row[metric.key];
                  display   = metric.isPct ? fmtPct(raw) : fmt(raw);

                  if (!isPlain) {
                    const val = parseFloat(String(raw).replace(',', '.'));
                    const s   = getCellStyle(val, range.min, range.max, metric.invert);
                    if (s) { cellSt = s; isColored = true; }
                  }
                }

                const isHovered = hoverCol === colIdx;

                return (
                  <td
                    key={date}
                    style={{
                      ...cellSt,
                      padding:    '5px 8px',
                      minWidth:   62,
                      textAlign:  'right',
                      fontSize:   metric.isPct ? 11 : 12,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      /*
                        Hover по колонке: outline вместо border —
                        не сдвигает соседние ячейки
                      */
                      outline: isHovered
                        ? '1px solid rgba(165,180,252,0.4)'
                        : undefined,
                      outlineOffset: '-1px',
                      /*
                        Для некрашеных строк — лёгкий фон строки
                      */
                      background: isColored ? cellSt.backgroundColor : (
                        isHovered
                          ? 'rgba(165,180,252,0.06)'
                          : !isPlain ? rowBg : 'transparent'
                      ),
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

        {/* ── Разделитель между проектами ── */}
        {multiProject && projIdx < projectList.length - 1 && (
          <tr>
            <td
              colSpan={allDates.length + (isMobile ? 1 : 2)}
              style={{
                height:     8,
                padding:    0,
                background: 'var(--bg)',
                borderTop:  '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}
            />
          </tr>
        )}
      </React.Fragment>
    );
  };

  /* ── Стили для заголовков thead ── */
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
    /*
      Нижний border thead — через box-shadow, иначе при sticky-scroll
      граница «улетает» вместе с контентом
    */
    boxShadow:     'inset 0 -1px 0 var(--border)',
  };

  return (
    /*
      СТРУКТУРА:
      .hist-wrap — внешний контейнер с border/radius/shadow
        → overflow-x: auto  (горизонтальный скролл)
        → overflow-y: visible (иначе sticky thead не работает)

      Внутри — обычная таблица, sticky работает относительно
      ближайшего scroll-контейнера (hist-wrap).

      ВАЖНО: чтобы sticky thead работал в overflow-x:auto,
      нужно чтобы контейнер имел явную высоту или
      был достаточно высоким. Здесь таблица сама задаёт высоту.
    */
    <div
      className="hist-wrap"
      style={{
        overflowX:    'auto',
        overflowY:    'auto',    // auto по Y тоже нужен для sticky thead в Chrome
        maxHeight:    '70vh',    // ограничиваем высоту → появляется вертикальный скролл → sticky thead работает
        borderRadius: 'var(--radius)',
        border:       '1px solid var(--border)',
        boxShadow:    'var(--shadow)',
        position:     'relative',
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
            {/* Угловая ячейка: sticky по X и Y */}
            {!isMobile && (
              <th style={{
                ...thBase,
                ...stickyBase,
                left:       projLeft,
                zIndex:     130,  // выше всех
                width:      PROJ_W,
                minWidth:   PROJ_W,
                maxWidth:   PROJ_W,
                padding:    '8px 4px',
                textAlign:  'center',
                // box-shadow: и снизу (граница thead) и справа (граница колонки)
                boxShadow:  'inset 0 -1px 0 var(--border), inset -1px 0 0 var(--border)',
              }}>
                {''}
              </th>
            )}

            {/* Угловая ячейка «Метрика»: sticky по X и Y */}
            <th style={{
              ...thBase,
              ...stickyBase,
              left:      metricLeft,
              zIndex:    130,
              width:     METRIC_W,
              minWidth:  METRIC_W,
              textAlign: 'left',
              // тень справа для разделения + снизу
              boxShadow: '2px 0 6px rgba(0,0,0,0.35), inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border)',
            }}>
              Метрика
            </th>

            {/* Заголовки дат: sticky только по Y */}
            {allDates.map((date, colIdx) => (
              <th
                key={date}
                style={{
                  ...thBase,
                  position:   'sticky',
                  top:        0,
                  zIndex:     100,
                  minWidth:   62,
                  textAlign:  'right',
                  cursor:     'default',
                  color:      hoverCol === colIdx ? '#a5b4fc' : 'var(--text-muted)',
                  transition: 'color 0.15s',
                  outline:    hoverCol === colIdx
                    ? '1px solid rgba(165,180,252,0.4)'
                    : undefined,
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
