import React, { useState, useMemo, useEffect } from 'react';
import { useDataStore } from '../context/DataContext';
import {
  COL_TYPE_BG,
  getCellStyle,
  buildColumnGroups,
  fmt,
  parseNum,
} from '../utils/heatmap';

/* AllProjectsTotalTable — агрегированная тепловая таблица «Весь прод».
   Значения в каждой колонке периода — СУММА по всем проектам.
   Источник — state.timeline (SSE), агрегация на фронте.
   gap_pct = 100 − (Σ ТО-3д / Σ активных) × 100. */

const CLAMP_0_100 = { gap_pct: true };
const clampVal = (key, v) =>
  CLAMP_0_100[key] ? Math.max(0, Math.min(100, v)) : v;

const METRIC_W = 120;

const METRICS = [
  { key: 'total_on_platform', label: 'Всего ПУ', noBg: true },
  {
    key: 'active_pu',
    label: 'Активных',
    pctFn: (row) => {
      const total = parseFloat(row['total_on_platform']);
      const val = parseFloat(row['active_pu']);
      return total > 0 && !isNaN(val) ? (val / total) * 100 : NaN;
    },
  },
  {
    key: 't0_three_days',
    label: 'ТО 3 дня',
    pctFn: (row) => {
      const total = parseFloat(row['total_on_platform']);
      const val = parseFloat(row['t0_three_days']);
      return total > 0 && !isNaN(val) ? (val / total) * 100 : NaN;
    },
  },
  { key: 'bs_total', label: 'БС всего', noBg: true },
  {
    key: 'bs_online',
    label: 'БС онлайн',
    pctFn: (row) => {
      const total = parseFloat(row['bs_total']);
      const val = parseFloat(row['bs_online']);
      return total > 0 && !isNaN(val) ? (val / total) * 100 : NaN;
    },
  },
];

const SUM_KEYS = [
  'total_on_platform',
  'active_pu',
  't0_now',
  't0_prev_day',
  't0_three_days',
  'bs_total',
  'bs_online',
];

