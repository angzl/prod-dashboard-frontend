import React, { useMemo } from 'react';
import { useDataStore } from '../context/DataContext';
import AllProjectsHistoryTable from './AllProjectsHistoryTable';
import InfoTip from './InfoTip';

/* ── История по всем инсталяциям (вкладка «Сводка», под сводкой инсталяций).
 * Та же таблица детальной истории, что и у прод-проектов
 * (AllProjectsHistoryTable, режим daily): полный набор метрик
 * (Всего ПУ, Активных, ТО сегодня/вчера/3 дня, Разрыв, БС) и та же
 * цветовая заливка ячеек (красный — минимум, зелёный — максимум).
 */
export default function InstallationsHistoryTable() {
  const { installations } = useDataStore();

  const instList = useMemo(
    () => (installations || []).filter(i => i.category !== 'prod' && i.monitor !== false),
    [installations],
  );

  if (instList.length === 0) return null;

  return (
    <>
      <div className="section-title">
        📊 История по инсталяциям
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          background: 'rgba(251,191,36,0.12)', color: '#fcd34d',
          border: '1px solid rgba(251,191,36,0.35)', textTransform: 'uppercase',
          marginLeft: 8, verticalAlign: 'middle',
        }}>инсталяции</span>
        <InfoTip
          title="История по инсталяциям"
          text={'Один день — одна колонка, берётся последний срез дня (время под датой).\nЦвет: красный — минимум, зелёный — максимум (у «Разрыва» наоборот).\nТа же заливка и набор метрик, что и в истории прод-проектов.'}
        />
      </div>
      <AllProjectsHistoryTable partners={instList.map(i => i.name)} days={30} />
    </>
  );
}
