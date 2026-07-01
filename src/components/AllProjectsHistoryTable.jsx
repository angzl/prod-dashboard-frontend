import React, { useState, useEffect, useCallback } from 'react';

// ── Цветовые стопы для тёмной темы (фон / текст) ──────────────────────────
// t=0 → красный (хуже среднего), t=0.5 → жёлтый (среднее), t=1 → зелёный (лучше)
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
      const local = (t - t0) / (t1 - t0);
      return [
        Math.round(lerp(c0[0], c1[0], local)),
        Math.round(lerp(c0[1], c1[1], local)),
        Math.round(lerp(c0[2], c1[2], local)),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

// Вычисляем стиль ячейки: t по min/max строки, опционально инвертируем
function cellStyle(value, rowMin, rowMax, invert = false) {
  const range = rowMax - rowMin;
  if (range === 0 || isNaN(value)) return null; // нет разброса — без цвета
  let t = (value - rowMin) / range;
  if (invert) t = 1 - t;
  const [br, bg, bb] = interpStops(BG_STOPS,   t);
  const [tr, tg, tb] = interpStops(TEXT_STOPS, t);
  return {
    backgroundColor: `rgb(${br},${bg},${bb})`,
    color:           `rgb(${tr},${tg},${tb})`,
  };
}

// Метрики: key, label, флаги noBg (не красить), invert (меньше=лучше)
const METRICS = [
  { key: 'total_on_platform',  label: 'Всего ПУ',         noBg: true  },
  { key: 'active_pu',          label: 'Активных'                       },
  { key: 'active_pct',         label: '% активных',       isPct: true  },
  { key: 't0_now',             label: 'Сбор Т0 сегодня'               },
  { key: 't0_now_pct',         label: '%',                isPct: true  },
  { key: 't0_prev_day',        label: 'Сбор Т0 вчера'                 },
  { key: 't0_prev_day_pct',    label: '%',                isPct: true  },
  { key: 't0_three_days',      label: 'Сбор Т0 3 дня'                 },
  { key: 't0_three_days_pct',  label: '%',                isPct: true  },
  { key: 'gap_pct',            label: 'Разрыв акт→Т0-3', isPct: true, invert: true },
  { key: 'bs_total',           label: 'БС всего',         noBg: true  },
  { key: 'bs_online',          label: 'БС онлайн'                      },
  { key: 'bs_metric_pct',      label: '% БС',             isPct: true  },
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

function AllProjectsHistoryTable({ partners, days = 30 }) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [allData, setAllData]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  useEffect(() => {
    if (!partners || partners.length === 0) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    Promise.all(
      partners.map(partner =>
        fetch(`${apiBase}/api/history?partner=${encodeURIComponent(partner)}&days=${days}`)
          .then(r => { if (!r.ok) throw new Error(`Ошибка для ${partner}`); return r.json(); })
          .then(data => ({ partner, data }))
          .catch(err => ({ partner, error: err.message, data: [] }))
      )
    ).then(results => {
      const newData = {};
      results.forEach(({ partner, data }) => { newData[partner] = data || []; });
      setAllData(newData);
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [partners, days, apiBase]);

  if (loading) return <div className="state-msg">⏳ Загрузка истории...</div>;
  if (error)   return <div className="state-msg error">❌ Ошибка: {error}</div>;

  // Группировка: последний срез за каждый день
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

  // Общий список дат
  const allDates = Array.from(
    new Set(Object.values(projectGrouped).flatMap(g => Object.keys(g)))
  ).sort();

  if (allDates.length === 0)
    return <div className="state-msg">Нет исторических данных</div>;

  const projectList = Object.keys(projectGrouped).sort();
  const multiProject = projectList.length > 1;

  // Для каждого проекта и метрики: min/max по строке (по всем датам)
  const rowRanges = {};
  projectList.forEach(partner => {
    rowRanges[partner] = {};
    const grouped = projectGrouped[partner];
    METRICS.forEach(m => {
      if (m.noBg) return;
      const vals = allDates
        .map(date => {
          const row = grouped[date];
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

  const renderProject = (partner, isFirst) => {
    const grouped  = projectGrouped[partner];
    const ranges   = rowRanges[partner];

    return (
      <React.Fragment key={partner}>
        {/* Разделитель с именем проекта (только если несколько проектов) */}
        {multiProject && (
          <tr className="project-divider">
            <td colSpan={allDates.length + 2}>{partner}</td>
          </tr>
        )}

        {METRICS.map((metric, mIdx) => {
          const isPlain = !!metric.noBg;
          const range   = ranges[metric.key] || { min: 0, max: 0 };

          return (
            <tr key={`${partner}-${metric.key}`} className={isPlain ? 'row-plain' : ''}>
              {/* Колонка «Проект» только на первой строке метрики первого проекта */}
              {!multiProject && mIdx === 0 && (
                <td
                  className="col-project"
                  rowSpan={METRICS.length}
                  style={{ verticalAlign: 'middle' }}
                >
                  {partner}
                </td>
              )}
              {/* Если multi — col-project не нужен (уже в divider) */}
              {multiProject && mIdx === 0 && (
                /* пустая колонка для выравнивания */
                <td
                  className="col-project"
                  rowSpan={METRICS.length}
                  style={{ background: 'transparent', borderRight: 'none' }}
                />
              )}

              <td className="col-metric">{metric.label}</td>

              {allDates.map((date, colIdx) => {
                const row = grouped[date];
                let display = '—';
                let style   = {};

                if (row) {
                  const raw = row[metric.key];
                  display   = (metric.isPct) ? fmtPct(raw) : fmt(raw);

                  if (!isPlain) {
                    const val = parseFloat(String(raw).replace(',', '.'));
                    const s   = cellStyle(val, range.min, range.max, metric.invert);
                    if (s) style = s;
                  }
                }

                const isHovered = hoverCol === colIdx;

                return (
                  <td
                    key={date}
                    style={{
                      ...style,
                      outline: isHovered ? '1px solid rgba(165,180,252,0.4)' : undefined,
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
      </React.Fragment>
    );
  };

  return (
    <div className="hist-wrap">
      <table>
        <thead>
          <tr>
            <th className="col-project">Проект</th>
            <th className="col-metric">Метрика</th>
            {allDates.map((date, colIdx) => (
              <th
                key={date}
                style={{
                  minWidth: 68,
                  cursor: 'default',
                  outline: hoverCol === colIdx ? '1px solid rgba(165,180,252,0.4)' : undefined,
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
          {projectList.map((partner, idx) => renderProject(partner, idx === 0))}
        </tbody>
      </table>
    </div>
  );
}

export default AllProjectsHistoryTable;