function aggregateColumn(partnersData, colKey) {
  const sums = {};
  SUM_KEYS.forEach((k) => (sums[k] = 0));

  let hasAny = false;
  Object.values(partnersData || {}).forEach((partnerCols) => {
    const row = partnerCols && partnerCols[colKey];
    if (!row) return;
    hasAny = true;
    SUM_KEYS.forEach((k) => {
      const v = parseNum(row[k]);
      if (!isNaN(v)) sums[k] += v;
    });
  });

  if (!hasAny) return null;

  SUM_KEYS.forEach((k) => { sums[k] = Math.round(sums[k]); });

  const active = sums.active_pu;
  const t03 = sums.t0_three_days;
  sums.gap_pct =
    active > 0 ? Math.max(0, Math.min(100, 100 - (t03 / active) * 100)) : 0;

  return sums;
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

function AllProjectsTotalTable() {
  const { timeline, status } = useDataStore();
  const [hoverCol, setHoverCol] = useState(null);

  useWindowWidth();
  const metricLeft = 0;

  const columns = (timeline && timeline.columns) || [];

  const { aggregated, ranges } = useMemo(() => {
    if (!columns.length) return { aggregated: {}, ranges: {} };

    const data = (timeline && timeline.data) || {};
    const agg = {};
    columns.forEach((col) => {
      agg[col.key] = aggregateColumn(data, col.key);
    });

    const rng = {};
    METRICS.forEach((m) => {
      if (m.noBg) return;
      const vals = columns
        .map((col) => {
          const row = agg[col.key];
          if (!row) return NaN;
          return clampVal(m.key, parseNum(row[m.key]));
        })
        .filter((v) => !isNaN(v));
      rng[m.key] = {
        min: vals.length ? Math.min.apply(null, vals) : 0,
        max: vals.length ? Math.max.apply(null, vals) : 0,
      };
    });

    return { aggregated: agg, ranges: rng };
  }, [timeline, columns]);

  const hasAnyData =
    columns.length > 0 && Object.values(aggregated).some((v) => v != null);

  if (!hasAnyData) {
    if (status === 'loading')
      return <div className="state-msg">⏳ Загрузка истории...</div>;
    return <div className="state-msg">Нет исторических данных</div>;
  }

  const columnGroups = buildColumnGroups(columns);
  const groupRowTop = 28;

  const stickyMetric = {
    position: 'sticky',
    left: metricLeft,
    zIndex: 11,
    width: METRIC_W,
    minWidth: METRIC_W,
    maxWidth: METRIC_W,
    background: 'var(--surface2)',
    boxShadow: '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border)',
    textAlign: 'left',
    paddingLeft: 10,
    paddingRight: 6,
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 400,
    whiteSpace: 'nowrap',
  };

  const thBase = {
    position: 'sticky',
    top: 0,
    background: 'var(--surface2)',
    color: 'var(--text-muted)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '8px 8px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    boxShadow: 'inset 0 -1px 0 var(--border)',
  };

  return (
    <div
      className="hist-wrap"
      style={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: '70vh',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        position: 'relative',
        background: 'var(--surface)',
      }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: 12,
          width: 'auto',
          tableLayout: 'auto',
        }}
      >
        <thead>
          {columnGroups.length > 0 && (
            <tr>
              <th
                style={{
                  ...thBase,
                  top: 0,
                  left: 0,
                  zIndex: 140,
                  width: METRIC_W,
                  minWidth: METRIC_W,
                  boxShadow:
                    'inset 0 -1px 0 var(--border), inset -1px 0 0 var(--border)',
                }}
              />
              {columnGroups.map((g) => (
                <th
                  key={g.type + '-' + g.startIdx}
                  colSpan={g.span}
                  style={{
                    ...thBase,
                    zIndex: 110,
                    top: 0,
                    textAlign: 'center',
                    color: '#a5b4fc',
                    fontSize: 9,
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
            <th
              style={{
                ...thBase,
                position: 'sticky',
                top: groupRowTop,
                left: 0,
                zIndex: 130,
                width: METRIC_W,
                minWidth: METRIC_W,
                textAlign: 'left',
                boxShadow:
                  '3px 0 8px rgba(0,0,0,0.4), inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border)',
              }}
            >
              Метрика
            </th>
            {columns.map((col, colIdx) => {
              const isGroupStart =
                colIdx === 0 || columns[colIdx - 1].type !== col.type;
              return (
                <th
                  key={col.key}
                  style={{
                    ...thBase,
                    position: 'sticky',
                    top: groupRowTop,
                    zIndex: 100,
                    minWidth: 70,
                    textAlign: 'right',
                    cursor: 'default',
                    background: COL_TYPE_BG[col.type],
                    borderLeft: isGroupStart
                      ? '2px solid rgba(99,102,241,0.35)'
                      : undefined,
                    color: hoverCol === colIdx ? '#a5b4fc' : 'var(--text-muted)',
                    transition: 'color 0.15s',
                    outline:
                      hoverCol === colIdx
                        ? '1px solid rgba(165,180,252,0.4)'
                        : undefined,
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
          {METRICS.map((metric, mIdx) => {
            const isPlain = !!metric.noBg;
            const range = ranges[metric.key] || { min: 0, max: 0 };
            const rowBg =
              mIdx % 2 === 0 ? 'var(--surface)' : 'rgba(255,255,255,0.02)';

            return (
              <tr key={metric.key} style={{ background: rowBg }}>
                <td style={stickyMetric}>{metric.label}</td>

                {columns.map((col, colIdx) => {
                  const row = aggregated[col.key];
                  const isHovered = hoverCol === colIdx;
                  const isGroupStart =
                    colIdx === 0 || columns[colIdx - 1].type !== col.type;

                  if (!row) {
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '5px 8px',
                          minWidth: 70,
                          textAlign: 'right',
                          color: 'var(--text-muted)',
                          fontSize: 11,
                          background: COL_TYPE_BG[col.type],
                          borderLeft: isGroupStart
                            ? '2px solid rgba(99,102,241,0.35)'
                            : undefined,
                          outline: isHovered
                            ? '1px solid rgba(165,180,252,0.4)'
                            : undefined,
                          outlineOffset: '-1px',
                        }}
                        onMouseEnter={() => setHoverCol(colIdx)}
                        onMouseLeave={() => setHoverCol(null)}
                      >
                        —
                      </td>
                    );
                  }

                  const colorVal = parseNum(row[metric.key]);
                  const gradStyle =
                    !isPlain && !isNaN(colorVal)
                      ? getCellStyle(
                          colorVal,
                          range.min,
                          range.max,
                          metric.invert
                        )
                      : null;

                  const pctVal = metric.pctFn ? metric.pctFn(row) : null;
                  const pctDisplay =
                    pctVal !== null && !isNaN(pctVal)
                      ? pctVal.toFixed(1) + '%'
                      : null;

                  const textColor = gradStyle
                    ? gradStyle.color
                    : isPlain
                    ? 'var(--text-muted)'
                    : 'var(--text)';

                  var pctColor = 'var(--text-muted)';
                  if (gradStyle) {
                    var parts = gradStyle.color.match(/\d+/g);
                    pctColor = parts
                      ? 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ',0.72)'
                      : 'var(--text-muted)';
                  }

                  return (
                    <td
                      key={col.key}
                      title={col.type !== 'day' ? 'Сумма за ' + col.label : undefined}
                      style={{
                        padding: '4px 8px',
                        minWidth: 70,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        verticalAlign: 'middle',
                        backgroundColor: gradStyle
                          ? gradStyle.backgroundColor
                          : COL_TYPE_BG[col.type],
                        borderLeft: isGroupStart
                          ? '2px solid rgba(99,102,241,0.35)'
                          : undefined,
                        outline: isHovered
                          ? '1px solid rgba(165,180,252,0.4)'
                          : undefined,
                        outlineOffset: '-1px',
                      }}
                      onMouseEnter={() => setHoverCol(colIdx)}
                      onMouseLeave={() => setHoverCol(null)}
                    >
                      <div
                        style={{
                          fontSize: isPlain ? 11 : 12,
                          fontWeight: isPlain ? 400 : 700,
                          color: textColor,
                          lineHeight: pctDisplay ? 1.2 : 1.4,
                        }}
                      >
                        {fmt(row[metric.key])}
                      </div>
                      {pctDisplay && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: pctColor,
                            lineHeight: 1.2,
                            marginTop: 1,
                          }}
                        >
                          {pctDisplay}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default AllProjectsTotalTable;