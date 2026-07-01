import React from 'react';

// Вспомогательная функция: цвет по порогу
function colorClass(value, good, medium) {
  if (value >= good)   return { cls: 'col-green',  accent: 'accent-green',  bar: 'bar-green' };
  if (value >= medium) return { cls: 'col-yellow', accent: 'accent-yellow', bar: 'bar-yellow' };
  return                      { cls: 'col-red',    accent: 'accent-red',    bar: 'bar-red' };
}

function ProjectMetricCards({ projectData, partner }) {
  if (!projectData) {
    return <div className="state-msg">⚠️ Нет данных для проекта <strong>{partner}</strong></div>;
  }

  const total    = parseInt(projectData.total_pu)  || 0;
  const active   = parseInt(projectData.pu_active) || 0;
  const t0Today  = parseInt(projectData.today)     || 0;
  const t0Prev   = parseInt(projectData.date_1)    || 0;
  const t0Three  = parseInt(projectData.date_3)    || 0;
  const bsOn     = parseInt(projectData.bs_online) || 0;
  const bsTotal  = parseInt(projectData.bs_total)  || bsOn;
  const gap      = parseFloat(projectData.gap_pct) || 0;

  const activePct   = total   > 0 ? (active  / total)   * 100 : 0;
  const t0TodayPct  = total   > 0 ? (t0Today / total)   * 100 : 0;
  const t0ThreePct  = total   > 0 ? (t0Three / total)   * 100 : 0;
  const bsPct       = bsTotal > 0 ? (bsOn    / bsTotal) * 100 : 0;

  const fmt = (n) => Number(n).toLocaleString('ru-RU');

  const activeC  = colorClass(activePct,  80, 60);
  const t0TodayC = colorClass(t0TodayPct, 75, 50);
  const t0ThreeC = colorClass(t0ThreePct, 80, 60);
  const bsC      = colorClass(bsPct,      85, 70);
  // gap: меньше — лучше, инверт
  const gapC = gap <= 5
    ? { cls: 'col-green',  accent: 'accent-green',  bar: 'bar-green' }
    : gap <= 15
    ? { cls: 'col-yellow', accent: 'accent-yellow', bar: 'bar-yellow' }
    : { cls: 'col-red',    accent: 'accent-red',    bar: 'bar-red' };

  const cards = [
    {
      label:  'Всего ПУ',
      value:  fmt(total),
      sub:    `${fmt(active)} активных`,
      accent: 'accent-purple',
      bar:    'bar-purple',
      pct:    activePct,
      cls:    'col-purple',
    },
    {
      label:  'Активных ПУ',
      value:  fmt(active),
      sub:    `${activePct.toFixed(1)}% от общего`,
      accent: activeC.accent,
      bar:    activeC.bar,
      pct:    activePct,
      cls:    activeC.cls,
    },
    {
      label:  'ТО сегодня',
      value:  fmt(t0Today),
      sub:    `${t0TodayPct.toFixed(1)}% охват`,
      accent: t0TodayC.accent,
      bar:    t0TodayC.bar,
      pct:    t0TodayPct,
      cls:    t0TodayC.cls,
    },
    {
      label:  'ТО за 3 дня',
      value:  fmt(t0Three),
      sub:    `${t0ThreePct.toFixed(1)}% охват`,
      accent: t0ThreeC.accent,
      bar:    t0ThreeC.bar,
      pct:    t0ThreePct,
      cls:    t0ThreeC.cls,
    },
    {
      label:  'БС онлайн',
      value:  `${fmt(bsOn)} / ${fmt(bsTotal)}`,
      sub:    `${bsPct.toFixed(1)}% доступности`,
      accent: bsC.accent,
      bar:    bsC.bar,
      pct:    bsPct,
      cls:    bsC.cls,
    },
    {
      label:  'Разрыв акт→ТО-3',
      value:  `${gap.toFixed(1)}%`,
      sub:    gap <= 5 ? 'В норме' : gap <= 15 ? 'Повышенный' : 'Критичный',
      accent: gapC.accent,
      bar:    gapC.bar,
      // для разрыва бар инвертирован: чем меньше — тем лучше (полнее)
      pct:    Math.max(0, 100 - Math.min(gap * 3, 100)),
      cls:    gapC.cls,
    },
  ];

  return (
    <div className="proj-kpi-grid">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`proj-kpi-card ${card.accent} fade-in-up delay-${(idx % 6) + 1}`}
        >
          <div className="pk-label">{card.label}</div>
          <div className={`pk-value ${card.cls}`}>{card.value}</div>
          <div className="pk-sub">{card.sub}</div>
          <div className="pk-bar">
            <div
              className={`pk-bar-fill ${card.bar}`}
              style={{ width: `${Math.min(card.pct, 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProjectMetricCards;
