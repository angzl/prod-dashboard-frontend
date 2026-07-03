import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useDataStore } from '../context/DataContext';

// Палитра для разных проектов
const PALETTE = [
  '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#22c55e', '#f97316', '#3b82f6', '#84cc16',
];

const PLOTLY_BASE = {
  xaxis: {
    tickangle:  -45,
    tickfont:   { size: 10, color: '#8892a4' },
    gridcolor:  'rgba(46,50,72,0.7)',
    gridwidth:  0.5,
    zeroline:   false,
    type:       'category',
    color:      '#8892a4',
  },
  yaxis: {
    title:     { text: 'Количество', font: { size: 12, color: '#8892a4' } },
    tickfont:  { size: 10, color: '#8892a4' },
    gridcolor: 'rgba(46,50,72,0.7)',
    gridwidth: 0.5,
    zeroline:  false,
    color:     '#8892a4',
  },
  hovermode:    'x unified',
  hoverlabel: {
    font:        { size: 13, color: '#e2e8f0', family: "'Segoe UI',system-ui,sans-serif" },
    bgcolor:     '#1a1d27',
    bordercolor: '#2e3248',
    namelength:  -1,
  },
  legend: {
    orientation: 'h',
    y:           -0.25,
    font:        { size: 11, color: '#8892a4' },
  },
  title: {
    text: 'Сравнение активных ПУ по проектам',
    font: { size: 14, color: '#8892a4' },
  },
  margin:        { l: 60, r: 20, t: 50, b: 100 },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font:          { color: '#8892a4', family: "'Segoe UI',system-ui,sans-serif" },
  showlegend:    true,
};

/**
 * Локальная версия серверного _build_graph: берём сырую историю
 * из SSE-стора, группируем по дню (последний срез дня) и формируем
 * массивы для графика. Так MultiGraph работает в рамках единой
 * push-модели и не делает отдельный HTTP-запрос.
 */
function buildGraphData(rawHistory) {
  if (!rawHistory || rawHistory.length === 0) {
    return { dates: [], active_pu: [], t0: [] };
  }
  const grouped = {};
  rawHistory.forEach(item => {
    const day = item.snap_datetime.split(' ')[0];
    if (!grouped[day] || item.snap_datetime > grouped[day].snap_datetime) {
      grouped[day] = item;
    }
  });
  const rows = Object.values(grouped).sort((a, b) =>
    a.snap_datetime.localeCompare(b.snap_datetime)
  );
  return {
    dates:     rows.map(r => r.snap_datetime.slice(0, 16)),
    active_pu: rows.map(r => parseFloat(r.active_pu)    || 0),
    t0:        rows.map(r => parseFloat(r.t0_three_days) || 0),
  };
}

function MultiGraph({ projects, days = 30 }) {
  const { getHistory, status } = useDataStore();

  const data = useMemo(() => {
    if (!projects || projects.length === 0) return null;
    const result = {};
    projects.forEach(p => {
      const raw = getHistory(p, days);
      if (raw && raw.length > 0) result[p] = buildGraphData(raw);
    });
    return result;
  }, [projects, days, getHistory]);

  if (!projects || projects.length === 0)
    return <div className="state-msg">Выберите проекты для сравнения</div>;
  if (status === 'loading' && (!data || Object.keys(data).length === 0))
    return <div className="state-msg">⏳ Загрузка...</div>;
  if (!data || Object.keys(data).length === 0)
    return <div className="state-msg">Нет данных для выбранных проектов</div>;

  const traces = [];
  Object.keys(data).forEach((partner, idx) => {
    const pd    = data[partner];
    if (!pd?.dates?.length) return;
    const color = PALETTE[idx % PALETTE.length];

    // Активные ПУ — сплошная
    traces.push({
      x:             pd.dates,
      y:             pd.active_pu,
      name:          `${partner} — ПУ`,
      type:          'scatter',
      mode:          'lines',
      line:          { color, width: 2 },
      fill:          'tozeroy',
      fillcolor:     `${color}18`,
      hovertemplate: `<b>${partner}</b><br>Активные ПУ: %{y:,.0f}<extra></extra>`,
    });

    // Т0 за 3 дня — пунктир
    traces.push({
      x:             pd.dates,
      y:             pd.t0,
      name:          `${partner} — Т0`,
      type:          'scatter',
      mode:          'lines',
      line:          { color, width: 1.5, dash: 'dot' },
      hovertemplate: `<b>${partner}</b><br>Т0 за 3 дня: %{y:,.0f}<extra></extra>`,
    });
  });

  if (traces.length === 0)
    return <div className="state-msg">Нет данных для выбранных проектов</div>;

  return (
    <Plot
      data={traces}
      layout={PLOTLY_BASE}
      style={{ width: '100%', height: 480 }}
      useResizeHandler
      config={{ displayModeBar: false, responsive: true }}
    />
  );
}

export default MultiGraph;