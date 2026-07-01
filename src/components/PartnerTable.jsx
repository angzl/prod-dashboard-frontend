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

  const numCls = (v, good, med) =>
    v >= good ? 'c-green' : v >= med ? 'c-yellow' : 'c-red';

  const barCls = (v, good, med) =>
    v >= good ? 'bar-green' : v >= med ? 'bar-yellow' : 'bar-red';

  const maxGap = data.reduce((a, r) => Math.max(a, parseFloat(r.gap_pct) || 0), 0);

  /* ── Стили для sticky колонки «Проект» ── */
  const stickyTh = {
    position:   'sticky',
    left:       0,
    zIndex:     20,
    background: 'var(--surface2)',
    // box-shadow вместо border — не даёт просветов при прокрутке
    boxShadow:  '2px 0 0 0 var(--border)',
    whiteSpace: 'nowrap',
  };
  const stickyTd = {
    position:   'sticky',
    left:       0,
    zIndex:     10,
    background: 'var(--surface)',
    boxShadow:  '2px 0 0 0 var(--border)',
    whiteSpace: 'nowrap',
  };

  return (
    /*
      Обёртка: overflow-x:auto для горизонтального скролла.
      НЕ overflow:hidden — иначе sticky не работает.
    */
    <div style={{
      overflowX:    'auto',
      overflowY:    'visible',
      borderRadius: 'var(--radius)',
      border:       '1px solid var(--border)',
      boxShadow:    'var(--shadow)',
      margin:       '0 24px 28px 24px',
      background:   'var(--surface)',
    }}>
      <table style={{
        width:          '100%',
        borderCollapse: 'collapse',
        fontSize:       13,
      }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            {/* Закреплённый заголовок «Проект» */}
            <th style={{ ...stickyTh, padding: '10px 13px', textAlign: 'left',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              borderBottom: '1px solid var(--border)' }}>
              Проект
            </th>
            {[
              'Всего ПУ','Активных ПУ','% активных',
              'ТО сегодня','% ТО сег.',
              'ТО вчера','% ТО вч.',
              'ТО 3 дня','% ТО 3д.',
              'Разрыв %',
              'БС всего','БС онлайн','% БС',
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
            const total      = parseInt(r.total_pu)  || 0;
            const active     = parseInt(r.pu_active) || 0;
            const activePct  = total > 0 ? (active / total) * 100 : 0;
            const t0Today    = parseInt(r.today)     || 0;
            const todayPct   = total > 0 ? (t0Today / total) * 100 : 0;
            const t0Prev     = parseInt(r.date_1)    || 0;
            const prevPct    = total > 0 ? (t0Prev  / total) * 100 : 0;
            const t0Three    = parseInt(r.date_3)    || 0;
            const threePct   = total > 0 ? (t0Three / total) * 100 : 0;
            const gap        = parseFloat(r.gap_pct) || 0;
            const bsOn       = parseInt(r.bs_online) || 0;
            const bsTot      = parseInt(r.bs_total)  || bsOn;
            const bsPct      = bsTot > 0 ? (bsOn / bsTot) * 100 : 0;

            const rowBg = i % 2 === 1
              ? 'rgba(255,255,255,0.012)'
              : 'var(--surface)';

            const td = (content, extraStyle = {}) => (
              <td style={{
                padding: '8px 13px',
                borderBottom: '1px solid var(--border)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                ...extraStyle,
              }}>
                {content}
              </td>
            );

            /* Ячейка: крупное число + маленький % под ним */
            const numPct = (num, pct, good, med) => (
              <td style={{
                padding: '5px 13px',
                borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text)',
                }}>
                  {fmt(num)}
                </div>
                <div style={{ marginTop: 2 }}>
                  <span className={`pill ${pillCls(pct, good, med)}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </td>
            );

            /* Ячейка: прогресс-бар + % */
            const barPct = (pct, good, med, isGap = false) => {
              const barW  = isGap
                ? Math.min((gap / (maxGap || 1)) * 100, 100)
                : Math.min(pct, 100);
              const bCls  = isGap
                ? (gap > 30 ? 'bar-red' : gap > 15 ? 'bar-yellow' : 'bar-green')
                : barCls(pct, good, med);
              const pCls  = isGap
                ? (gap > 30 ? 'pill-red' : gap > 15 ? 'pill-yellow' : 'pill-green')
                : pillCls(pct, good, med);
              return (
                <td style={{
                  padding: '8px 13px',
                  borderBottom: '1px solid var(--border)',
                  minWidth: 110,
                }}>
                  <div className="bar-wrap">
                    <div className="bar-bg" style={{ minWidth: 50 }}>
                      <div className={`bar-fill ${bCls}`} style={{ width: `${barW}%` }} />
                    </div>
                    <span className={`pill ${pCls}`} style={{ fontSize: 11 }}>
                      {isGap ? gap.toFixed(1) : pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              );
            };

            return (
              <tr
                key={r.partner}
                style={{ background: rowBg, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = rowBg}
              >
                {/* ── Закреплённая ячейка «Проект» ── */}
                <td style={{ ...stickyTd, background: rowBg,
                  padding: '8px 13px',
                  borderBottom: '1px solid var(--border)',
                  fontWeight: 600,
                }}>
                  <span className="proj-chip" style={{ fontSize: 12 }}>{r.partner}</span>
                </td>

                {/* Всего ПУ */}
                {td(fmt(total), { color: 'var(--text-muted)', fontSize: 13 })}

                {/* Активных + % */}
                {numPct(active, activePct, 80, 60)}

                {/* % активных — прогресс-бар */}
                {barPct(activePct, 80, 60)}

                {/* ТО сегодня + % */}
                {numPct(t0Today, todayPct, 75, 50)}

                {/* % ТО сег. — бар */}
                {barPct(todayPct, 75, 50)}

                {/* ТО вчера + % */}
                {numPct(t0Prev, prevPct, 75, 50)}

                {/* % ТО вч. — бар */}
                {barPct(prevPct, 75, 50)}

                {/* ТО 3 дня + % */}
                {numPct(t0Three, threePct, 80, 60)}

                {/* % ТО 3д. — бар */}
                {barPct(threePct, 80, 60)}

                {/* Разрыв % — бар (инверт) */}
                {barPct(gap, 0, 0, true)}

                {/* БС всего */}
                {td(fmt(bsTot), { color: 'var(--text-muted)', fontSize: 13 })}

                {/* БС онлайн */}
                {td(fmt(bsOn), {
                  color: bsPct >= 85 ? '#86efac' : bsPct >= 70 ? '#fde047' : '#fca5a5',
                  background: bsPct >= 85
                    ? 'rgba(22,163,74,0.15)'
                    : bsPct >= 70
                    ? 'rgba(202,138,4,0.15)'
                    : 'rgba(220,38,38,0.15)',
                  fontWeight: 600,
                  fontSize: 13,
                })}

                {/* % БС */}
                {td(
                  <span className={`pill ${pillCls(bsPct, 85, 70)}`}>
                    {bsPct.toFixed(1)}%
                  </span>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PartnerTable;
