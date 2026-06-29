import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

function Graph({ partner, days = 30 }) {
  const apiBase = import.meta.env.VITE_API_URL || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!partner) return;
    setLoading(true);
    fetch(`${apiBase}/api/graph_data?partner=${encodeURIComponent(partner)}&days=${days}`)
      .then(res => {
        if (!res.ok) throw new Error('Ошибка загрузки данных');
        return res.json();
      })
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [partner, days, apiBase]);

  if (loading) return <div>Загрузка графиков...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!data || data.dates.length === 0) return <div>Нет данных для отображения</div>;

  // ---- Преобразуем даты в числовые индексы для непрерывного hover ----
  const xIndices = data.dates.map((_, i) => i);
  const dateLabels = data.dates.map(d => d.slice(5)); // MM-DD

  // ---- Статистика (округление среднего) ----
  const calcStats = (arr) => {
    if (!arr || arr.length === 0) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = Math.max(...arr);
    const min = Math.min(...arr);
    const last = arr[arr.length - 1];
    return { mean, max, min, last };
  };

  const statsPU = calcStats(data.active_pu);
  const statsBS = calcStats(data.bs_online);

  // ---- Трассы с числовым X ----
  const tracePU = {
    x: xIndices,
    y: data.active_pu,
    name: 'Активные ПУ',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#3b82f6', width: 2 },
    marker: { size: 4 },
    fill: 'tozeroy',
    fillcolor: 'rgba(59, 130, 246, 0.15)',
    hovertemplate: '<b>%{text}</b><br>Активные ПУ: %{y:,.0f}<extra></extra>',
    text: data.dates, // передаём полные даты для hover
  };

  const traceT0 = {
    x: xIndices,
    y: data.t0,
    name: 'Т0 за 3 дня',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#a855f7', width: 2 },
    marker: { size: 4 },
    fill: 'tozeroy',
    fillcolor: 'rgba(168, 85, 247, 0.15)',
    hovertemplate: '<b>%{text}</b><br>Т0 за 3 дня: %{y:,.0f}<extra></extra>',
    text: data.dates,
  };

  const traceBSOn = {
    x: xIndices,
    y: data.bs_online,
    name: 'БС онлайн',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#10b981', width: 2 },
    marker: { size: 4 },
    fill: 'tozeroy',
    fillcolor: 'rgba(16, 185, 129, 0.15)',
    hovertemplate: '<b>%{text}</b><br>БС онлайн: %{y:,.0f}<extra></extra>',
    text: data.dates,
  };

  const traceBSTotal = {
    x: xIndices,
    y: data.bs_total,
    name: 'БС всего',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#94a3b8', width: 2, dash: 'dash' },
    marker: { size: 4 },
    hovertemplate: '<b>%{text}</b><br>БС всего: %{y:,.0f}<extra></extra>',
    text: data.dates,
  };

  // ---- Общий layout с числовой осью и настройками hover ----
  const commonLayout = {
    xaxis: {
      tickvals: xIndices,
      ticktext: dateLabels,
      tickangle: -45,
      tickfont: { size: 10 },
      gridcolor: '#2a3344',
      gridwidth: 0.5,
      type: 'linear',           // числовая ось – непрерывный hover
      range: [-0.5, xIndices.length - 0.5], // немного расширяем края
      autorange: false,
    },
    yaxis: {
      tickfont: { size: 10 },
      gridcolor: '#2a3344',
      gridwidth: 0.5,
      zeroline: false,
    },
    hovermode: 'x unified',     // единая подсказка на всей ширине
    hoverdistance: 50,          // увеличенная область захвата (пиксели)
    hoverlabel: {
      font: { size: 14, color: '#f0f4fa' },
      bgcolor: '#1a212e',
      bordercolor: '#3a4a5a',
      namelength: -1,
    },
    legend: { orientation: 'h', y: -0.25, font: { size: 12 } },
    margin: { l: 50, r: 30, t: 50, b: 80 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#d0dae8' },
    showlegend: true,
  };

  const layoutTop = {
    ...commonLayout,
    title: { text: `Активные ПУ / Т0 — ${partner}`, font: { size: 16, color: '#e0e8f0' } },
  };

  const layoutBottom = {
    ...commonLayout,
    title: { text: `Базовые станции — ${partner}`, font: { size: 16, color: '#e0e8f0' } },
  };

  // ---- Компонент статистики ----
  const StatsBlock = ({ title, stats }) => {
    if (!stats) return null;
    const fmt = (v) => Number(v).toLocaleString('ru-RU');
    const fmtMean = Math.round(stats.mean).toLocaleString('ru-RU');
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginTop: '16px',
        padding: '12px 16px',
        backgroundColor: '#111b26',
        borderRadius: '8px',
        border: '1px solid #2a3344'
      }}>
        <div><span style={{ color: '#8899bb' }}>Среднее</span> <strong>{fmtMean}</strong></div>
        <div><span style={{ color: '#8899bb' }}>Макс</span> <strong style={{ color: '#10b981' }}>{fmt(stats.max)}</strong></div>
        <div><span style={{ color: '#8899bb' }}>Мин</span> <strong style={{ color: '#f87171' }}>{fmt(stats.min)}</strong></div>
        <div><span style={{ color: '#8899bb' }}>Последнее</span> <strong style={{ color: '#60a5fa' }}>{fmt(stats.last)}</strong></div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <Plot
          data={[tracePU, traceT0]}
          layout={layoutTop}
          style={{ width: '100%', height: '480px' }}
          useResizeHandler={true}
          config={{ displayModeBar: false, responsive: true }}
        />
        <StatsBlock title="Активные ПУ" stats={statsPU} />
      </div>

      <div>
        <Plot
          data={[traceBSOn, traceBSTotal]}
          layout={layoutBottom}
          style={{ width: '100%', height: '480px' }}
          useResizeHandler={true}
          config={{ displayModeBar: false, responsive: true }}
        />
        <StatsBlock title="БС онлайн" stats={statsBS} />
      </div>
    </div>
  );
}

export default Graph;