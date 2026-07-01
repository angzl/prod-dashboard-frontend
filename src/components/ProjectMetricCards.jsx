import React from 'react';

function colorTheme(value, good, medium) {
  if (value >= good)   return { cls: 'col-green',  accent: 'accent-green',  bar: 'bar-green',  hex: '#4ade80' };
  if (value >= medium) return { cls: 'col-yellow', accent: 'accent-yellow', bar: 'bar-yellow', hex: '#fcd34d' };
  return                      { cls: 'col-red',    accent: 'accent-red',    bar: 'bar-red',    hex: '#f87171' };
}

// Мини-спарклайн из 5 значений — просто точки с линиями через SVG
function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const w = 64, h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: 0.7 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        i === pts.length - 1
          ? <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
          : null
      ))}
    </svg>
  );
}

function ProjectMetricCards({ projectData, partner }) {
  if (!projectData) {
    return <div className="state-msg">⚠️ Нет данных для проекта <strong>{partner}</strong></div>;
  }

  const total   = parseInt(projectData.total_pu)  || 0;
  const active  = parseInt(projectData.pu_active) || 0;
  const t0Today = parseInt(projectData.today)     || 0;
  const t0Prev  = parseInt(projectData.date_1)    || 0;
  const t0Three = parseInt(projectData.date_3)    || 0;
  const bsOn    = parseInt(projectData.bs_online) || 0;
  const bsTotal = parseInt(projectData.bs_total)  || bsOn;
  const gap     = parseFloat(projectData.gap_pct) || 0;

  const activePct  = total   > 0 ? (active  / total)   * 100 : 0;
  const todayPct   = total   > 0 ? (t0Today / total)   * 100 : 0;
  const prevPct    = total   > 0 ? (t0Prev  / total)   * 100 : 0;
  const threePct   = total   > 0 ? (t0Three / total)   * 100 : 0;
  const bsPct      = bsTotal > 0 ? (bsOn    / bsTotal) * 100 : 0;

  const fmt = (n) => Number(n).toLocaleString('ru-RU');

  const activeT  = colorTheme(activePct,  80, 60);
  const todayT   = colorTheme(todayPct,   75, 50);
  const prevT    = colorTheme(prevPct,    75, 50);
  const threeT   = colorTheme(threePct,   80, 60);
  const bsT      = colorTheme(bsPct,      85, 70);
  const gapT     = gap <= 5
    ? { cls: 'col-green',  accent: 'accent-green',  bar: 'bar-green',  hex: '#4ade80' }
    : gap <= 15
    ? { cls: 'col-yellow', accent: 'accent-yellow', bar: 'bar-yellow', hex: '#fcd34d' }
    : { cls: 'col-red',    accent: 'accent-red',    bar: 'bar-red',    hex: '#f87171' };

  // Карточка 1: Всего / Активных — крупная, объединённая
  // Карточки 2-5: ТО по дням
  // Карточка 6: БС объединённая
  // Карточка 7: Разрыв

  const cards = [
    // ── ПУ объединённая ──────────────────────────────────────────
    {
      label:   'Приборы учёта',
      accent:  'accent-purple',
      wide:    true,
      content: (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Всего */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Всего
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(total)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 4px' }} />
          {/* Активных */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Активных
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: activeT.hex, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(active)}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>от общего числа</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: activeT.hex }}>{activePct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div className={`bar-fill ${activeT.bar}`} style={{ width: `${Math.min(activePct, 100)}%`, height: 5 }} />
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ── ТО сегодня ───────────────────────────────────────────────
    {
      label:   'ТО сегодня',
      accent:  todayT.accent,
      content: (
        <>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
            {fmt(t0Today)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>охват</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: todayT.hex }}>{todayPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${todayT.bar}`} style={{ width: `${Math.min(todayPct, 100)}%`, height: 4 }} />
          </div>
        </>
      ),
    },

    // ── ТО вчера ─────────────────────────────────────────────────
    {
      label:   'ТО вчера',
      accent:  prevT.accent,
      content: (
        <>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
            {fmt(t0Prev)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>охват</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: prevT.hex }}>{prevPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${prevT.bar}`} style={{ width: `${Math.min(prevPct, 100)}%`, height: 4 }} />
          </div>
        </>
      ),
    },

    // ── ТО 3 дня ─────────────────────────────────────────────────
    {
      label:   'ТО за 3 дня',
      accent:  threeT.accent,
      content: (
        <>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
            {fmt(t0Three)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>охват</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: threeT.hex }}>{threePct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${threeT.bar}`} style={{ width: `${Math.min(threePct, 100)}%`, height: 4 }} />
          </div>
        </>
      ),
    },

    // ── БС объединённая ──────────────────────────────────────────
    {
      label:   'Базовые станции',
      accent:  bsT.accent,
      content: (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Онлайн */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Онлайн</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: bsT.hex, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(bsOn)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
          {/* Всего */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Всего</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(bsTotal)}
            </div>
          </div>
          {/* % + бар на всю ширину снизу */}
        </div>
      ),
      footer: (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>доступность</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: bsT.hex }}>{bsPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${bsT.bar}`} style={{ width: `${Math.min(bsPct, 100)}%`, height: 4 }} />
          </div>
        </div>
      ),
    },

    // ── Разрыв ───────────────────────────────────────────────────
    {
      label:   'Разрыв акт→ТО-3',
      accent:  gapT.accent,
      content: (
        <>
          <div style={{ fontSize: 32, fontWeight: 700, color: gapT.hex, lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
            {gap.toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {gap <= 5 ? '✅ В норме' : gap <= 15 ? '⚠️ Повышенный' : '🔴 Критичный'}
          </div>
          {/* Визуализация: чем меньше — тем лучше */}
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${gapT.bar}`}
              style={{ width: `${Math.min(gap * 3, 100)}%`, height: 4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0%</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>33%+</span>
          </div>
        </>
      ),
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 12,
    }}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`proj-kpi-card ${card.accent} fade-in-up delay-${(idx % 6) + 1}`}
          style={card.wide ? { gridColumn: 'span 2' } : {}}
        >
          <div className="pk-label">{card.label}</div>
          <div style={{ marginTop: 8 }}>
            {card.content}
          </div>
          {card.footer && card.footer}
        </div>
      ))}
    </div>
  );
}

export default ProjectMetricCards;
