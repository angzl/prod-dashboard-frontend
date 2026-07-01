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

  const pillCls = (v, good, med) =>
    v >= good ? 'pill-green' : v >= med ? 'pill-yellow' : 'pill-red';

  const cellCls = (v, good, med) =>
    v >= good ? 'c-green' : v >= med ? 'c-yellow' : 'c-red';

  const barCls = (v, good, med) =>
    v >= good ? 'bar-green' : v >= med ? 'bar-yellow' : 'bar-red';

  const maxGap = data.reduce((a, r) => Math.max(a, parseFloat(r.gap_pct) || 0), 0);

  /* sticky-колонка «Проект» */
  const stickyTh = {
    position: 'sticky', left: 0, zIndex: 20,
    background: 'var(--surface2)',
    boxShadow: '2px 0 0 0 var(--border)',
    whiteSpace: 'nowrap',
  };
  const stickyTd = (rowBg) => ({
    position: 'sticky', left: 0, zIndex: 10,
    background: rowBg,
    boxShadow: '2px 0 0 0 var(--border)',
    whiteSpace: 'nowrap',
  });

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
            <th style={{
              ...stickyTh, padding: '10px 13px', textAlign: 'left',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              borderBottom: '1px solid var(--border)',
            }}>
              Проект
            </th>
            {[
              'Всего ПУ', 'Активных ПУ', '% активных',
              'ТО сегодня', '% ТО сег.',
              'ТО вчера',  '% ТО вч.',
              'ТО 3 дня',  '% ТО 3д.',
              'Разрыв %',
              'БС всего',  'БС онлайн', '% БС',
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

            const rowBg     = i % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'var(--surface)';
            const barGapPct = Math.min((gap / (maxGap || 1)) * 100, 100);
            const gapBarCls = gap > 30 ? 'bar-red' : gap > 15 ? 'bar-yellow' : 'bar-green';
            const gapPilCls = gap > 30 ? 'pill-red' : gap > 15 ? 'pill-yellow' : 'pill-green';

            const tdStyle = {
              padding: '8px 13px',
              borderBottom: '1px solid var(--border)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            };

            return (
              <tr
                key={r.partner}
                style={{ background: rowBg, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = rowBg}
              >
                {/* Проект — sticky */}
                <td style={{ ...stickyTd(rowBg), ...tdStyle, fontWeight: 600 }}>
                  <span className="proj-chip">{r.partner}</span>
                </td>

                {/* Всего ПУ */}
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{fmt(total)}</td>

                {/* Активных ПУ */}
                <td className={cellCls(activePct, 80, 60)} style={tdStyle}>{fmt(active)}</td>

                {/* % активных — бар */}
                <td style={tdStyle}>
                  <div className="bar-wrap">
                    <div className="bar-bg">
                      <div className={`bar-fill ${barCls(activePct, 80, 60)}`}
                           style={{ width: `${Math.min(activePct, 100)}%` }} />
                    </div>
                    <span className={`pill ${pillCls(activePct, 80, 60)}`}>
                      {activePct.toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* ТО сегодня */}
                <td className={cellCls(todayPct, 75, 50)} style={tdStyle}>{fmt(t0Today)}</td>
                <td style={tdStyle}>
                  <span className={`pill ${pillCls(todayPct, 75, 50)}`}>{todayPct.toFixed(1)}%</span>
                </td>

                {/* ТО вчера */}
                <td className={cellCls(prevPct, 75, 50)} style={tdStyle}>{fmt(t0Prev)}</td>
                <td style={tdStyle}>
                  <span className={`pill ${pillCls(prevPct, 75, 50)}`}>{prevPct.toFixed(1)}%</span>
                </td>

                {/* ТО 3 дня */}
                <td className={cellCls(threePct, 80, 60)} style={tdStyle}>{fmt(t0Three)}</td>
                <td style={tdStyle}>
                  <span className={`pill ${pillCls(threePct, 80, 60)}`}>{threePct.toFixed(1)}%</span>
                </td>

                {/* Разрыв % — бар */}
                <td style={tdStyle}>
                  <div className="bar-wrap">
                    <div className="bar-bg">
                      <div className={`bar-fill ${gapBarCls}`} style={{ width: `${barGapPct}%` }} />
                    </div>
                    <span className={`pill ${gapPilCls}`}>{gap.toFixed(1)}%</span>
                  </div>
                </td>

                {/* БС всего */}
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{fmt(bsTot)}</td>

                {/* БС онлайн */}
                <td className={cellCls(bsPct, 85, 70)} style={tdStyle}>{fmt(bsOn)}</td>

                {/* % БС */}
                <td style={tdStyle}>
                  <span className={`pill ${pillCls(bsPct, 85, 70)}`}>{bsPct.toFixed(1)}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PartnerTable;
