import React, { useState, useEffect } from 'react';

function AllProjectsHistoryTable({ partners, days = 30, title }) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [allData, setAllData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!partners || partners.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const fetchPromises = partners.map(partner =>
      fetch(`${apiBase}/api/history?partner=${encodeURIComponent(partner)}&days=${days}`)
        .then(res => {
          if (!res.ok) throw new Error(`Ошибка загрузки для ${partner}`);
          return res.json();
        })
        .then(data => ({ partner, data }))
        .catch(err => ({ partner, error: err.message }))
    );

    Promise.all(fetchPromises)
      .then(results => {
        const newData = {};
        results.forEach(({ partner, data, error }) => {
          if (error) console.error(error);
          else newData[partner] = data;
        });
        setAllData(newData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [partners, days, apiBase]);

  if (loading) return <div style={{ color: '#8892a4' }}>Загрузка истории...</div>;
  if (error) return <div style={{ color: '#f87171' }}>Ошибка: {error}</div>;

  const hasData = Object.values(allData).some(arr => arr && arr.length > 0);
  if (!hasData) return <div style={{ color: '#8892a4' }}>Нет исторических данных</div>;

  // Группировка по дням (последний срез за день)
  const projectGrouped = {};
  Object.keys(allData).forEach(partner => {
    const rows = allData[partner] || [];
    const grouped = {};
    rows.forEach(item => {
      const dateStr = item.snap_datetime.split(' ')[0];
      if (!grouped[dateStr] || new Date(item.snap_datetime) > new Date(grouped[dateStr].snap_datetime)) {
        grouped[dateStr] = item;
      }
    });
    projectGrouped[partner] = grouped;
  });

  const allDatesSet = new Set();
  Object.values(projectGrouped).forEach(grouped => {
    Object.keys(grouped).forEach(date => allDatesSet.add(date));
  });
  const sortedDates = Array.from(allDatesSet).sort();

  if (sortedDates.length === 0) return <div>Нет данных по датам</div>;

  // ---- Метрики ----
  const metrics = [
    { key: 'total_on_platform', label: 'Всего ПУ', noBg: true },
    { key: 'active_pu', label: 'Активных' },
    { key: 'active_pct', label: '% активных', isPct: true },
    { key: 't0_now', label: 'Сбор Т0 сегодня' },
    { key: 't0_now_pct', label: '%', isPct: true },
    { key: 't0_prev_day', label: 'Сбор Т0 вчера' },
    { key: 't0_prev_day_pct', label: '%', isPct: true },
    { key: 't0_three_days', label: 'Сбор Т0 3 дня' },
    { key: 't0_three_days_pct', label: '%', isPct: true },
    { key: 'gap_pct', label: 'Разрыв акт→Т0-3', isPct: true, invert: true },
    { key: 'bs_total', label: 'БС всего', noBg: true },
    { key: 'bs_online', label: 'БС онлайн' },
    { key: 'bs_metric_pct', label: '% БС', isPct: true, invert: true },
  ];

  const fmt = (num) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString('ru-RU');
  };
  const fmtPct = (num) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toFixed(1) + '%';
  };

  // ---- Для каждого проекта вычисляем средние по каждой метрике ----
  const projectMeans = {};
  Object.keys(projectGrouped).forEach(partner => {
    const grouped = projectGrouped[partner];
    const means = {};
    metrics.forEach(m => {
      const vals = sortedDates
        .map(date => {
          const row = grouped[date];
          if (!row) return null;
          let val = row[m.key];
          if (m.isPct) val = parseFloat(val);
          else val = parseFloat(val);
          return isNaN(val) ? null : val;
        })
        .filter(v => v !== null);
      means[m.key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    projectMeans[partner] = means;
  });

  // ---- Градиент (плавный, красный-жёлтый-зелёный) ----
  const getGradientStyle = (value, mean, invert = false) => {
    if (value === undefined || value === null || isNaN(value) || mean === 0) {
      return { bg: 'transparent', color: '#8892a4' };
    }
    const maxDev = Math.max(Math.abs(value - mean), 0.001);
    let t = (value - mean) / maxDev;
    if (invert) t = -t;
    t = Math.max(-1, Math.min(1, t));
    const intensity = Math.abs(t);
    let r, g, b;
    if (t > 0) {
      const ratio = intensity;
      r = Math.round(255 - (255 - 46) * ratio);
      g = Math.round(255 - (255 - 204) * ratio);
      b = Math.round(0 + 113 * ratio);
    } else {
      const ratio = intensity;
      r = Math.round(255 - (255 - 231) * ratio);
      g = Math.round(255 - (255 - 76) * ratio);
      b = Math.round(0 + 60 * ratio);
    }
    const bg = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 140 ? '#0a0e17' : '#f0f4fa';
    return { bg, color: textColor };
  };

  const projectList = Object.keys(projectGrouped).sort();

  // ---- Рендеринг для одного проекта (или всех) ----
  const renderProject = (partner) => {
    const grouped = projectGrouped[partner];
    const means = projectMeans[partner] || {};

    return (
      <React.Fragment key={partner}>
        {projectList.length > 1 && (
          <div style={{ padding: '8px 12px', fontWeight: 600, color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid var(--border)' }}>
            {partner}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th className="col-project" style={{ minWidth: '100px', textAlign: 'left' }}>Метрика</th>
              {sortedDates.map(date => (
                <th key={date} className="col-date" style={{ minWidth: '60px' }}>{date.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, idx) => {
              const isFirst = idx === 0;
              const noBg = metric.noBg || false;
              const invert = metric.invert || false;
              const mean = means[metric.key] || 0;
              const isPct = metric.isPct || false;

              return (
                <tr key={metric.key}>
                  <td className="col-metric" style={{ fontWeight: isFirst ? 'bold' : 'normal', textAlign: 'left', paddingLeft: isFirst ? '0' : '16px' }}>
                    {metric.label}
                  </td>
                  {sortedDates.map(date => {
                    const row = grouped[date];
                    let display = '—';
                    let style = { bg: 'transparent', color: '#8892a4' };
                    if (row) {
                      const raw = row[metric.key];
                      if (isPct || metric.key === 'gap_pct' || metric.key === 'bs_metric_pct') {
                        display = fmtPct(raw);
                      } else {
                        display = fmt(raw);
                      }
                      if (!noBg) {
                        const val = parseFloat(raw);
                        if (!isNaN(val) && mean !== 0) {
                          style = getGradientStyle(val, mean, invert);
                        }
                      }
                    }
                    return (
                      <td key={date} style={{ backgroundColor: style.bg, color: style.color }}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </React.Fragment>
    );
  };

  return (
    <div className="hist-wrap">
      {projectList.map(partner => renderProject(partner))}
    </div>
  );
}

export default AllProjectsHistoryTable;