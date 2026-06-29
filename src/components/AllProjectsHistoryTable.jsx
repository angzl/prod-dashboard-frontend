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
          if (error) {
            console.error(error);
          } else {
            newData[partner] = data;
          }
        });
        setAllData(newData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [partners, days, apiBase]);

  if (loading) return <div style={{ color: '#b0c4e0' }}>Загрузка истории...</div>;
  if (error) return <div style={{ color: '#ff6b6b' }}>Ошибка: {error}</div>;

  const hasData = Object.values(allData).some(arr => arr && arr.length > 0);
  if (!hasData) return <div style={{ color: '#b0c4e0' }}>Нет исторических данных для отображения</div>;

  // Группировка по датам (последний срез за день)
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

  // ---- Метрики с вычислением процентов ----
  const metrics = [
    { key: 'total_on_platform', label: 'Всего ПУ', noBg: true },
    { key: 'active_pu', label: 'Активных' },
    { 
      key: 'active_pct', 
      label: '% активных',
      compute: (row) => {
        const total = parseFloat(row.total_on_platform) || 0;
        const active = parseFloat(row.active_pu) || 0;
        const value = total > 0 ? (active / total) * 100 : 0;
        return { value, display: value.toFixed(1) + '%' };
      }
    },
    { key: 't0_now', label: 'Сбор Т0 сегодня' },
    {
      key: 't0_now_pct',
      label: '%',
      compute: (row) => {
        const total = parseFloat(row.total_on_platform) || 0;
        const t0 = parseFloat(row.t0_now) || 0;
        const value = total > 0 ? (t0 / total) * 100 : 0;
        return { value, display: value.toFixed(1) + '%' };
      }
    },
    { key: 't0_prev_day', label: 'Сбор Т0 вчера' },
    {
      key: 't0_prev_day_pct',
      label: '%',
      compute: (row) => {
        const total = parseFloat(row.total_on_platform) || 0;
        const t0 = parseFloat(row.t0_prev_day) || 0;
        const value = total > 0 ? (t0 / total) * 100 : 0;
        return { value, display: value.toFixed(1) + '%' };
      }
    },
    { key: 't0_three_days', label: 'Сбор Т0 3 дня' },
    {
      key: 't0_three_days_pct',
      label: '%',
      compute: (row) => {
        const total = parseFloat(row.total_on_platform) || 0;
        const t0 = parseFloat(row.t0_three_days) || 0;
        const value = total > 0 ? (t0 / total) * 100 : 0;
        return { value, display: value.toFixed(1) + '%' };
      }
    },
    {
      key: 'gap_pct',
      label: 'Разрыв акт→Т0-3',
      compute: (row) => {
        const active = parseFloat(row.active_pu) || 0;
        const t0 = parseFloat(row.t0_three_days) || 0;
        const value = active > 0 ? ((active - t0) / active) * 100 : 0;
        return { value, display: value.toFixed(1) + '%' };
      },
      invert: true
    },
    { key: 'bs_total', label: 'БС всего', noBg: true },
    { key: 'bs_online', label: 'БС онлайн' },
    {
      key: 'bs_metric_pct',
      label: '% БС',
      compute: (row) => {
        const total = parseFloat(row.bs_total) || 0;
        const online = parseFloat(row.bs_online) || 0;
        const value = total > 0 ? (online / total) * 100 : 0;
        return { value, display: value.toFixed(1) + '%' };
      },
      invert: true
    }
  ];

  const fmt = (num) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString('ru-RU');
  };
  const fmtPct = (num) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toFixed(1) + '%';
  };

  // ---- Вычисление средних для каждого проекта отдельно ----
  const projectMeans = {};
  Object.keys(projectGrouped).forEach(partner => {
    const grouped = projectGrouped[partner];
    const means = {};
    metrics.forEach(m => {
      const vals = sortedDates
        .map(date => {
          const row = grouped[date];
          if (!row) return null;
          if (m.compute) {
            const { value } = m.compute(row);
            return isNaN(value) ? null : value;
          } else {
            const val = parseFloat(row[m.key]);
            return isNaN(val) ? null : val;
          }
        })
        .filter(v => v !== null);
      means[m.key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    projectMeans[partner] = means;
  });

  // ---- Градиент (с настраиваемым range) ----
  const getGradientStyle = (value, mean, invert = false) => {
    if (value === undefined || value === null || isNaN(value) || mean === 0) {
      return { bg: 'transparent', color: '#e0e8f0' };
    }
    const range = 0.04 * mean; // чувствительность 4% от среднего (вы настроили)
    let t = (value - mean) / range;
    if (invert) t = -t;
    t = Math.max(-1, Math.min(1, t));
    const intensity = Math.abs(t);
    let r, g, b;
    if (t > 0) {
      // от жёлтого к зелёному
      const ratio = intensity;
      r = Math.round(255 - (255 - 46) * ratio);
      g = Math.round(255 - (255 - 204) * ratio);
      b = Math.round(0 + 113 * ratio);
    } else {
      // от жёлтого к красному
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
  const displayTitle = title || '📊 Детальная история по всем проектам (Excel-формат)';
  const isSingleProject = projectList.length === 1;

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ color: '#b0c4e0', marginBottom: '12px' }}>
        {displayTitle}
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="col-project">Проект</th>
              <th className="col-metric">Метрика</th>
              {sortedDates.map(date => (
                <th key={date} className="col-date">{date.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projectList.map((partner, partnerIndex) => {
              const grouped = projectGrouped[partner];
              const means = projectMeans[partner] || {};
              const isLastProject = partnerIndex === projectList.length - 1;

              return (
                <React.Fragment key={partner}>
                  {metrics.map((metric, metricIdx) => {
                    const isFirst = metricIdx === 0;
                    const isLast = metricIdx === metrics.length - 1;
                    const noBg = metric.noBg || false;
                    const invert = metric.invert || false;
                    const mean = means[metric.key] || 0;

                    return (
                      <tr key={`${partner}-${metric.key}`} className={isLast ? 'last-metric-row' : ''}>
                        {isFirst && (
                          <td className="col-project" rowSpan={metrics.length}>
                            {partner}
                          </td>
                        )}
                        <td className="col-metric">{metric.label}</td>
                        {sortedDates.map(date => {
                          const row = grouped[date];
                          let display = '—';
                          let value = null;
                          let style = { bg: 'transparent', color: '#e0e8f0' };
                          if (row) {
                            if (metric.compute) {
                              const comp = metric.compute(row);
                              display = comp.display;
                              value = comp.value;
                            } else {
                              const raw = row[metric.key];
                              if (metric.key.endsWith('_pct') || metric.key === 'gap_pct' || metric.key === 'bs_metric_pct') {
                                display = fmtPct(raw);
                                value = parseFloat(raw);
                              } else {
                                display = fmt(raw);
                                value = parseFloat(raw);
                              }
                            }
                            if (!noBg && value !== null && !isNaN(value) && mean !== 0) {
                              style = getGradientStyle(value, mean, invert);
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

                  {/* Разделитель между проектами – показываем только если больше одного проекта */}
                  {!isLastProject && projectList.length > 1 && (
                    <tr className="project-separator">
                      <td colSpan={2 + sortedDates.length} style={{ height: '16px', padding: 0, border: 'none', background: 'transparent' }} />
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AllProjectsHistoryTable;