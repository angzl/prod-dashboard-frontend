import React, { useState, Suspense, lazy } from 'react';
import Select from 'react-select';

import { DataProvider, useDataStore } from './context/DataContext';
import ApiStatusBar       from './components/ApiStatusBar';
import PartnerTable       from './components/PartnerTable';
import AllProjectsHistoryTable from './components/AllProjectsHistoryTable';
import AllProjectsTotalTable   from './components/AllProjectsTotalTable';
import MetricCards        from './components/MetricCards';
import ProjectMetricCards from './components/ProjectMetricCards';
import AdminPanel         from './components/AdminPanel';
import ErrorBoundary      from './components/ErrorBoundary';
import Skeleton           from './components/Skeleton';
import InfoTip            from './components/InfoTip';
import { fmtSnapDt, getLatestSnapDt } from './utils/datetime';
import './App.css';

/* Тяжёлые графические компоненты (plotly.js ~3 МБ) грузим лениво.
   Они попадают в отдельный чанк и подгружаются только когда пользователь
   открывает вкладки «Детализация», «Сравнение» или «Весь прод». Вкладка
   «Сводка» (самая частая) грузится быстро, без plotly в начальном бандле. */
const Graph       = lazy(() => import('./components/Graph'));
const MultiGraph  = lazy(() => import('./components/MultiGraph'));
const TotalGraphs = lazy(() => import('./components/TotalGraphs'));

/* ── react-select тёмная тема ─────────────────────────────── */
const selectStyles = {
  control: (b, s) => ({
    ...b,
    backgroundColor: '#222536',
    borderColor: s.isFocused ? '#6366f1' : '#2e3248',
    boxShadow: s.isFocused ? '0 0 0 1px #6366f1' : 'none',
    fontSize: 13, borderRadius: 8,
    '&:hover': { borderColor: 'rgba(99,102,241,0.5)' },
  }),
  menu:        (b) => ({ ...b, backgroundColor: '#1a1d27', border: '1px solid #2e3248', borderRadius: 8 }),
  option:      (b, s) => ({ ...b, backgroundColor: s.isFocused ? '#222536' : 'transparent', color: s.isSelected ? '#a5b4fc' : '#e2e8f0', fontSize: 13 }),
  multiValue:  (b) => ({ ...b, backgroundColor: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 20 }),
  multiValueLabel: (b) => ({ ...b, color: '#a5b4fc', fontSize: 12 }),
  multiValueRemove:(b) => ({ ...b, color: '#8892a4', '&:hover': { backgroundColor: 'rgba(220,38,38,0.2)', color: '#f87171' } }),
  input:       (b) => ({ ...b, color: '#e2e8f0' }),
  placeholder: (b) => ({ ...b, color: '#8892a4', fontSize: 13 }),
  singleValue: (b) => ({ ...b, color: '#e2e8f0' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator:  (b) => ({ ...b, color: '#8892a4' }),
};

/* ── Индикатор последнего обновления в хедере ─────────────── */
function LastUpdateBadge() {
  const { lastOk, status } = useDataStore();
  if (!lastOk) return null;

  const d = new Date(lastOk);
  const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: status === 'ok' ? '#4ade80' : status === 'loading' ? '#a5b4fc' : '#f87171',
        boxShadow: status === 'ok' ? '0 0 5px #4ade80' : 'none',
      }} />
      <span className="badge-date">
        {status === 'loading' ? 'Обновление...' : `Обновлено в ${timeStr}`}
      </span>
      <InfoTip
        title="«Обновлено в …» — что это значит"
        text={'Это время, когда дашборд получил свежий снимок от сервера (обновление кеша API).\nВНИМАНИЕ: это НЕ время среза из базы данных. Дата и время актуального среза, на которое приходятся показанные значения, указаны в бейдже «Данные на …» рядом.'}
      />
    </div>
  );
}

/* ── Время среза из БД (первый столбец daily_snapshots) ────── */
function SnapshotTimeBadge() {
  const { snapshot } = useDataStore();
  const label = fmtSnapDt(getLatestSnapDt(snapshot));
  if (!label) return null;

  return (
    <div
      className="snapshot-dt-badge"
      title="Дата и время среза из локальной базы данных (snap_datetime) — на этот момент приходятся все «актуальные» показатели на дашборде"
    >
      🗄 Данные на <b>{label}</b>
    </div>
  );
}

