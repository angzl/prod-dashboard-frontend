import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { useDataStore } from '../context/DataContext';

/* TotalGraphs — графики «Весь прод» с детализацией.
   ВСЯ агрегация (группировка сырых срезов по дням, выравнивание по общей
   шкале дат, суммы по проектам и gap%) выполняется НА СЕРВЕРЕ —
   GET /api/graph_totals. Фронт получает готовые массивы и только
   отрисовывает их, поэтому на слабых ПК нет фризов.
   Берём максимальный доступный период (365 дней). */

const PALETTE = [
  '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#22c55e', '#f97316', '#3b82f6', '#84cc16',
];

function darkLayout(title) {
  return {
    title: { text: title, font: { size: 14, color: '#8892a4' } },
    xaxis: {
      tickangle: -45,
      tickfont: { size: 10, color: '#8892a4' },
      gridcolor: 'rgba(46,50,72,0.7)',
      gridwidth: 0.5,
      zeroline: false,
      type: 'category',
      color: '#8892a4',
    },
    yaxis: {
      title: { text: 'Количество', font: { size: 12, color: '#8892a4' } },
      tickfont: { size: 10, color: '#8892a4' },
      gridcolor: 'rgba(46,50,72,0.7)',
      gridwidth: 0.5,
      zeroline: false,
      color: '#8892a4',
    },
    hovermode: 'x unified',
    hoverlabel: {
      font: { size: 13, color: '#e2e8f0', family: "'Segoe UI',system-ui,sans-serif" },
      bgcolor: '#1a1d27',
      bordercolor: '#2e3248',
      namelength: -1,
    },
    legend: {
      orientation: 'h',
      y: -0.25,
      font: { size: 11, color: '#8892a4' },
    },
    margin: { l: 60, r: 20, t: 50, b: 100 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#8892a4', family: "'Segoe UI',system-ui,sans-serif" },
    showlegend: true,
  };
}

function TotalGraphs() {
  const { partners, fetchGraphTotals } = useDataStore();

  const days = 365;

  /* Готовые данные с сервера: {dates, per_partner, totals} */
  const [data, setData] = useState(null);

  // Стабильный ключ списка проектов (массив partners пересоздаётся при рендере)
  const partnersKey = (partners || []).join('\u0000');

  useEffect(() => {
    let alive = true;
    setData(null);
    if (!partnersKey) return;
    fetchGraphTotals(partnersKey.split('\u0000'), days).then((d) => {
      if (alive) setData(d);
    });
    return () => { alive = false; };
  }, [partnersKey, days, fetchGraphTotals]);

  if (!partners || partners.length === 0)
    return <div className="state-msg">Нет проектов</div>;
  if (!data)
    return <div className="state-msg">⏳ Загрузка графиков...</div>;

  const allDates = data.dates || [];
  const perPartner = data.per_partner || {};
  const totals = data.totals || {};
  const partnerNames = Object.keys(perPartner);

  if (allDates.length === 0)
    return <div className="state-msg">Нет данных для графиков</div>;

  const plotConfig = { displayModeBar: false, responsive: true };

  const activeTraces = [];
  partnerNames.forEach((partner, idx) => {
    const pd = perPartner[partner];
    if (!pd || !pd.active_pu || !pd.active_pu.length) return;
    activeTraces.push({
      x: allDates,
      y: pd.active_pu,               // уже выровнено по общей шкале на сервере
      name: partner,
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'active',
      line: { color: PALETTE[idx % PALETTE.length], width: 0.8 },
      fillcolor: PALETTE[idx % PALETTE.length] + '22',
      hovertemplate: '<b>' + partner + '</b><br>Активные: %{y:,.0f}<extra></extra>',
    });
  });

  const totalLinesTraces = [
    {
      x: allDates,
      y: totals.active_pu,
      name: 'Σ Активных ПУ',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#6366f1', width: 2.5 },
      fill: 'tozeroy',
      fillcolor: '#6366f118',
      hovertemplate: '<b>Σ Активных ПУ</b><br>%{y:,.0f}<extra></extra>',
    },
    {
      x: allDates,
      y: totals.t0_three_days,
      name: 'Σ ТО 3 дня',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#22c55e', width: 2, dash: 'dot' },
      hovertemplate: '<b>Σ ТО 3 дня</b><br>%{y:,.0f}<extra></extra>',
    },
  ];

  const bsTraces = [];
  partnerNames.forEach((partner, idx) => {
    const pd = perPartner[partner];
    if (!pd || !pd.bs_online || !pd.bs_online.length) return;
    bsTraces.push({
      x: allDates,
      y: pd.bs_online,               // уже выровнено по общей шкале на сервере
      name: partner,
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'bs',
      line: { color: PALETTE[idx % PALETTE.length], width: 0.8 },
      fillcolor: PALETTE[idx % PALETTE.length] + '22',
      hovertemplate: '<b>' + partner + '</b><br>БС онлайн: %{y:,.0f}<extra></extra>',
    });
  });
  bsTraces.push({
    x: allDates,
    y: totals.bs_total,
    name: 'Σ БС всего',
    type: 'scatter',
    mode: 'lines',
    line: { color: '#f59e0b', width: 2, dash: 'dash' },
    hovertemplate: '<b>Σ БС всего</b><br>%{y:,.0f}<extra></extra>',
  });

  const gapTraces = [
    {
      x: allDates,
      y: totals.gap_pct,
      name: 'Gap% (весь прод)',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#ef4444', width: 2.5 },
      fill: 'tozeroy',
      fillcolor: '#ef444418',
      hovertemplate: '<b>Gap%</b><br>%{y:.1f}%<extra></extra>',
    },
  ];

  var gapLayout = Object.assign({}, darkLayout('Разрыв (gap%) по всему проду'), {
    yaxis: Object.assign({}, darkLayout('').yaxis, {
      title: { text: '%', font: { size: 12, color: '#8892a4' } },
      rangemode: 'tozero',
    }),
  });

  return (
    <>
      <div className="card">
        <div className="card-header">📈 Активные ПУ по проектам (стэк)</div>
        <Plot
          data={activeTraces}
          layout={darkLayout('Активные ПУ по проектам во времени')}
          style={{ width: '100%', height: 420 }}
          useResizeHandler
          config={plotConfig}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">📊 Итог: активные ПУ и ТО 3 дня</div>
        <Plot
          data={totalLinesTraces}
          layout={darkLayout('Σ Активных ПУ и Σ ТО 3 дня (весь прод)')}
          style={{ width: '100%', height: 380 }}
          useResizeHandler
          config={plotConfig}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">📶 Базовые станции по проектам</div>
        <Plot
          data={bsTraces}
          layout={darkLayout('БС онлайн по проектам + Σ БС всего')}
          style={{ width: '100%', height: 420 }}
          useResizeHandler
          config={plotConfig}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">⚠️ Разрыв (gap%)</div>
        <Plot
          data={gapTraces}
          layout={gapLayout}
          style={{ width: '100%', height: 340 }}
          useResizeHandler
          config={plotConfig}
        />
      </div>
    </>
  );
}

export default TotalGraphs;