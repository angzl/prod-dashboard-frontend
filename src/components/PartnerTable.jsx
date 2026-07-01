import React, { useState, useEffect } from 'react';

function PartnerTable({ partners }) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!partners || partners.length === 0) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams();
    partners.forEach(p => params.append('partners', p));
    fetch(`${apiBase}/api/snapshot?${params.toString()}`)
      .then(res => { if (!res.ok) throw new Error('Ошибка загрузки'); return res.json(); })
      .then(d  => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [partners, apiBase]);

  if (loading) return <div className="state-msg">⏳ Загрузка таблицы...</div>;
  if (error)   return <div className="state-msg error">❌ {error}</div>;
  if (!data || data.length === 0) return <div className="state-msg">Нет данных</div>;

  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU'));
  const pillCls = (v, good, med) => v >= good ? 'pill-green' : v >= med ? 'pill-yellow' : 'pill-red';
  const barCls  = (v, good, med) => v >= good ? 'bar-green'  : v >= med ? 'bar-yellow'  : 'bar-red';

  const maxGap = data.reduce((a, r) => Math.max(a, parseFloat(r.gap_pct) || 0), 0);

  // sticky колонка «Проект»
  const stickyTh = {
    position: 'sticky', left: 0, zIndex: 20,
    background: 'var(--surface2)',
    boxShadow: '3px 0 6px rgba(0,0,0,0.3), inset -1px 0 0 var(--border)',
    whiteSpace: 'nowrap',
  };
  const stickyTd = (rowBg) => ({
    position: 'sticky', left: 0, zIndex: 10,
    background: rowBg,
    boxShadow: '3px 0 6px rgba(0,0,0,0.25), inset -1px 0 0 var(--border)',
    whiteSpace: 'nowrap',
  });

  const tdBase = {
    padding: '0 13px',
    height: 44,
    borderBottom: '1px solid var(--border)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };

  // Ячейка: число крупно + % мелко под ним
  const NumPctCell = ({ num, pct, good, med }) => {
    const pCls = pillCls(pct, good, med);
    const bCls = barCls(pct, good, med);
    return (
      <td style={tdBase}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
          {fmt(num)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${bCls}`} style={{ width: `${Math.min(pct, 100)}%`, height: 3 }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600,
            color: pCls === 'pill-green' ? '#4ade80' : pCls === 'pill-yellow' ? '#fcd34d' : '#f87171' }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </td>
    );
  };

  // Ячейка: только % с баром (разрыв)
  const BarCell = ({ pct, barW, good, med, invert }) => {
    const cls = invert
      ? (pct <= good ? 'pill-green' : pct <= med ? 'pill-yellow' : 'pill-red')
      : pillCls(pct, good, med);
    const bCls = invert
      ? (pct <= good ? 'bar-green' : pct <= med ? 'bar-yellow' : 'bar-red')
      : barCls(pct, good, med);
    return (
      <td style={tdBase}>
        <div className="bar-wrap">
          <div className="bar-bg" style={{ minWidth: 48 }}>
            <div className={`bar-fill ${bCls}`} style={{ width: `${barW}%` }} />
          </div>
          <span className={`pill ${cls}`} style={{ fontSize: 11 }}>{pct.toFixed(1)}%</span>
        </div>
      </td>
    );
  };

  // Ячейка: БС онлайн/всего объединённая
  const BsCell = ({ bsOn, bsTot, bsPct }) => {
    const pCls = pillCls(bsPct, 85, 70);
    const bCls = barCls(bsPct, 85, 70);
    const textColor = bsPct >= 85 ? '#4ade80' : bsPct >= 70 ? '#fcd34d' : '#f87171';
    return (
      <td style={tdBase}>
        {/* онлайн / всего */}
        <div style={{ fontSize: 13, fontWeight: 600, color: textColor, lineHeight: 1.2 }}>
          {fmt(bsOn)}
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>
            / {fmt(bsTot)}
          </span>
        </div>
        {/* мини-бар + % */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div className={`bar-fill ${bCls}`} style={{ width: `${Math.min(bsPct, 100)}%`, height: 3 }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: textColor }}>
            {bsPct.toFixed(1)}%
          </span>
        </div>
      </td>
    );
  };

  return (
    <div style={{
      overflowX: 'auto', overflowY: 'visible',
      borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)', margin: '0 24px 28px 24px',
      background: 'var(--surface)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            {/* Sticky заголовок Проект */}
            <th style={{
              ...stickyTh,
              padding: '10px 14px', textAlign: 'left',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              borderBottom: '1px solid var(--border)',
              minWidth: 140,
            }}>
              Проект
            </th>
            {[
              '% активных',
              'ТО сегодня', 'ТО вчера', 'ТО 3 дня',
              'Разрыв %',
              'БС',
            ].map(h => (
              <th key={h} style={{
                padding: '10px 13px', textAlign: 'left',
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                background: 'var(--surface2)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((r, i) => {
            const total     = parseInt(r.total_pu)  || 0;
            const active    = parseInt(r.pu_active) || 0;
            const activePct = total > 0 ? (active  / total) * 100 : 0;
            const t0Today   = parseInt(r.today)     || 0;
            const todayPct  = total > 0 ? (t0Today / total) * 100 : 0;
            const t0Prev    = parseInt(r.date_1)    || 0;
            const prevPct   = total > 0 ? (t0Prev  / total) * 100 : 0;
            const t0Three   = parseInt(r.date_3)    || 0;
            const threePct  = total > 0 ? (t0Three / total) * 100 : 0;
            const gap       = parseFloat(r.gap_pct) || 0;
            const bsOn      = parseInt(r.bs_online) || 0;
            const bsTot     = parseInt(r.bs_total)  || bsOn;
            const bsPct     = bsTot > 0 ? (bsOn / bsTot) * 100 : 0;

            const rowBg     = i % 2 === 1 ? 'rgba(255,255,255,0.013)' : 'var(--surface)';
            const barGapPct = Math.min((gap / (maxGap || 1)) * 100, 100);

            return (
              <tr
                key={r.partner}
                style={{ background: rowBg, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = rowBg}
              >
                {/* Проект sticky — chip + Всего/активных под ним */}
                <td style={{ ...stickyTd(rowBg), ...tdBase, minWidth: 140 }}>
                  <span className="proj-chip" style={{ fontSize: 12 }}>{r.partner}</span>
                  <div style={{
                    fontSize: 10, color: 'var(--text-muted)',
                    marginTop: 3, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmt(active)}
                    <span style={{ opacity: 0.6 }}> / {fmt(total)}</span>
                  </div>
                </td>

                {/* % активных — только бар+% */}
                <BarCell pct={activePct} barW={Math.min(activePct, 100)} good={80} med={60} />

                {/* ТО сегодня: число + мини-бар+% */}
                <NumPctCell num={t0Today} pct={todayPct} good={75} med={50} />

                {/* ТО вчера */}
                <NumPctCell num={t0Prev} pct={prevPct} good={75} med={50} />

                {/* ТО 3 дня */}
                <NumPctCell num={t0Three} pct={threePct} good={80} med={60} />

                {/* Разрыв % */}
                <BarCell pct={gap} barW={barGapPct} good={5} med={15} invert />

                {/* БС: онлайн/всего + % */}
                <BsCell bsOn={bsOn} bsTot={bsTot} bsPct={bsPct} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PartnerTable;
