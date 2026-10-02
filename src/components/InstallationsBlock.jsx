import React, { useMemo } from 'react';
import { useDataStore } from '../context/DataContext';
import { fmtSnapDt } from '../utils/datetime';

/* ── Блок «Инсталяции» на дашборде (вкладка «Сводка») ──────────
 * Инсталяции — такие же проекты общего списка, как овнеры прода:
 * срез пишется фоном (раз в 3 часа) одной строкой на инсталяцию.
 * Здесь они выделены в отдельный блок; клик по строке фокусирует
 * дашборд на инсталяции (переключатель контекста в шапке).
 */

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU'));

function MetricPill({ num, den, good, med }) {
  const pct = den > 0 ? (num / den) * 100 : 0;
  const cls = pct >= good ? 'pill-green' : pct >= med ? 'pill-yellow' : 'pill-red';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(num)}</b>
      <span className={`pill ${cls}`} style={{ fontSize: 10 }}>{pct.toFixed(1)}%</span>
    </span>
  );
}

export default function InstallationsBlock() {
  const { allSnapshot, installations, prodName, setInstallation } = useDataStore();

  const instList = useMemo(
    () => (installations || []).filter(i => i.category !== 'prod' && i.monitor !== false),
    [installations],
  );

  const rows = useMemo(() => {
    if (!allSnapshot || !prodName) return [];
    return allSnapshot
      .filter(r => r.installation && r.installation !== prodName)
      .map(r => ({
        name: r.installation,
        total: parseInt(r.total_pu) || 0,
        active: parseInt(r.pu_active) || 0,
        t0Three: parseInt(r.date_3) || 0,
        gap: parseFloat(r.gap_pct) || 0,
        bsOn: parseInt(r.bs_online) || 0,
        bsTot: parseInt(r.bs_total) || 0,
        snap: fmtSnapDt(r.snap_datetime),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [allSnapshot, prodName]);

  // Инсталяции без среза ещё (только что добавили — данных нет)
  const noData = instList.filter(i => !rows.some(r => r.name === i.name));

  if (instList.length === 0) return null;

  const td = {
    padding: '9px 13px', borderBottom: '1px solid var(--border)',
    fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🏠 Инсталяции</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          background: 'rgba(251,191,36,0.12)', color: '#fcd34d',
          border: '1px solid rgba(251,191,36,0.35)', textTransform: 'uppercase',
        }}>
          {rows.length + noData.length} шт
        </span>
      </div>

      {rows.length === 0 && noData.length > 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Срезы инсталяций ещё не сняты — данные появятся после первого фонового цикла
          (раз в 3 часа) или после перезапуска бота.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {[
                  ['Инсталяция', 'left'], ['Всего ПУ', 'left'], ['Активных', 'left'],
                  ['ТО 3 дня', 'left'], ['Разрыв', 'center'], ['БС', 'left'], ['Срез БД', 'left'],
                ].map(([label, align]) => (
                  <th key={label} style={{
                    ...td, textAlign: align, fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.5px', background: 'var(--surface2)',
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const gapCls = r.gap <= 5 ? 'pill-green' : r.gap <= 15 ? 'pill-yellow' : 'pill-red';
                const bsPct = r.bsTot > 0 ? (r.bsOn / r.bsTot) * 100 : 0;
                return (
                  <tr
                    key={r.name}
                    onClick={() => setInstallation(r.name)}
                    title="Клик — переключить дашборд на эту инсталяцию"
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={td}>
                      <span className="proj-chip" style={{ fontSize: 12 }}>🏠 {r.name}</span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{fmt(r.total)}</td>
                    <td style={td}>
                      <MetricPill num={r.active} den={r.total} good={80} med={60} />
                    </td>
                    <td style={td}>
                      <MetricPill num={r.t0Three} den={r.total} good={80} med={60} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span className={`pill ${gapCls}`} style={{ fontSize: 11 }}>{r.gap.toFixed(1)}%</span>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <b style={{ color: 'var(--text)' }}>{fmt(r.bsOn)}</b>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>/ {fmt(r.bsTot)}</span>
                        <span style={{
                          fontSize: 10,
                          color: bsPct >= 85 ? '#4ade80' : bsPct >= 70 ? '#fcd34d' : '#f87171',
                        }}>{bsPct.toFixed(1)}%</span>
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: 11 }}>{r.snap || '—'}</td>
                  </tr>
                );
              })}
              {noData.map(i => (
                <tr key={i.name} style={{ opacity: 0.55 }}>
                  <td style={td}><span className="proj-chip" style={{ fontSize: 12 }}>🏠 {i.name}</span></td>
                  <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={6}>
                    нет данных — срез ещё не снят
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
