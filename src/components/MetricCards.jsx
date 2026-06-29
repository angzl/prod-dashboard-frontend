import React from 'react';
import { FaMicrochip, FaServer, FaClock, FaShieldAlt } from 'react-icons/fa';
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

  // Данные для карточек
  const cards = [
    {
      label: 'Активных ПУ',
      value: fmt(animatedActive),
      sub: `${avgActivePct.toFixed(1)}% от общего числа`,
      icon: <FaMicrochip size={32} />,
      trend: '+12%',
    },
    {
      label: 'Всего ПУ',
      value: fmt(animatedTotalPU),
      sub: `${partners.length} проектов`,
      icon: <FaServer size={32} />,
    },
    {
      label: 'БС онлайн',
      value: fmt(animatedBSOnline),
      sub: `${fmt(totalBSTotal)} всего, ${avgBSPct.toFixed(1)}% доступности`,
      icon: <FaClock size={32} />,
    },
    {
      label: 'Статус системы',
      value: 'Стабильно',
      sub: 'Нет критических проблем',
      icon: <FaShieldAlt size={32} />,
      trend: '✅',
    },
  ];

  return (
    <div className="metric-grid">
      {cards.map((card, idx) => (
        <div key={idx} className={`metric-card fade-in-up delay-${idx + 1}`}>
          <div className="metric-icon">{card.icon}</div>
          <div className="metric-content">
            <div className="metric-label">{card.label}</div>
            <div className="metric-value">{card.value}</div>
            {card.sub && <div className="metric-sub">{card.sub}</div>}
            {card.trend && <div className="metric-trend">{card.trend}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MetricCards;