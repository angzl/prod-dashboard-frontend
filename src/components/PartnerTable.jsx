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

  // Цветовые классы для чисел
  const getNumClass = (value, threshold1 = 0, threshold2 = 0) => {
    if (value === undefined || value === null) return 'c-plain';
    if (value >= threshold2) return 'c-green';
    if (value >= threshold1) return 'c-yellow';
    return 'c-red';
  };

  // Для БС онлайн – чем выше, тем лучше
  const getBsClass = (pct) => {
    if (pct >= 85) return 'c-green';
    if (pct >= 70) return 'c-yellow';
    return 'c-red';
  };

  const getPill = (value, good, medium) => {
    if (value >= good) return 'pill-green';
    if (value >= medium) return 'pill-yellow';
    return 'pill-red';
  };

  // Определяем максимальный разрыв для прогресс-бара
  const maxGap = data.reduce((acc, r) => Math.max(acc, parseFloat(r.gap_pct) || 0), 0);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Проект</th>
            <th>Всего ПУ</th>
            <th>Активных ПУ</th>
            <th>% активных</th>
            <th>ТО сегодня</th>
            <th>% ТО сег.</th>
            <th>ТО вчера</th>
            <th>% ТО вч.</th>
            <th>ТО 3 дня</th>
            <th>% ТО 3д.</th>
            <th>Разрыв %</th>
            <th>БС всего</th>
            <th>БС онлайн</th>
            <th>% БС</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const total = parseInt(r.total_pu) || 0;
            const active = parseInt(r.pu_active) || 0;
            const activePct = total > 0 ? (active / total) * 100 : 0;
            const t0Today = parseInt(r.today) || 0;
            const t0TodayPct = total > 0 ? (t0Today / total) * 100 : 0;
            const t0Prev = parseInt(r.date_1) || 0;
            const t0PrevPct = total > 0 ? (t0Prev / total) * 100 : 0;
            const t0Three = parseInt(r.date_3) || 0;
            const t0ThreePct = total > 0 ? (t0Three / total) * 100 : 0;
            const gap = parseFloat(r.gap_pct) || 0;
            const bsOn = parseInt(r.bs_online) || 0;
            const bsTotal = parseInt(r.bs_total) || bsOn;
            const bsPct = bsTotal > 0 ? (bsOn / bsTotal) * 100 : 0;

            // Прогресс-бар
            const barPct = Math.min(gap / (maxGap || 1) * 100, 100);
            const barColor = gap > 30 ? 'bar-red' : (gap > 15 ? 'bar-yellow' : 'bar-green');

            return (
              <tr>
                <td><span className="proj-chip">{r.partner}</span></td>
                <td className="c-plain">{fmt(total)}</td>
                <td className={getNumClass(active, 70, 80)}>{fmt(active)}</td>
                <td>
                  <div className="bar-wrap">
                    <div className="bar-bg"><div className={`bar-fill ${activePct >= 80 ? 'bar-green' : (activePct >= 60 ? 'bar-yellow' : 'bar-red')}`} style={{ width: `${Math.min(activePct, 100)}%` }}></div></div>
                    <span className={`pill ${getPill(activePct, 80, 60)}`}>{activePct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className={getNumClass(t0Today, 0, 0)}>{fmt(t0Today)}</td>
                <td><span className={`pill ${getPill(t0TodayPct, 75, 50)}`}>{t0TodayPct.toFixed(1)}%</span></td>
                <td className={getNumClass(t0Prev, 0, 0)}>{fmt(t0Prev)}</td>
                <td><span className={`pill ${getPill(t0PrevPct, 75, 50)}`}>{t0PrevPct.toFixed(1)}%</span></td>
                <td className={getNumClass(t0Three, 0, 0)}>{fmt(t0Three)}</td>
                <td><span className={`pill ${getPill(t0ThreePct, 80, 60)}`}>{t0ThreePct.toFixed(1)}%</span></td>
                <td>
                  <div className="bar-wrap">
                    <div className="bar-bg"><div className={`bar-fill ${barColor}`} style={{ width: `${Math.min(barPct, 100)}%` }}></div></div>
                    <span className={`pill ${gap > 30 ? 'pill-red' : (gap > 15 ? 'pill-yellow' : 'pill-green')}`}>{gap.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="c-plain">{fmt(bsTotal)}</td>
                <td className={getBsClass(bsPct)}>{fmt(bsOn)}</td>
                <td><span className={`pill ${getPill(bsPct, 85, 70)}`}>{bsPct.toFixed(1)}%</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PartnerTable;