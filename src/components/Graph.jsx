import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

// ── Общие настройки Plotly для тёмной темы ──────────────────────────────────
const PLOTLY_LAYOUT_BASE = {
  xaxis: {
    tickangle: -45,
    tickfont:  { size: 10, color: '#8892a4' },
    gridcolor: 'rgba(46,50,72,0.7)',
    gridwidth: 0.5,
    zeroline:  false,
    color:     '#8892a4',
  },
  yaxis: {
    tickfont:  { size: 10, color: '#8892a4' },
    gridcolor: 'rgba(46,50,72,0.7)',
    gridwidth: 0.5,
    zeroline:  false,
    color:     '#8892a4',
  },
  hovermode:    'x unified',
  hoverdistance: 50,
  hoverlabel: {
    font:        { size: 13, color: '#e2e8f0', family: "'Segoe UI', system-ui, sans-serif" },
    bgcolor:     '#1a1d27',
    bordercolor: '#2e3248',
    namelength:  -1,
  },
  legend: {
    orientation: 'h',
    y:           -0.22,
    font:        { size: 12, color: '#8892a4' },
  },
  margin:        { l: 52, r: 20, t: 44, b: 72 },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font:          { color: '#8892a4', family: "'Segoe UI', system-ui, sans-serif" },
  showlegend:    true,
};

function calcStats(arr) {
  if (!arr || arr.length === 0) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    mean,
    max:  Math.max(...arr),
    min:  Math.min(...arr),
    last: arr[arr.length - 1],
  };
}

// ── Блок статистики — карточки в стиле дизайн-системы ──────────────────────
function StatsBlock({ stats }) {
  if (!stats) return null;
  const f = (v) => Math.round(v).toLocaleString('ru-RU');

  return (
    <div className="stats-block">
      <div className="sb-card">
        <div className="sb-label">Среднее</div>
        <div className="sb-value col-plain">{f(stats.mean)}</div>
      </div>
      <div className="sb-card">
        <div className="sb-label">Максимум</div>
        <div className="sb-value col-green">{f(stats.max)}</div>
      </div>
      <div className="sb-card">
        <div className="sb-label">Минимум</div>
        <div className="sb-value col-red">{f(stats.min)}</div>
      </div>
      <div className="sb-card">
        <div className="sb-label">Последнее</div>
        <div className="sb-value col-yellow">{f(stats.last)}</div>
      </div>
    </div>
  );
}

function Graph({ partner, days = 30 }) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!partner) return;
    setLoading(true);
    setData(null);
    fetch(`${apiBase}/api/graph_data?partner=${encodeURIComponent(partner)}&days=${days}`)
      .then(r => { if (!r.ok) throw new Error('Ошибка загрузки данных'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [partner, days, apiBase]);

  if (loading) return <div className="state-msg">⏳ Загрузка графиков...</div>;
  if (error)   return <div className="state-msg error">❌ {error}</div>;
  if (!data || !data.dates?.length) return <div className="state-msg">Нет данных</div>;

  // Числовая ось X — непрерывный hover
  const xIdx      = data.dates.map((_, i) => i);
  const dateLabels = data.dates.map(d => d.slice(5));

  const xaxis = {
    ...PLOTLY_LAYOUT_BASE.xaxis,
    tickvals:  xIdx,
    ticktext:  dateLabels,
    type:      'linear',
    range:     [-0.5, xIdx.length - 0.5],
    autorange: false,
  };

  // ── Трассы: ПУ ─────────────────────────────────────────────────────────────
  const tracePU = {
    x:             xIdx,
    y:             data.active_pu,
    name:          'Активные ПУ',
    type:          'scatter',
    mode:          'lines',
    line:          { color: '#6366f1', width: 2.5 },
    fill:          'tozeroy',
    fillcolor:     'rgba(99,102,241,0.18)',
    hovertemplate: '<b>%{text}</b><br>Активные ПУ: %{y:,.0f}<extra></extra>',
    text:          data.dates,
  };
  const traceT0 = {
    x:             xIdx,
    y:             data.t0,
    name:          'Т0 за 3 дня',
    type:          'scatter',
    mode:          'lines',
    line:          { color: '#8b5cf6', width: 2, dash: 'dot' },
    fill:          'tozeroy',
    fillcolor:     'rgba(139,92,246,0.10)',
    hovertemplate: '<b>%{text}</b><br>Т0 за 3 дня: %{y:,.0f}<extra></extra>',
    text:          data.dates,
  };

  // ── Трассы: БС ─────────────────────────────────────────────────────────────
  const traceBSOn = {
    x:             xIdx,
    y:             data.bs_online,
    name:          'БС онлайн',
    type:          'scatter',
    mode:          'lines',
    line:          { color: '#14b8a6', width: 2.5 },
    fill:          'tozeroy',
    fillcolor:     'rgba(20,184,166,0.18)',
    hovertemplate: '<b>%{text}</b><br>БС онлайн: %{y:,.0f}<extra></extra>',
    text:          data.dates,
  };
  const traceBSTotal = {
    x:             xIdx,
    y:             data.bs_total,
    name:          'БС всего',
    type:          'scatter',
    mode:          'lines',
    line:          { color: '#475569', width: 1.5, dash: 'dash' },
    hovertemplate: '<b>%{text}</b><br>БС всего: %{y:,.0f}<extra></extra>',
    text:          data.dates,
  };

  const layoutPU = {
    ...PLOTLY_LAYOUT_BASE,
    xaxis,
    title: {
      text: `Активные ПУ / Т0 — ${partner}`,
      font: { size: 14, color: '#8892a4' },
    },
  };
  const layoutBS = {
    ...PLOTLY_LAYOUT_BASE,
    xaxis,
    title: {
      text: `Базовые станции — ${partner}`,
      font: { size: 14, color: '#8892a4' },
    },
  };

  const statsPU = calcStats(data.active_pu);
  const statsBS = calcStats(data.bs_online);

  const plotConfig = { displayModeBar: false, responsive: true };

  return (
    <div>
      {/* ── График ПУ ── */}
      <div style={{ marginBottom: 28 }}>
        <Plot
          data={[tracePU, traceT0]}
          layout={layoutPU}
          style={{ width: '100%', height: 360 }}
          useResizeHandler
          config={plotConfig}
        />
        <StatsBlock stats={statsPU} />
      </div>

      {/* ── График БС ── */}
      <div>
        <Plot
          data={[traceBSOn, traceBSTotal]}
          layout={layoutBS}
          style={{ width: '100%', height: 300 }}
          useResizeHandler
          config={plotConfig}
        />
        <StatsBlock stats={statsBS} />
      </div>
    </div>
  );
}

export default Graph;
