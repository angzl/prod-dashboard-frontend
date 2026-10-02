import React, { useMemo } from 'react';
import { useDataStore } from '../context/DataContext';
import PartnerTable from './PartnerTable';
import InfoTip from './InfoTip';

/* Блок «Сводка по инсталяциям» на дашборде (вкладка «Сводка»).
 * Та же таблица, что и у прод-проектов (PartnerTable, variant='installations'):
 * все колонки (Всего ПУ, Активных, ТО сегодня/вчера/3 дня, Разрыв, БС, Срез БД),
 * сортировка, поиск и цветовая индикация — идентичны прод-таблице. */
export default function InstallationsBlock() {
  const { installations } = useDataStore();

  const instList = useMemo(
    () => (installations || []).filter(i => i.category !== 'prod' && i.monitor !== false),
    [installations],
  );

  if (instList.length === 0) return null;

  const instBadge = {
    fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
    background: 'rgba(251,191,36,0.12)', color: '#fcd34d',
    border: '1px solid rgba(251,191,36,0.35)', textTransform: 'uppercase',
    marginLeft: 8, verticalAlign: 'middle',
  };

  return (
    <>
      <div className="section-title">
        {'Сводка по инсталяциям '}
        <span style={instBadge}>инсталяции</span>
        <InfoTip
          title="Сводка по инсталяциям"
          text={'Те же колонки и цветовая индикация, что и у прод-проектов.\nИнсталяция — агрегат по всей площадке (без разбивки по партнёрам): метрики из её баз SG/SG2/MS.'}
        />
      </div>
      <PartnerTable variant="installations" />
    </>
  );
}
