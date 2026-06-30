import React from 'react';
import { FaMicrochip, FaServer, FaClock, FaShieldAlt } from 'react-icons/fa';

function ProjectMetricCards({ projectData, partner }) {
  if (!projectData) {
    return <div style={{ color: '#6a7f9f' }}>Нет данных</div>;
  }

  const total = parseInt(projectData.total_pu) || 0;
  const active = parseInt(projectData.pu_active) || 0;
  const activePct = total > 0 ? (active / total) * 100 : 0;
  const t0Today = parseInt(projectData.today) || 0;
  const t0Pct = total > 0 ? (t0Today / total) * 100 : 0;
  const bsOn = parseInt(projectData.bs_online) || 0;
  const bsTotal = parseInt(projectData.bs_total) || bsOn;
  const bsPct = bsTotal > 0 ? (bsOn / bsTotal) * 100 : 0;
  const gap = parseFloat(projectData.gap_pct) || 0;

  const fmt = (num) => Number(num).toLocaleString('ru-RU');

  const cards = [
    {
      label: 'Активных ПУ',
      value: fmt(active),
      sub: `${activePct.toFixed(1)}% от общего числа`,
      icon: <FaMicrochip size={28} />,
    },
    {
      label: 'Всего ПУ',
      value: fmt(total),
      sub: `${fmt(active)} активных`,
      icon: <FaServer size={28} />,
    },
    {
      label: 'БС онлайн',
      value: `${fmt(bsOn)} / ${fmt(bsTotal)}`,
      sub: `${bsPct.toFixed(1)}% доступности`,
      icon: <FaClock size={28} />,
    },
    {
      label: 'Сбор Т0 сегодня',
      value: fmt(t0Today),
      sub: `${t0Pct.toFixed(1)}% от общего числа`,
      icon: <FaShieldAlt size={28} />,
    },
  ];

  return (
    <div className="metric-grid" style={{ marginBottom: '0px' }}>
      {cards.map((card, idx) => (
        <div key={idx} className="metric-card fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
          <div className="metric-icon">{card.icon}</div>
          <div className="metric-content">
            <div className="metric-label">{card.label}</div>
            <div className="metric-value">{card.value}</div>
            <div className="metric-sub">{card.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProjectMetricCards;