import React, { useMemo, useState } from 'react';
import { useDataStore } from '../context/DataContext';

/* ── История по всем инсталяциям (вкладка «Сводка», под блоком инсталяций).
 * Строки — инсталяции, колонки — последние N дней (последний срез дня).
 * В ячейке: активные ПУ (крупно) и «Разрыв» с цветом (мелко).
 * Данные — из серверного кеша истории (getHistory), как у прод-проектов.
 */

const DAY_OPTS = [7, 14, 30];
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU'));

export default function InstallationsHistoryTable() {
  const { installations, getHistory } = useDataStore();
  const [days, setDays] = useState(14);

  const instList = useMemo(
    () => (installations || []).filter(i => i.category !== 'prod' && i.monitor !== false),
    [installations],
  );

  // Колонки: последние `days` дат (включая сегодня)
  const dates = useMemo(() => {
    const arr = [];
    const now = new Date();
    for (let k = days - 1; k >= 0; k--) {
      const d = new Date(now);
      d.setDate(now.getDate() - k);
      arr.push(d);
    }
    return arr;
  }, [days]);

  const rows = useMemo(() => instList.map(i => {
    const hist = getHistory(i.name, days) || [];
    // последний срез каждого дня
    const byDay = {};
    hist.forEach(r => {
      const key = String(r.snap_datetime || '').slice(0, 10);
      if (!byDay[key] || String(byDay[key].snap_datetime) < String(r.snap_datetime)) {
        byDay[key] = r;
      }
    });
    return { name: i.name, byDay };
  }), [instList, days, getHistory]);

  if (instList.length === 0) return null;

  const td = {
    padding: '8px 10px', borderBottom: '1px solid var(--border)',
    fontSize: 12, whiteSpace: 'nowrap', verticalAlign: 'middle',
    fontVariantNumeric: 'tabular-nums', textAlign: 'center',
  };

  const hasAnyHistory = rows.some(r => Object.keys(r.byDay).length > 0);

  return (
    <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>📊 История по инсталяциям</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {DAY_OPTS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: days === d ? 'rgba(251,191,36,0.2)' : 'var(--surface2)',
                border: `1px solid ${days === d ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`,
                color: days === d ? '#fcd34d' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >{d}д</button>
          ))}
        </div>
      </div>


      {!hasAnyHistory ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Истории по инсталяциям ещё нет — она накапливается срезами раз в 3 часа.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{
                  ...td, position: 'sticky', left: 0, textAlign: 'left', zIndex: 20,
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  background: 'var(--surface2)', minWidth: 140,
                  boxShadow: '3px 0 6px rgba(0,0,0,0.3)',
                }}>Инсталяция</th>
                {dates.map(d => (
                  <th key={d.getTime()} style={{
                    ...td, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    background: 'var(--surface2)', minWidth: 78,
                  }}>
                    {d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name}>
                  <td style={{
                    ...td, position: 'sticky', left: 0, textAlign: 'left', zIndex: 10,
                    background: 'var(--surface)', minWidth: 140,
                    boxShadow: '3px 0 6px rgba(0,0,0,0.25)',
                  }}>
                    <span className="proj-chip" style={{ fontSize: 12 }}>🏠 {r.name}</span>
                  </td>
                  {dates.map(d => {
                    const key = d.toISOString().slice(0, 10);
                    const s = r.byDay[key];
                    if (!s) {
                      return <td key={key} style={{ ...td, color: 'var(--border)' }}>—</td>;
                    }
                    const active = parseInt(s.pu_active ?? s.active_pu) || 0;
                    const gap = parseFloat(s.gap_pct) || 0;
                    const gColor = gap <= 5 ? '#4ade80' : gap <= 15 ? '#fcd34d' : '#f87171';
                    return (
                      <td key={key} style={td}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                          {fmt(active)}
                        </div>
                        <div style={{ fontSize: 10, color: gColor, marginTop: 2 }}>
                          {gap.toFixed(1)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
