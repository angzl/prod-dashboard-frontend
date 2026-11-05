import React, { useMemo } from 'react';
import { useDataStore } from '../context/DataContext';
import AllProjectsHistoryTable from './AllProjectsHistoryTable';
import InfoTip from './InfoTip';

/* ── История по всем инсталяциям (вкладка «Сводка», под сводкой инсталяций).
 * Та же таблица timeline-истории, что и у прод-проектов
 * (AllProjectsHistoryTable, режим timeline): годы и месяцы — максимум
 * за период (у «Разрыва» — минимум), дни текущего месяца — последний
 * срез дня. Тот же набор метрик и та же цветовая заливка ячеек
 * (красный — минимум, зелёный — максимум), что и в прод-таблице.
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
          text={'Годы и месяцы — максимум за период (у «Разрыва» — минимум), дни текущего месяца — последний срез дня (время под датой).\nЦвет: красный — минимум, зелёный — максимум (у «Разрыва» наоборот).\nТа же структура timeline, набор метрик и заливка, что и в истории прод-проектов.\nПериоды, в которых у инсталяций ещё не было срезов, не выводятся.'}
        />
      </div>
      {/* dropEmptyColumns — не выводить периоды, в которых у инсталяций
          ещё не было срезов (колонки timeline общие с прод-проектами). */}
      <AllProjectsHistoryTable partners={instList.map(i => i.name)} mode="timeline" dropEmptyColumns />
    </>
  );
}
