import React, { useState, useMemo } from 'react';
import { useDataStore } from '../context/DataContext';

/* ── Утилиты ──────────────────────────────────────────────── */
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU'));
const pillCls = (v, good, med) => (v >= good ? 'pill-green' : v >= med ? 'pill-yellow' : 'pill-red');
const barCls  = (v, good, med) => (v >= good ? 'bar-green'  : v >= med ? 'bar-yellow'  : 'bar-red');

/* ── Ячейки вынесены из тела компонента ─────────────────────
   Раньше NumPctCell / BsCell объявлялись ВНУТРИ PartnerTable,
   из-за чего каждый рендер создавал новые типы компонентов.
   React при этом размонтировал/монтировал все ячейки заново —
   тяжелый table полностью пересобирался при любом апдейте.
   Теперь это стабильные компоненты с memo. */
const thStyle = {
  padding: '10px 13px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  background: 'var(--surface2)',
};

const stickyTh = {
  position: 'sticky', left: 0, zIndex: 20,
  background: 'var(--surface2)',
  boxShadow: '3px 0 6px rgba(0,0,0,0.3), inset -1px 0 0 var(--border)',
  whiteSpace: 'nowrap',
};

const tdBase = {
  padding: '0 13px',
  height: 44,
  borderBottom: '1px solid var(--border)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

const stickyTd = (rowBg) => ({
  position: 'sticky', left: 0, zIndex: 10,
  background: rowBg,
  boxShadow: '3px 0 6px rgba(0,0,0,0.25), inset -1px 0 0 var(--border)',
  whiteSpace: 'nowrap',
});

const NumPctCell = React.memo(function NumPctCell({ num, pct, good, med }) {
  const bCls = barCls(pct, good, med);
  const textColor = pct >= good ? '#4ade80' : pct >= med ? '#fcd34d' : '#f87171';
  return (
    <td style={tdBase}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
        {fmt(num)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
        <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div className={`bar-fill ${bCls}`} style={{ width: `${Math.min(pct, 100)}%`, height: 3 }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: textColor }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </td>
  );
});

const BsCell = React.memo(function BsCell({ bsOn, bsTot, bsPct }) {
  const bCls = barCls(bsPct, 85, 70);
  const textColor = bsPct >= 85 ? '#4ade80' : bsPct >= 70 ? '#fcd34d' : '#f87171';
  return (
    <td style={tdBase}>
      <div style={{ fontSize: 13, fontWeight: 600, color: textColor, lineHeight: 1.2 }}>
        {fmt(bsOn)}
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>
          / {fmt(bsTot)}
        </span>
      </div>
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
});

/* ── Строка таблицы (мемоизирована) ───────────────────────── */
const TableRow = React.memo(function TableRow({ row, rowBg }) {
  const total     = parseInt(row.total_pu)  || 0;
  const active    = parseInt(row.pu_active) || 0;
  const activePct = total > 0 ? (active  / total) * 100 : 0;
  const t0Today   = parseInt(row.today)     || 0;
  const todayPct  = total > 0 ? (t0Today / total) * 100 : 0;
  const t0Prev    = parseInt(row.date_1)    || 0;
  const prevPct   = total > 0 ? (t0Prev  / total) * 100 : 0;
  const t0Three   = parseInt(row.date_3)    || 0;
  const threePct  = total > 0 ? (t0Three / total) * 100 : 0;
  const gap       = parseFloat(row.gap_pct) || 0;
  const bsOn      = parseInt(row.bs_online) || 0;
  const bsTot     = parseInt(row.bs_total)  || bsOn;
  const bsPct     = bsTot > 0 ? (bsOn / bsTot) * 100 : 0;

  const gapPilCls = gap <= 5 ? 'pill-green' : gap <= 15 ? 'pill-yellow' : 'pill-red';

  return (
    <tr
      style={{ background: rowBg, transition: 'background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
    >
      <td style={{ ...stickyTd(rowBg), ...tdBase, minWidth: 130 }}>
        <span className="proj-chip" style={{ fontSize: 12 }}>{row.partner}</span>
      </td>
      <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: 13, minWidth: 90 }}>
        {fmt(total)}
      </td>
      <NumPctCell num={active} pct={activePct} good={80} med={60} />
      <NumPctCell num={t0Today} pct={todayPct} good={75} med={50} />
      <NumPctCell num={t0Prev} pct={prevPct} good={75} med={50} />
      <NumPctCell num={t0Three} pct={threePct} good={80} med={60} />
      <td style={{ ...tdBase, minWidth: 72, maxWidth: 90, textAlign: 'center' }}>
        <span className={`pill ${gapPilCls}`} style={{ fontSize: 11 }}>
          {gap.toFixed(1)}%
        </span>
      </td>
      <BsCell bsOn={bsOn} bsTot={bsTot} bsPct={bsPct} />
    </tr>
  );
});

/* ── Конфигурация сортируемых колонок ─────────────────────── */
const COLUMNS = [
  { key: 'partner',   label: 'Проект',    field: 'partner',     type: 'str',  minWidth: 130 },
  { key: 'total',     label: 'Всего ПУ',  field: 'total_pu',    type: 'num',  minWidth: 90,  sticky: false },
  { key: 'active',    label: 'Активных',  sortField: 'activePct', minWidth: 150 },
  { key: 'today',     label: 'ТО сегодня', sortField: 'todayPct', minWidth: 150 },
  { key: 'prev',      label: 'ТО вчера',  sortField: 'prevPct',  minWidth: 150 },
  { key: 'three',     label: 'ТО 3 дня',  sortField: 'threePct', minWidth: 150 },
  { key: 'gap',       label: 'Разрыв',    field: 'gap_pct',    type: 'num',  minWidth: 72,  maxWidth: 90 },
  { key: 'bs',        label: 'БС',        sortField: 'bsPct',    minWidth: 130 },
];

function computeRowMetrics(row) {
  const total   = parseInt(row.total_pu)  || 0;
  const active  = parseInt(row.pu_active) || 0;
  const t0Today = parseInt(row.today)     || 0;
  const t0Prev  = parseInt(row.date_1)    || 0;
  const t0Three = parseInt(row.date_3)    || 0;
  const bsOn    = parseInt(row.bs_online) || 0;
  const bsTot   = parseInt(row.bs_total)  || bsOn;
  return {
    total,
    active,  activePct:  total > 0 ? (active  / total) * 100 : 0,
    t0Today, todayPct:   total > 0 ? (t0Today / total) * 100 : 0,
    t0Prev,  prevPct:    total > 0 ? (t0Prev  / total) * 100 : 0,
    t0Three, threePct:   total > 0 ? (t0Three / total) * 100 : 0,
    bsOn, bsTot, bsPct:  bsTot > 0 ? (bsOn / bsTot) * 100 : 0,
  };
}

const SORT_ICONS = { asc: ' ▲', desc: ' ▼', none: '' };

function PartnerTable() {
  const { snapshot: data, status } = useDataStore();

  const [search,   setSearch]   = useState('');
  const [sortCol,  setSortCol]  = useState('partner');
  const [sortDir,  setSortDir]  = useState('asc');

  const toggleSort = (colKey) => {
    if (sortCol === colKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  };

  const processed = useMemo(() => {
    if (!data || data.length === 0) return [];

    let rows = data.map(row => ({ row, m: computeRowMetrics(row) }));

    // Поиск
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(({ row }) =>
        String(row.partner).toLowerCase().includes(q)
      );
    }

    // Сортировка
    const col = COLUMNS.find(c => c.key === sortCol);
    if (col) {
      const dirMul = sortDir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        let av, bv;
        if (col.sortField && col.sortField.endsWith('Pct')) {
          av = a.m[col.sortField]; bv = b.m[col.sortField];
        } else if (col.type === 'num') {
          av = parseFloat(a.row[col.field]) || 0;
          bv = parseFloat(b.row[col.field]) || 0;
        } else {
          av = String(a.row[col.field] ?? '');
          bv = String(b.row[col.field] ?? '');
          return av.localeCompare(bv, 'ru') * dirMul;
        }
        return (av - bv) * dirMul;
      });
    }
    return rows;
  }, [data, search, sortCol, sortDir]);

  if (status === 'loading' && data.length === 0)
    return <div className="state-msg">⏳ Загрузка таблицы...</div>;
  if (!data || data.length === 0)
    return <div className="state-msg">Нет данных</div>;

  return (
    <>
      {/* Панель поиска */}
      <div style={{ margin: '0 24px 12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 1 280px' }}>
          <input
            type="text"
            placeholder="🔍 Поиск проекта..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 12px 7px 32px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none',
          }}>
            🔍
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Показано {processed.length} из {data.length}
        </span>
      </div>

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
                ...stickyTh,
                ...thStyle,
                cursor: 'pointer', userSelect: 'none',
                minWidth: 130,
              }}
                onClick={() => toggleSort('partner')}
              >
                Проект{sortCol === 'partner' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 90, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('total')}>
                Всего ПУ{sortCol === 'total' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 150, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('active')}>
                Активных{sortCol === 'active' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 150, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('today')}>
                ТО сегодня{sortCol === 'today' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 150, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('prev')}>
                ТО вчера{sortCol === 'prev' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 150, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('three')}>
                ТО 3 дня{sortCol === 'three' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 72, maxWidth: 90, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('gap')}>
                Разрыв{sortCol === 'gap' ? SORT_ICONS[sortDir] : ''}
              </th>
              <th style={{ ...thStyle, minWidth: 130, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('bs')}>
                БС{sortCol === 'bs' ? SORT_ICONS[sortDir] : ''}
              </th>
            </tr>
          </thead>

          <tbody>
            {processed.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Ничего не найдено
                </td>
              </tr>
            )}
            {processed.map(({ row }, i) => (
              <TableRow
                key={row.partner}
                row={row}
                rowBg={i % 2 === 1 ? 'rgba(255,255,255,0.013)' : 'var(--surface)'}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default PartnerTable;