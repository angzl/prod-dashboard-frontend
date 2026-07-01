import React from 'react';
import { useCountUp } from '../hooks/useCountUp';
// Данные теперь передаются через props из App (из DataContext)

function MetricCards({ partners, snapshot }) {
  if (!snapshot || snapshot.length === 0) return null;

  let totalPU = 0, totalActive = 0, totalBSOnline = 0, totalBSTotal = 0, totalT0Today = 0;
  let maxGap = 0, maxGapPartner = '';

  snapshot.forEach(row => {
    const pu    = parseInt(row.total_pu)  || 0;
    const act   = parseInt(row.pu_active) || 0;
    const bsOn  = parseInt(row.bs_online) || 0;
    const bsTot = parseInt(row.bs_total)  || bsOn;
    const t0    = parseInt(row.today)     || 0;
    const gap   = parseFloat(row.gap_pct) || 0;

    totalPU      += pu;
    totalActive  += act;
    totalBSOnline += bsOn;
    totalBSTotal  += bsTot;
    totalT0Today  += t0;

    if (gap > maxGap) { maxGap = gap; maxGapPartner = row.partner; }
  });

  const activePct = totalPU     > 0 ? (totalActive   / totalPU)     * 100 : 0;
  const bsPct     = totalBSTotal > 0 ? (totalBSOnline / totalBSTotal) * 100 : 0;

  const animPU     = useCountUp(totalPU);
  const animActive = useCountUp(totalActive);
  const animBSOn   = useCountUp(totalBSOnline);

  const fmt = (n) => Number(n).toLocaleString('ru-RU');

  const activeColor = activePct >= 80 ? 'col-green' : activePct >= 60 ? 'col-yellow' : 'col-red';
  const bsColor     = bsPct     >= 85 ? 'col-green' : bsPct     >= 70 ? 'col-yellow' : 'col-red';

  const cards = [
    {
      label: 'Всего ПУ',
      value: fmt(animPU),
      sub:   `${partners.length} проектов`,
      cls:   'col-plain',
    },
    {
      label: 'Активных ПУ',
      value: fmt(animActive),
      sub:   `${activePct.toFixed(1)}% активных`,
      cls:   activeColor,
    },
    {
      label: 'ТО сегодня',
      value: fmt(totalT0Today),
      sub:   'сбор показаний',
      cls:   'col-yellow',
    },
    {
      label: 'БС всего',
      value: fmt(totalBSTotal),
      sub:   'базовых станций',
      cls:   'col-plain',
    },
    {
      label: 'БС онлайн',
      value: fmt(animBSOn),
      sub:   `${bsPct.toFixed(1)}% онлайн`,
      cls:   bsColor,
    },
    {
      label: 'Макс. разрыв',
      value: `${maxGap.toFixed(1)}%`,
      sub:   maxGapPartner,
      cls:   'col-red',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, idx) => (
        <div key={idx} className={`kpi-card fade-in-up delay-${(idx % 6) + 1}`}>
          <div className="label">{card.label}</div>
          <div className={`value ${card.cls}`}>{card.value}</div>
          {card.sub && <div className="sub">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export default MetricCards;