/* ── Индикатор обновления + кнопка «Обновить» (без PIN) ──── */
function HeaderStatus() {
  const { refreshNow } = useDataStore();
  const [busy, setBusy] = useState(false);

  const onRefresh = async () => {
    if (busy) return;
    setBusy(true);
    try { await refreshNow(); } finally { setTimeout(() => setBusy(false), 600); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <LastUpdateBadge />
      <button
        onClick={onRefresh}
        disabled={busy}
        title="Обновить данные сейчас (не требует PIN)"
        style={{
          padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
          color: '#a5b4fc', cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
          transition: 'all 0.15s',
        }}
      >
        {busy ? '⏳ Обновление...' : '🔄 Обновить'}
      </button>
    </div>
  );
}

/* ── Основное приложение (внутри DataProvider) ────────────── */
function AppInner() {
  const {
    partners, snapshot, settings, getHistory,
  } = useDataStore();

  const [activeTab,       setActiveTab]       = useState('overview');
  const [selectedPartner, setSelectedPartner] = useState('');
  const [days,            setDays]            = useState(settings.historyDays);
  const [compareProjects, setCompareProjects] = useState([]);

  // Если selectedPartner ещё не выбран — берём первый из списка
  const partner = selectedPartner || partners[0] || '';
  const currentProjectData = snapshot.find(p => p.partner === partner);
  const partnerOptions     = partners.map(p => ({ value: p, label: p }));

  const TABS = [
    { id: 'overview', label: '📋 Сводка'      },
    { id: 'total',    label: '🌐 Весь прод'   },
    { id: 'detail',   label: '📈 Детализация' },
    { id: 'compare',  label: '📊 Сравнение'   },
    { id: 'admin',    label: '⚙️ Настройки'   },
  ];

  return (
    <div>
      {/* Баннер недоступности API */}
      <ApiStatusBar />

      {/* Шапка */}
      <div className="page-header">
        <h1>📊 Prod Monitoring Dashboard</h1>
        <SnapshotTimeBadge />
        <HeaderStatus />
      </div>

      {/* Вкладки */}
      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ СВОДКА ══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <MetricCards partners={partners} snapshot={snapshot} />

          <div className="section-title">
            📋 Сводка по всем проектам
            <InfoTip
              title="Сводка по всем проектам"
              text={'Актуальные показатели по каждому проекту на момент последнего среза в базе данных (см. бейдж «Данные на …» в шапке).\n<b>Всего ПУ</b> — все приборы учёта проекта; <b>Активных</b> — ПУ с активностью за сегодня; <b>ТО сегодня / вчера / 3 дня</b> — собранные суточные архивы показаний (Т0) за соответствующие даты; <b>Разрыв</b> — доля активных ПУ, по которым нет архива за 3 дня: 100% − (ТО 3 дня ÷ Активных); <b>БС</b> — базовые станции: онлайн (были на связи в последний час) / всего.\nИсточник данных: фоновый съём из PostgreSQL → локальный архив SQLite → кеш API.'}
            />
          </div>
          <PartnerTable />

          <div className="section-title">
            📊 История по всем проектам
            <InfoTip
              title="История по всем проектам"
              text={'Тепловая таблица по каждому проекту. Колонки слева направо: завершённые годы → месяцы текущего года → дни текущего месяца.\n<b>Годы и месяцы</b> — максимум метрики за период (для «Разрыва» — минимум, т.к. меньше = лучше); <b>дни</b> — последний срез дня; под датой дня указано время этого среза (ЧЧ:ММ) из базы данных.\nПроцент под числом — доля от «Всего ПУ» (для БС — от «БС всего»). Цвет ячейки — положение значения в диапазоне от минимума (красный) до максимума (зелёный), рассчитанном по всем сырым срезам партнёра.'}
            />
          </div>
          <AllProjectsHistoryTable partners={partners} mode="timeline" />
        </div>
      )}

      {/* ══ ВЕСЬ ПРОД (АГРЕГИРОВАННАЯ ИСТОРИЯ) ══════════════ */}
      {activeTab === 'total' && (
        <div className="tab-content">
          <MetricCards partners={partners} snapshot={snapshot} />

          <div className="section-title">
            🌐 Агрегированная история (весь прод)
            <InfoTip
              title="Агрегированная история (весь прод)"
              text={'Сводка сразу по всем проектам: значение в каждой колонке — СУММА показателей всех проектов за этот период.\n<b>Годы и месяцы</b> — сумма максимумов проектов за период; <b>дни</b> — сумма последних срезов дня по каждому проекту; под датой дня указано самое позднее время среза (ЧЧ:ММ) среди всех проектов.\n«Разрыв» считается от сумм: 100% − (Σ ТО-3д ÷ Σ Активных). Проценты под числами — доля от «Всего ПУ» (для БС — от «БС всего»).'}
            />
          </div>
          <AllProjectsTotalTable />

          <div className="section-title">
            📈 Детализация с графиками
            <InfoTip
              title="Детализация с графиками"
              text={'Динамика суммарных показателей по всему продy за 90 дней.\nКаждая точка графика — последний срез соответствующего дня из базы данных. Стэк-графики показывают вклад каждого проекта в общую сумму, линии «Σ» — суммарные значения, «Gap%» — суммарный разрыв между активными ПУ и собранными Т0 за 3 дня.'}
            />
          </div>
          <Suspense fallback={<Skeleton height={400} text="Загрузка графиков..." />}>
            <TotalGraphs />
          </Suspense>
        </div>
      )}

      {/* ══ ДЕТАЛИЗАЦИЯ ═════════════════════════════════════ */}
      {activeTab === 'detail' && (
        <div className="tab-content">
          {/* Фильтры */}
          <div className="card filters-card">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <span className="filter-label">Проект</span>
                <select value={partner} onChange={e => setSelectedPartner(e.target.value)}>
                  {partners.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <span className="filter-label">Период (дней)</span>
                <select value={days} onChange={e => setDays(Number(e.target.value))}>
                  {[7, 14, 30, 60, 90].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Карточки проекта */}
          {partner && (
            <div className="card">
              <div className="card-header">
                <span style={{ marginRight: 6 }}>📌 {partner}</span>
                {fmtSnapDt(currentProjectData?.snap_datetime) && (
                  <span className="snap-sub" style={{ marginTop: 0 }}>
                    🗄 данные на {fmtSnapDt(currentProjectData.snap_datetime)} (срез из БД)
                  </span>
                )}
              </div>
              {currentProjectData
                ? <ProjectMetricCards projectData={currentProjectData} partner={partner} />
                : <div className="state-msg">⚠️ Данные для <strong>{partner}</strong> ещё загружаются</div>
              }
            </div>
          )}

          {/* История */}
          <div className="section-title">
            📊 Детальная история
            <InfoTip
              title="Детальная история"
              text={'Тепловая таблица выбранного проекта за выбранный период: одна колонка — один день, берётся последний срез этого дня из базы данных (под датой указано время среза ЧЧ:ММ).\nПроценты под числами — доля от «Всего ПУ» (для БС — от «БС всего»). Цвет — положение значения между минимумом (красный) и максимумом (зелёный) за период; у «Разрыва» наоборот — меньше значит лучше.'}
            />
          </div>
          <AllProjectsHistoryTable
            key={`${partner}_${days}`}
            partners={[partner]}
            days={days}
          />

          {/* Графики — ленивая загрузка plotly.js */}
          <div className="card">
            <div className="card-header">
              📈 Графики
              <InfoTip
                title="Графики проекта"
                text={'Динамика показателей выбранного проекта за выбранный период.\nКаждая точка — последний срез соответствующего дня из базы данных (при наведении на точку показаны дата и время среза). Верхний график — активные ПУ и собранные Т0 за 3 дня, нижний — базовые станции онлайн и всего.\nБлок статистики под графиком: среднее, максимум, минимум и последнее значение за период.'}
              />
            </div>
            {partner && (
              <Suspense fallback={<Skeleton height={360} text="Загрузка графиков..." />}>
                <Graph partner={partner} days={days} />
              </Suspense>
            )}
          </div>
        </div>
      )}

      {/* ══ СРАВНЕНИЕ ═══════════════════════════════════════ */}
      {activeTab === 'compare' && (
        <div className="tab-content">
          <div className="card">
            <div className="card-header">
              📊 Сравнение проектов
              <InfoTip
                title="Сравнение проектов"
                text={'Наложение графиков выбранных проектов за выбранный период.\nСплошная линия — активные ПУ, пунктирная — собранные Т0 за 3 дня. Каждая точка — последний срез соответствующего дня из базы данных. Цвет линии соответствует проекту в легенде.'}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="filter-label" style={{ marginBottom: 6 }}>Выберите проекты</span>
              <Select
                isMulti
                options={partnerOptions}
                value={compareProjects}
                onChange={setCompareProjects}
                placeholder="Выберите проекты..."
                styles={selectStyles}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="filter-label">Период (дней)</span>
              <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ marginLeft: 8 }}>
                {[7, 14, 30, 60, 90].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {/* Графики — ленивая загрузка plotly.js */}
            <Suspense fallback={<Skeleton height={480} text="Загрузка графиков..." />}>
              <MultiGraph projects={compareProjects.map(p => p.value)} days={days} />
            </Suspense>
          </div>
        </div>
      )}

      {/* ══ НАСТРОЙКИ (АДМИНКА) ═════════════════════════════ */}
      {activeTab === 'admin' && (
        <div className="tab-content">
          <AdminPanel />
        </div>
      )}
    </div>
  );
}

/* ── Оборачиваем в ErrorBoundary + DataProvider ───────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <AppInner />
      </DataProvider>
    </ErrorBoundary>
  );
}