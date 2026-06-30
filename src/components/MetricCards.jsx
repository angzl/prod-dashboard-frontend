import React from 'react';
import { useCountUp } from '../hooks/useCountUp';

function MetricCards({ partners, snapshot }) {
  if (!snapshot || snapshot.length === 0) return null;

  let totalPU = 0, totalActive = 0, totalBSOnline = 0, totalBSTotal = 0;
  let sumActivePct = 0, sumBSPct = 0, count = snapshot.length;

  snapshot.forEach(row => {
    const pu = parseInt(row.total_pu) || 0;
    const active = parseInt(row.pu_active) || 0;
    const bsOn = parseInt(row.bs_online) || 0;
    const bsTot = parseInt(row.bs_total) || bsOn;
    totalPU += pu;
    totalActive += active;
    totalBSOnline += bsOn;
    totalBSTotal += bsTot;
    if (pu > 0) sumActivePct += (active / pu) * 100;
    if (bsTot > 0) sumBSPct += (bsOn / bsTot) * 100;
  });

  const avgActivePct = count > 0 ? (sumActivePct / count) : 0;
  const avgBSPct = count > 0 ? (sumBSPct / count) : 0;

  const fmt = (num) => Number(num).toLocaleString('ru-RU');

  // Анимированные значения
  const animatedTotalPU = useCountUp(totalPU);
  const animatedActive = useCountUp(totalActive);
  const animatedBSOnline = useCountUp(totalBSOnline);

  // Определяем цвет для активных ПУ в зависимости от процента
  const activeColor = avgActivePct >= 80 ? 'kpi-green' : (avgActivePct >= 60 ? 'kpi-yellow' : 'kpi-red');
  const bsColor = avgBSPct >= 85 ? 'kpi-green' : (avgBSPct >= 70 ? 'kpi-yellow' : 'kpi-red');

  // Карточки (без иконок, как в примере)
  const cards = [
    {
      label: 'Всего ПУ',
      value: fmt(animatedTotalPU),
      sub: `${partners.length} проектов`,
      cls: 'kpi-plain'
    },
    {
      label: 'Активных ПУ',
      value: fmt(animatedActive),
      sub: `${avgActivePct.toFixed(1)}% активных`,
      cls: activeColor
    },
    {
      label: 'ТО сегодня',
      value: fmt(snapshot.reduce((acc, r) => acc + (parseInt(r.today) || 0), 0)),
      sub: 'сбор показаний',
      cls: 'kpi-yellow'
    },
    {
      label: 'БС всего',
      value: fmt(totalBSTotal),
      sub: 'базовых станций',
      cls: 'kpi-plain'
    },
    {
      label: 'БС онлайн',
      value: fmt(animatedBSOnline),
      sub: `${avgBSPct.toFixed(1)}% онлайн`,
      cls: bsColor
    },
    {
      label: 'Макс. разрыв',
      value: snapshot.reduce((acc, r) => Math.max(acc, parseFloat(r.gap_pct) || 0), 0).toFixed(1) + '%',
      sub: snapshot.reduce((acc, r) => {
        const gap = parseFloat(r.gap_pct) || 0;
        return gap > acc.gap ? { gap, partner: r.partner } : acc;
      }, { gap: 0, partner: '' }).partner || '',
      cls: 'kpi-red'
    }
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, idx) => (
        <div key={idx} className={`kpi-card fade-in-up delay-${(idx % 4) + 1}`}>
          <div className="label">{card.label}</div>
          <div className={`value ${card.cls}`}>{card.value}</div>
          {card.sub && <div className="sub">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export default MetricCards;s