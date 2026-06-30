import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

// Палитра цветов для разных проектов (можно расширить)
const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

function MultiGraph({ projects, days = 30 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiBase = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    if (!projects || projects.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    projects.forEach(p => params.append('partners', p));
    params.append('days', days);
    fetch(`${apiBase}/api/graph_data_multi?${params.toString()}`)
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
  }, [projects, days, apiBase]);

  if (loading) return <div>Загрузка графиков сравнения...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!data || Object.keys(data).length === 0) return <div>Нет данных для выбранных проектов</div>;

  // Формируем трассы для Plotly
  const traces = [];
  const projectKeys = Object.keys(data);
  projectKeys.forEach((partner, idx) => {
    const partnerData = data[partner];
    if (!partnerData || partnerData.dates.length === 0) return;
    const color = COLORS[idx % COLORS.length];
    // Активные ПУ
    traces.push({
      x: partnerData.dates,
      y: partnerData.active_pu,
      name: `${partner} (ПУ)`,
      type: 'scatter',
      mode: 'lines+markers',
      line: { color, width: 2 },
      marker: { size: 4 },
      yaxis: 'y',
    });
    // Т0 за 3 дня (пунктирная линия)
    traces.push({
      x: partnerData.dates,
      y: partnerData.t0,
      name: `${partner} (Т0)`,
      type: 'scatter',
      mode: 'lines+markers',
      line: { color, width: 2, dash: 'dash' },
      marker: { size: 4 },
      yaxis: 'y',
    });
  });

  const layout = {
    title: { text: 'Сравнение проектов', font: { size: 18, color: '#e0e8f0' } },
    xaxis: {
      tickangle: -45,
      tickfont: { size: 10 },
      gridcolor: '#2a3344',
      gridwidth: 0.5,
      type: 'category',
    },
    yaxis: {
      title: { text: 'Количество', font: { size: 14 } },
      tickfont: { size: 10 },
      gridcolor: '#2a3344',
      gridwidth: 0.5,
    },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.25, font: { size: 12 } },
    margin: { l: 60, r: 30, t: 60, b: 100 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#d0dae8' },
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <Plot
        data={traces}
        layout={layout}
        style={{ width: '100%', height: '500px' }}
        useResizeHandler={true}
        config={{ displayModeBar: false, responsive: true }}
      />
    </div>
  );
}

export default MultiGraph;