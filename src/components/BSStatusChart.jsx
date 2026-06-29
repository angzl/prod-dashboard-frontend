import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

function BSStatusChart({ partners }) {
  const apiBase = import.meta.env.VITE_API_URL || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partners || partners.length === 0) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    partners.forEach(p => params.append('partners', p));
    fetch(`${apiBase}/api/snapshot?${params.toString()}`)
      .then(res => res.json())
      .then(snapshot => {
        // Суммируем по всем партнёрам
        let totalBS = 0, onlineBS = 0;
        snapshot.forEach(row => {
          const bsOn = parseInt(row.bs_online) || 0;
          const bsTot = parseInt(row.bs_total) || bsOn;
          totalBS += bsTot;
          onlineBS += bsOn;
        });
        const offlineBS = totalBS - onlineBS;
        setData({
          online: onlineBS,
          offline: offlineBS,
          total: totalBS
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [partners, apiBase]);

  if (loading) return <div style={{ color: '#8899bb' }}>Загрузка состояния БС...</div>;
  if (!data || data.total === 0) return <div style={{ color: '#8899bb' }}>Нет данных о БС</div>;

  const onlinePct = (data.online / data.total * 100).toFixed(1);
  const offlinePct = (data.offline / data.total * 100).toFixed(1);

  const pieData = [{
    values: [data.online, data.offline],
    labels: [`В сети (${onlinePct}%)`, `Не в сети (${offlinePct}%)`],
    type: 'pie',
    marker: {
      colors: ['#2ecc71', '#e74c3c']
    },
    textinfo: 'label+percent',
    hoverinfo: 'label+value+percent',
    hole: 0.4,
  }];

  const layout = {
    title: {
      text: 'Текущее состояние БС',
      font: { size: 16, color: '#b8c7e0' }
    },
    margin: { l: 20, r: 20, t: 50, b: 20 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#d0dae8' },
    legend: {
      orientation: 'h',
      y: -0.1,
      font: { size: 13 }
    }
  };

  return (
    <div style={{ height: '280px' }}>
      <Plot
        data={pieData}
        layout={layout}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        config={{ displayModeBar: false }}
      />
    </div>
  );
}

export default BSStatusChart;