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
    { key: 'total_on_platform', label: 'Всего ПУ', plain: true },
    { key: 'active_pu', label: 'Активных', pctKey: 'active_pct' },
    { key: 'active_pct', label: '% активных', isPct: true },
    { key: 't0_now', label: 'Сбор Т0 сегодня', pctKey: 't0_now_pct' },
    { key: 't0_now_pct', label: '%', isPct: true },
    { key: 't0_prev_day', label: 'Сбор Т0 вчера', pctKey: 't0_prev_day_pct' },
    { key: 't0_prev_day_pct', label: '%', isPct: true },
    { key: 't0_three_days', label: 'Сбор Т0 3 дня', pctKey: 't0_three_days_pct' },
    { key: 't0_three_days_pct', label: '%', isPct: true },
    { key: 'gap_pct', label: 'Разрыв акт→Т0-3', isPct: true, invert: true },
    { key: 'bs_total', label: 'БС всего', plain: true },
    { key: 'bs_online', label: 'БС онлайн', pctKey: 'bs_metric_pct' },
    { key: 'bs_metric_pct', label: '% БС', isPct: true },
  ];

  const fmt = (num) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString('ru-RU');
  };

  // ---- Градиентная заливка (как в примере) ----
  // Для каждой строки (метрики) вычисляем среднее значение по дням,
  // затем каждый день окрашиваем относительно этого среднего.
  const projectList = Object.keys(projectGrouped).sort();

  // Если проектов несколько, используем первый (или делаем общий цикл)
  // Но в текущем использовании partners – это либо один проект (детализация) либо все (сводка)
  // Для простоты будем обрабатывать каждый проект отдельно.
  // Однако в вашем коде AllProjectsHistoryTable используется и для всех проектов,
  // поэтому мы будем рендерить таблицу для каждого проекта отдельно.

  // ---- Рендеринг ----
  const renderProjectTable = (partner) => {
    const grouped = projectGrouped[partner];
    if (!grouped || Object.keys(grouped).length === 0) return null;

    // Для каждого дня получаем значения
    const days = sortedDates;
    const rows = metrics.map(metric => {
      const vals = days.map(date => {
        const row = grouped[date];
        if (!row) return null;
        let val = row[metric.key];
        if (metric.pctKey) val = row[metric.pctKey];
        return parseFloat(val);
      });
      // Вычисляем среднее для строки (только для числовых, не plain)
      const valid = vals.filter(v => v !== null && !isNaN(v));
      const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
      return { ...metric, vals, mean };
    });

    // Интерполяция цвета (красный-жёлтый-зелёный)
    const getColor = (value, mean, invert = false) => {
      if (value === null || isNaN(value) || mean === 0) return { bg: 'transparent', color: '#8892a4' };
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
      const bg = `rgb(${r}, ${g}, ${b})`;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      const color = brightness > 140 ? '#0a0e17' : '#f0f4fa';
      return { bg, color };
    };

    return (
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Метрика</th>
            {days.map(date => <th key={date}>{date.slice(5)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((metric, idx) => {
            const isPlain = metric.plain;
            const invert = metric.invert || false;
            const mean = metric.mean;
            return (
              <tr key={idx}>
                <td className="metric-name" style={{ fontWeight: 'normal' }}>{metric.label}</td>
                {metric.vals.map((val, i) => {
                  let display = '—';
                  let style = { bg: 'transparent', color: '#8892a4' };
                  if (val !== null && !isNaN(val)) {
                    display = (metric.isPct || metric.key.includes('_pct') || metric.key === 'gap_pct') ? val.toFixed(1) + '%' : fmt(val);
                    if (!isPlain) {
                      const color = getColor(val, mean, invert);
                      style = { bg: color.bg, color: color.color };
                    }
                  }
                  return <td key={i} style={{ backgroundColor: style.bg, color: style.color }}>{display}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="hist-wrap">
      {projectList.map(partner => (
        <div key={partner}>
          {projectList.length > 1 && <div style={{ padding: '10px 12px', fontWeight: 600, color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid var(--border)' }}>{partner}</div>}
          {renderProjectTable(partner)}
        </div>
      ))}
    </div>
  );
}

export default AllProjectsHistoryTable;