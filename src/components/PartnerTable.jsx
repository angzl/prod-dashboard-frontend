import React, { useState, useEffect } from 'react';

function PartnerTable({ partners }) {
  const apiBase = import.meta.env.VITE_API_URL || '';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!partners || partners.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    partners.forEach(p => params.append('partners', p));
    fetch(`${apiBase}/api/snapshot?${params.toString()}`)
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
  }, [partners, apiBase]);

  if (loading) return <div>Загрузка таблицы...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!data || data.length === 0) return <div>Нет данных для отображения</div>;

  const fmt = (num) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString('ru-RU');
  };

  // ---- Вычисляем средние для каждого процентного столбца (по всем партнёрам) ----
  const calcMean = (values) => {
    const valid = values.filter(v => v !== undefined && v !== null && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  // Для каждого партнёра вычисляем проценты
  const rows = data.map(row => {
    const total = parseInt(row.total_pu) || 0;
    const active = parseInt(row.pu_active) || 0;
    const activePct = total > 0 ? (active / total) * 100 : 0;
    const t0Today = parseInt(row.today) || 0;
    const t0TodayPct = total > 0 ? (t0Today / total) * 100 : 0;
    const t0Prev = parseInt(row.date_1) || 0;
    const t0PrevPct = total > 0 ? (t0Prev / total) * 100 : 0;
    const t0Three = parseInt(row.date_3) || 0;
    const t0ThreePct = total > 0 ? (t0Three / total) * 100 : 0;
    const gap = parseFloat(row.gap_pct) || 0;
    const bsOn = parseInt(row.bs_online) || 0;
    const bsTotal = parseInt(row.bs_total) || bsOn;
    const bsPct = bsTotal > 0 ? (bsOn / bsTotal) * 100 : 0;
    return { ...row, total, active, activePct, t0Today, t0TodayPct, t0Prev, t0PrevPct, t0Three, t0ThreePct, gap, bsOn, bsTotal, bsPct };
  });

  // Средние для каждого процентного показателя
  const means = {
    activePct: calcMean(rows.map(r => r.activePct)),
    t0TodayPct: calcMean(rows.map(r => r.t0TodayPct)),
    t0PrevPct: calcMean(rows.map(r => r.t0PrevPct)),
    t0ThreePct: calcMean(rows.map(r => r.t0ThreePct)),
    gap: calcMean(rows.map(r => r.gap)),
    bsPct: calcMean(rows.map(r => r.bsPct)),
  };

  // ---- Функция градиента на основе отклонения от среднего ----
  const getGradientStyle = (value, mean, invert = false) => {
    if (value === undefined || value === null || isNaN(value)) {
      return { bg: 'transparent', color: '#e0e8f0' };
    }
    // Находим максимальное отклонение для нормализации
    const maxDev = Math.max(Math.abs(value - mean), 0.001);
    let t = (value - mean) / maxDev;
    if (invert) t = -t;
    t = Math.max(-1, Math.min(1, t));
    // Преобразуем t в диапазон [0,1] для градиента
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

  // ---- Рендеринг ----
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Проект</th>
            <th>Всего ПУ</th>
            <th>Активные ПУ</th>
            <th>% активных</th>
            <th>Т0 сегодня</th>
            <th>%</th>
            <th>Т0 вчера</th>
            <th>%</th>
            <th>Т0 3 дня</th>
            <th>%</th>
            <th>Разрыв %</th>
            <th>БС всего</th>
            <th>БС онлайн</th>
            <th>% БС</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const styleActive = getGradientStyle(r.activePct, means.activePct);
            const styleT0Today = getGradientStyle(r.t0TodayPct, means.t0TodayPct);
            const styleT0Prev = getGradientStyle(r.t0PrevPct, means.t0PrevPct);
            const styleT0Three = getGradientStyle(r.t0ThreePct, means.t0ThreePct);
            const styleGap = getGradientStyle(r.gap, means.gap, true); // инвертируем
            const styleBs = getGradientStyle(r.bsPct, means.bsPct);

            return (
              <tr key={idx}>
                <td style={{ fontWeight: 'bold', textAlign: 'left' }}>{r.partner}</td>
                <td>{fmt(r.total)}</td>
                <td style={{ backgroundColor: styleActive.bg, color: styleActive.color }}>{fmt(r.active)}</td>
                <td style={{ backgroundColor: styleActive.bg, color: styleActive.color }}>{r.activePct.toFixed(1)}%</td>
                <td style={{ backgroundColor: styleT0Today.bg, color: styleT0Today.color }}>{fmt(r.t0Today)}</td>
                <td style={{ backgroundColor: styleT0Today.bg, color: styleT0Today.color }}>{r.t0TodayPct.toFixed(1)}%</td>
                <td style={{ backgroundColor: styleT0Prev.bg, color: styleT0Prev.color }}>{fmt(r.t0Prev)}</td>
                <td style={{ backgroundColor: styleT0Prev.bg, color: styleT0Prev.color }}>{r.t0PrevPct.toFixed(1)}%</td>
                <td style={{ backgroundColor: styleT0Three.bg, color: styleT0Three.color }}>{fmt(r.t0Three)}</td>
                <td style={{ backgroundColor: styleT0Three.bg, color: styleT0Three.color }}>{r.t0ThreePct.toFixed(1)}%</td>
                <td style={{ backgroundColor: styleGap.bg, color: styleGap.color }}>{r.gap.toFixed(1)}%</td>
                <td>{fmt(r.bsTotal)}</td>
                <td style={{ backgroundColor: styleBs.bg, color: styleBs.color }}>{fmt(r.bsOn)}</td>
                <td style={{ backgroundColor: styleBs.bg, color: styleBs.color }}>{r.bsPct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PartnerTable;