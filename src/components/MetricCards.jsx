import React, { useMemo } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import InfoTip from './InfoTip';
import { fmtSnapDt, getLatestSnapDt } from '../utils/datetime';
// Данные теперь передаются через props из App (из DataContext)

/* memo предотвращает ре-рендер карточек, если snapshot/partners не изменились.
   Раньше каждый апдейт стора (даже unrelated) перерисовывал KPI-карточки. */
const MetricCards = React.memo(function MetricCards({ partners, snapshot }) {
  /* Хуки ниже вызываются безусловно (rules-of-hooks): раньше здесь был
   * ранний return при отсутствии snapshot, из-за чего число хуков менялось
   * между рендерами и React падал с ошибкой #310. Ветка «нет данных»
   * перенесена после хуков. */
  const hasData = !!(snapshot && snapshot.length > 0);

  // Мемоизируем агрегаты — пересчёт только при изменении snapshot.
  const {
    totalPU, totalActive, totalBSOnline, totalBSTotal,
    totalT0Today, todayPct, maxGap, maxGapPartner, activePct, bsPct,
  } = useMemo(() => {
    if (!snapshot || snapshot.length === 0) {
      return { totalPU: 0, totalActive: 0, totalBSOnline: 0, totalBSTotal: 0,
               totalT0Today: 0, todayPct: 0, maxGap: 0, maxGapPartner: '',
               activePct: 0, bsPct: 0 };
    }
    let totalPU = 0, totalActive = 0, totalBSOnline = 0, totalBSTotal = 0, totalT0Today = 0;
    let maxGap = 0, maxGapPartner = '';
    snapshot.forEach(row => {
      const pu    = parseInt(row.total_pu)  || 0;
      const act   = parseInt(row.pu_active) || 0;
      const bsOn  = parseInt(row.bs_online) || 0;
      const bsTot = parseInt(row.bs_total)  || bsOn;
      const t0    = parseInt(row.today)     || 0;
      const gap   = parseFloat(row.gap_pct) || 0;
      totalPU      += pu;
      totalActive  += act;
      totalBSOnline += bsOn;
      totalBSTotal  += bsTot;
      totalT0Today  += t0;
      if (gap > maxGap) { maxGap = gap; maxGapPartner = row.partner; }
    });
    const activePct = totalPU      > 0 ? (totalActive   / totalPU)     * 100 : 0;
    const bsPct     = totalBSTotal > 0 ? (totalBSOnline / totalBSTotal) * 100 : 0;
    const todayPct  = totalPU      > 0 ? (totalT0Today  / totalPU)     * 100 : 0;
    return { totalPU, totalActive, totalBSOnline, totalBSTotal, totalT0Today, todayPct, maxGap, maxGapPartner, activePct, bsPct };
  }, [snapshot]);

  // Время среза, на которое посчитаны агрегаты (самый свежий snap_datetime)
  const snapDt = useMemo(() => fmtSnapDt(getLatestSnapDt(snapshot)), [snapshot]);

  const animPU     = useCountUp(totalPU);
  const animActive = useCountUp(totalActive);
  const animBSOn   = useCountUp(totalBSOnline);

  // Ветка «нет данных» — уже ПОСЛЕ всех хуков (см. комментарий выше)
  if (!hasData) return null;

  const fmt = (n) => Number(n).toLocaleString('ru-RU');

  const activeColor = activePct >= 80 ? 'col-green' : activePct >= 60 ? 'col-yellow' : 'col-red';
  const bsColor     = bsPct     >= 85 ? 'col-green' : bsPct     >= 70 ? 'col-yellow' : 'col-red';

  const cards = [
    {
      label: 'Всего ПУ',
      value: fmt(animPU),
      sub:   `${partners.length} проектов`,
      cls:   'col-plain',
      tip: 'Сумма всех приборов учёта по всем проектам на момент последнего среза из базы данных (см. бейдж «Данные на …» в шапке).',
    },
    {
      label: 'Активных ПУ',
      value: fmt(animActive),
      sub:   `${activePct.toFixed(1)}% активных`,
      cls:   activeColor,
      tip: 'Сумма ПУ с активностью за сегодня по всем проектам. Процент — доля от общего числа ПУ.',
    },
    {
      label: 'ТО сегодня',
      value: fmt(totalT0Today),
      sub:   `${todayPct.toFixed(1)}% сбора`,
      cls:   todayPct >= 75 ? 'col-green' : todayPct >= 50 ? 'col-yellow' : 'col-red',
      tip: 'Сумма собранных суточных архивов показаний (Т0) за сегодняшнюю дату по всем проектам. Процент — доля от общего числа ПУ.',
    },
    {
      label: 'БС всего',
      value: fmt(totalBSTotal),
      sub:   'базовых станций',
      cls:   'col-plain',
      tip: 'Суммарное количество базовых станций по всем проектам.',
    },
    {
      label: 'БС онлайн',
      value: fmt(animBSOn),
      sub:   `${bsPct.toFixed(1)}% онлайн`,
      cls:   bsColor,
      tip: 'Базовые станции, находившиеся на связи в последний час перед срезом. Процент — от общего количества БС.',
    },
    {
      label: 'Макс. разрыв',
      value: `${maxGap.toFixed(1)}%`,
      sub:   maxGapPartner,
      cls:   'col-red',
      tip: 'Проект с наибольшим разрывом: доля активных ПУ, по которым за 3 дня НЕ собран архив Т0 (100% − ТО 3 дня ÷ Активных). Под числом — название этого проекта.',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, idx) => (
        <div key={idx} className={`kpi-card fade-in-up delay-${(idx % 6) + 1}`}>
          <div className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <span>{card.label}</span>
            {card.tip && <InfoTip title={card.label} text={card.tip} />}
          </div>
          <div className={`value ${card.cls}`}>{card.value}</div>
          {card.sub && <div className="sub">{card.sub}</div>}
          {idx === 0 && snapDt && (
            <div className="sub" style={{ marginTop: 2 }}>
              🗄 данные на {snapDt}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

export default MetricCards;