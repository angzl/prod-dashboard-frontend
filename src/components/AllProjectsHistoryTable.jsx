import React, { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../context/DataContext';

/* ─────────────────────────────────────────────────────────────
   Цветовые стопы (тёмная тема)
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

const COL_TYPE_BG = {
  year:  '#1a2040',
  month: '#1e2438',
  day:   'var(--surface2)',
};

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

const METRICS = [
  { key: 'total_on_platform', label: 'Всего ПУ', noBg: true },
  {
    key:   'active_pu',
    label: 'Активных',
    pctFn: (row) => {
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
  { key: 'gap_pct', label: 'Разрыв →ТО-3', isPct: true, invert: true },
  { key: 'bs_total',  label: 'БС всего',  noBg: true },
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

const PROJ_W   = 34;
const METRIC_W = 120;

/** Последний срез за каждый день (режим detail) */
function buildDailyGrouped(allData) {
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
  return projectGrouped;
}

/** Группы колонок для заголовка timeline */
function buildColumnGroups(columns) {
  const groups = [];
  columns.forEach((col, idx) => {
    const label = col.type === 'year' ? 'Годы'
      : col.type === 'month' ? 'Месяцы'
      : 'Дни';
    const last = groups[groups.length - 1];
    if (last && last.type === col.type) {
      last.span += 1;
    } else {
      groups.push({ type: col.type, label, span: 1, startIdx: idx });
    }
  });
  return groups;
}

function AllProjectsHistoryTable({ partners, days = 30, mode = 'daily' }) {
  const { getHistory, timeline, status } = useDataStore();
  const [hoverCol, setHoverCol] = useState(null);

  const winWidth   = useWindowWidth();
  const isMobile   = winWidth < 640;
  const metricLeft = isMobile ? 0 : PROJ_W;

  const isTimeline = mode === 'timeline';

  const { columns, projectGrouped, projectList, rangesFromServer } = useMemo(() => {
    const list = (partners || []).slice().sort();

    if (isTimeline) {
      const cols = (timeline?.columns || []).filter(Boolean);
      const grouped = {};
      list.forEach(partner => {
        grouped[partner] = timeline?.data?.[partner] || {};
      });
      // Глобальные диапазоны по всем сырым срезам — отдаёт бэкенд.
      // Фронт использует их для цветовой заливки, чтобы масштаб учитывал
      // все значения, из которых сформирован агрегат, а не только вывод.
      const ranges = timeline?.ranges || {};
      return { columns: cols, projectGrouped: grouped, projectList: list, rangesFromServer: ranges };
    }

    const allData = Object.fromEntries(
      list.map(p => [p, getHistory(p, days) ?? []])
    );
    const grouped = buildDailyGrouped(allData);
    const dates = Array.from(
      new Set(Object.values(grouped).flatMap(g => Object.keys(g)))
    ).sort();
    const cols = dates.map(d => ({ type: 'day', key: d, label: d.slice(5) }));
    return { columns: cols, projectGrouped: grouped, projectList: list, rangesFromServer: null };
  }, [isTimeline, timeline, partners, days, getHistory]);

  const hasAnyData = isTimeline
    ? columns.length > 0 && projectList.some(p => {
        const rows = projectGrouped[p];
        return rows && Object.values(rows).some(v => v != null);
      })
    : Object.values(projectGrouped).some(g => Object.keys(g).length > 0);

  if (!hasAnyData) {
    if (status === 'loading')
      return <div className="state-msg">⏳ Загрузка истории...</div>;
    return <div className="state-msg">Нет исторических данных в кеше</div>;
  }

  const columnGroups = isTimeline ? buildColumnGroups(columns) : [];
  const multiProject = projectList.length > 1;

  // Метрики, которые физически ограничены диапазоном [0, 100]
  const CLAMP_0_100 = { gap_pct: true };

  const clampVal = (key, v) =>
    CLAMP_0_100[key] ? Math.max(0, Math.min(100, v)) : v;

  const rowRanges = {};
  projectList.forEach(partner => {
    rowRanges[partner] = {};
    const grouped = projectGrouped[partner];
    METRICS.forEach(m => {
      if (m.noBg) return;

      // В режиме timeline предпочтаем глобальные диапазоны, посчитанные
      // бэкендом по всем сырым срезам (включая те, что не попали в вывод).
      const srv = rangesFromServer?.[partner]?.[m.key];
      if (isTimeline && srv && typeof srv.min === 'number' && typeof srv.max === 'number') {
        rowRanges[partner][m.key] = { min: srv.min, max: srv.max };
        return;
      }

      const vals = columns
        .map(col => {
          const row = grouped[col.key];
          if (!row) return NaN;
          return clampVal(m.key, parseNum(row[m.key]));
        })
        .filter(v => !isNaN(v));
      rowRanges[partner][m.key] = {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
      };
    });
  });

  const stickyProj = {
    position: 'sticky', left: 0, zIndex: 12,
    width: PROJ_W, minWidth: PROJ_W, maxWidth: PROJ_W,
    background: 'var(--surface2)',
    boxShadow: 'inset -1px 0 0 var(--border)',
    padding: 0, verticalAlign: 'middle', textAlign: 'center',
  };

  const stickyMetric = {
    position: 'sticky', left: metricLeft, zIndex: 11,
    width: METRIC_W, minWidth: METRIC_W, maxWidth: METRIC_W,
    background: 'var(--surface2)',
    boxShadow: '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border)',
    textAlign: 'left', paddingLeft: 10, paddingRight: 6,
    color: 'var(--text-muted)', fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap',
  };

  const thBase = {
    position: 'sticky', top: 0,
    background: 'var(--surface2)',
    color: 'var(--text-muted)',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px',
    padding: '8px 8px', fontWeight: 600, whiteSpace: 'nowrap',
    boxShadow: 'inset 0 -1px 0 var(--border)',
  };

  const groupRowTop = isTimeline ? 28 : 0;

  const renderProject = (partner, projIdx) => {
    const grouped  = projectGrouped[partner];
    const ranges   = rowRanges[partner];
    const rowCount = METRICS.length;

    return (
      <React.Fragment key={partner}>
        {METRICS.map((metric, mIdx) => {
          const isPlain   = !!metric.noBg;
          const isPctOnly = !!metric.isPct;
          const range     = ranges[metric.key] || { min: 0, max: 0 };
          const rowBg     = mIdx % 2 === 0 ? 'var(--surface)' : 'rgba(255,255,255,0.02)';

          return (
            <tr key={`${partner}-${metric.key}`} style={{ background: rowBg }}>
              {!isMobile && mIdx === 0 && (
                <td rowSpan={rowCount} style={stickyProj}>
                  <span style={{
                    display: 'block', writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)', fontSize: 10, fontWeight: 700,
                    color: '#a5b4fc', letterSpacing: '0.5px',
                    whiteSpace: 'nowrap', padding: '8px 0', userSelect: 'none',
                  }}>
                    {partner}
                  </span>
                </td>
              )}

              <td style={stickyMetric}>
                {isMobile && mIdx === 0 && multiProject && (
                  <span style={{
                    display: 'block', color: '#a5b4fc', fontWeight: 700,
                    fontStyle: 'normal', fontSize: 10, marginBottom: 2,
                  }}>
                    {partner}
                  </span>
                )}
                {metric.label}
              </td>

              {columns.map((col, colIdx) => {
                const row = grouped[col.key];
                const isHovered = hoverCol === colIdx;
                const isGroupStart = isTimeline && (
                  colIdx === 0 || columns[colIdx - 1].type !== col.type
                );

                if (!row) {
                  return (
                    <td key={col.key} style={{
                      padding: '5px 8px', minWidth: 70, textAlign: 'right',
                      color: 'var(--text-muted)', fontSize: 11,
                      background: isTimeline ? COL_TYPE_BG[col.type] : undefined,
                      borderLeft: isGroupStart ? '2px solid rgba(99,102,241,0.35)' : undefined,
                      outline: isHovered ? '1px solid rgba(165,180,252,0.4)' : undefined,
                      outlineOffset: '-1px',
                    }}
                      onMouseEnter={() => setHoverCol(colIdx)}
                      onMouseLeave={() => setHoverCol(null)}
                    >—</td>
                  );
                }

                const colorVal = parseNum(row[metric.key]);
                const gradStyle = (!isPlain && !isNaN(colorVal))
                  ? getCellStyle(colorVal, range.min, range.max, metric.invert)
                  : null;

                const rawForDisplay = isPctOnly
                  ? clampVal(metric.key, parseNum(row[metric.key]))
                  : row[metric.key];
                const numDisplay = isPctOnly
                  ? (isNaN(rawForDisplay) ? '—' : rawForDisplay.toFixed(1) + '%')
                  : fmt(row[metric.key]);
                const pctVal     = metric.pctFn ? metric.pctFn(row) : null;
                const pctDisplay = (pctVal !== null && !isNaN(pctVal))
                  ? pctVal.toFixed(1) + '%' : null;

                const textColor = gradStyle
                  ? gradStyle.color
                  : isPlain ? 'var(--text-muted)' : 'var(--text)';

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
                    key={col.key}
                    title={isTimeline && col.type !== 'day' ? `Макс. за ${col.label}` : undefined}
                    style={{
                      padding: '4px 8px', minWidth: 70, textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle',
                      backgroundColor: gradStyle
                        ? gradStyle.backgroundColor
                        : (isTimeline ? COL_TYPE_BG[col.type] : undefined),
                      borderLeft: isGroupStart ? '2px solid rgba(99,102,241,0.35)' : undefined,
                      outline: isHovered ? '1px solid rgba(165,180,252,0.4)' : undefined,
                      outlineOffset: '-1px',
                    }}
                    onMouseEnter={() => setHoverCol(colIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                  >
                    <div style={{
                      fontSize: isPlain ? 11 : 12,
                      fontWeight: isPlain ? 400 : 700,
                      color: textColor,
                      lineHeight: pctDisplay ? 1.2 : 1.4,
                    }}>
                      {numDisplay}
                    </div>
                    {pctDisplay && (
                      <div style={{
                        fontSize: 10, fontWeight: 500, color: pctColor,
                        lineHeight: 1.2, marginTop: 1,
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

        {multiProject && projIdx < projectList.length - 1 && (
          <tr>
            <td
              colSpan={columns.length + (isMobile ? 1 : 2)}
              style={{
                height: 6, padding: 0, background: 'var(--bg)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}
            />
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div
      className="hist-wrap"
      style={{
        overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh',
        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)', position: 'relative', background: 'var(--surface)',
      }}
    >
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', tableLayout: 'auto' }}>
        <thead>
          {isTimeline && columnGroups.length > 0 && (
            <tr>
              {!isMobile && (
                <th style={{
                  ...thBase, top: 0, left: 0, zIndex: 140,
                  width: PROJ_W, minWidth: PROJ_W, maxWidth: PROJ_W,
                  boxShadow: 'inset 0 -1px 0 var(--border), inset -1px 0 0 var(--border)',
                }} />
              )}
              <th style={{
                ...thBase, top: 0, left: metricLeft, zIndex: 140,
                width: METRIC_W, minWidth: METRIC_W,
                boxShadow: '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border)',
              }} />
              {columnGroups.map(g => (
                <th
                  key={`${g.type}-${g.startIdx}`}
                  colSpan={g.span}
                  style={{
                    ...thBase, zIndex: 110, top: 0, textAlign: 'center',
                    color: '#a5b4fc', fontSize: 9,
                    background: COL_TYPE_BG[g.type],
                    borderLeft: '2px solid rgba(99,102,241,0.35)',
                  }}
                >
                  {g.label}
                </th>
              ))}
            </tr>
          )}

          <tr>
            {!isMobile && (
              <th style={{
                ...thBase,
                position: 'sticky', top: groupRowTop, left: 0, zIndex: 130,
                width: PROJ_W, minWidth: PROJ_W, maxWidth: PROJ_W,
                padding: '8px 2px', textAlign: 'center',
                boxShadow: 'inset 0 -1px 0 var(--border), inset -1px 0 0 var(--border)',
              }} />
            )}

            <th style={{
              ...thBase,
              position: 'sticky', top: groupRowTop, left: metricLeft, zIndex: 130,
              width: METRIC_W, minWidth: METRIC_W, textAlign: 'left',
              boxShadow: '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border)',
            }}>
              Метрика
            </th>

            {columns.map((col, colIdx) => {
              const isGroupStart = isTimeline && (
                colIdx === 0 || columns[colIdx - 1].type !== col.type
              );
              return (
                <th
                  key={col.key}
                  style={{
                    ...thBase,
                    position: 'sticky', top: groupRowTop, zIndex: 100,
                    minWidth: 70, textAlign: 'right', cursor: 'default',
                    background: isTimeline ? COL_TYPE_BG[col.type] : thBase.background,
                    borderLeft: isGroupStart ? '2px solid rgba(99,102,241,0.35)' : undefined,
                    color: hoverCol === colIdx ? '#a5b4fc' : 'var(--text-muted)',
                    transition: 'color 0.15s',
                    outline: hoverCol === colIdx ? '1px solid rgba(165,180,252,0.4)' : undefined,
                    outlineOffset: '-1px',
                  }}
                  onMouseEnter={() => setHoverCol(colIdx)}
                  onMouseLeave={() => setHoverCol(null)}
                >
                  {col.label}
                </th>
              );
            })}
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
