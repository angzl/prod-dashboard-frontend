import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useDataStore } from '../context/DataContext';

/* TotalGraphs — графики «Весь прод» с детализацией.
   Все графики строятся из state.history (агрегация на фронте),
   без отдельных запросов к бэкенду — работает в рамках SSE push-модели.
   Берём максимальный доступный период (90 дней). */

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

function buildDailyHistory(rawHistory) {
  if (!rawHistory || rawHistory.length === 0) {
    return { dates: [], active_pu: [], t0_three_days: [], bs_online: [], bs_total: [] };
  }
  const grouped = {};
  rawHistory.forEach((item) => {
    const day = item.snap_datetime.split(' ')[0];
    if (!grouped[day] || item.snap_datetime > grouped[day].snap_datetime) {
      grouped[day] = item;
    }
  });
  const rows = Object.values(grouped).sort((a, b) =>
    a.snap_datetime.localeCompare(b.snap_datetime)
  );
  return {
    dates: rows.map((r) => r.snap_datetime.slice(0, 16)),
    active_pu: rows.map((r) => parseFloat(r.active_pu) || 0),
    t0_three_days: rows.map((r) => parseFloat(r.t0_three_days) || 0),
    bs_online: rows.map((r) => parseFloat(r.bs_online) || 0),
    bs_total: rows.map((r) => parseFloat(r.bs_total) || 0),
  };
}

function TotalGraphs() {
  const { partners, getHistory, status } = useDataStore();

  const days = 90;

  const perPartner = useMemo(() => {
    if (!partners || partners.length === 0) return {};
    const result = {};
    partners.forEach((p) => {
      const raw = getHistory(p, days);
      if (raw && raw.length > 0) result[p] = buildDailyHistory(raw);
    });
    return result;
  }, [partners, days, getHistory]);

  const allDates = useMemo(() => {
    const set = new Set();
    Object.values(perPartner).forEach((pd) => {
      (pd.dates || []).forEach((d) => set.add(d));
    });
    return Array.from(set).sort();
  }, [perPartner]);

  const totals = useMemo(() => {
    const active = {}, t03 = {}, bsOn = {}, bsTot = {};
    allDates.forEach((d) => { active[d] = 0; t03[d] = 0; bsOn[d] = 0; bsTot[d] = 0; });
    Object.values(perPartner).forEach((pd) => {
      (pd.dates || []).forEach((d, i) => {
        active[d] += pd.active_pu[i] || 0;
        t03[d] += pd.t0_three_days[i] || 0;
        bsOn[d] += pd.bs_online[i] || 0;
        bsTot[d] += pd.bs_total[i] || 0;
      });
    });
    const gap = allDates.map((d) => {
      const a = active[d];
      return a > 0 ? Math.max(0, Math.min(100, 100 - (t03[d] / a) * 100)) : 0;
    });
    return {
      active_pu: allDates.map((d) => active[d]),
      t0_three_days: allDates.map((d) => t03[d]),
      bs_online: allDates.map((d) => bsOn[d]),
      bs_total: allDates.map((d) => bsTot[d]),
      gap_pct: gap,
    };
  }, [perPartner, allDates]);

  if (!partners || partners.length === 0)
    return <div className="state-msg">Нет проектов</div>;
  if (status === 'loading' && Object.keys(perPartner).length === 0)
    return <div className="state-msg">⏳ Загрузка...</div>;
  if (allDates.length === 0)
    return <div className="state-msg">Нет данных для графиков</div>;

  const plotConfig = { displayModeBar: false, responsive: true };

  const activeTraces = [];
  const partnerNames = Object.keys(perPartner);
  partnerNames.forEach((partner, idx) => {
    const pd = perPartner[partner];
    if (!pd || !pd.dates || !pd.dates.length) return;
    const map = {};
    pd.dates.forEach((d, i) => (map[d] = pd.active_pu[i] || 0));
    const y = allDates.map((d) => map[d] || 0);
    activeTraces.push({
      x: allDates,
      y: y,
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
    if (!pd || !pd.dates || !pd.dates.length) return;
    const map = {};
    pd.dates.forEach((d, i) => (map[d] = pd.bs_online[i] || 0));
    const y = allDates.map((d) => map[d] || 0);
    bsTraces.push({
      x: allDates,
      y: y,
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