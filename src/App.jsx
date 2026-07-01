import React, { useState } from 'react';
import Select from 'react-select';

import { DataProvider, useDataStore } from './context/DataContext';
import ApiStatusBar       from './components/ApiStatusBar';
import Graph              from './components/Graph';
import MultiGraph         from './components/MultiGraph';
import PartnerTable       from './components/PartnerTable';
import AllProjectsHistoryTable from './components/AllProjectsHistoryTable';
import MetricCards        from './components/MetricCards';
import ProjectMetricCards from './components/ProjectMetricCards';
import AdminPanel         from './components/AdminPanel';
import './App.css';

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
        <LastUpdateBadge />
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

          <div className="section-title">📋 Сводка по всем проектам</div>
          <PartnerTable />

          <div className="section-title">📊 История по всем проектам</div>
          <AllProjectsHistoryTable partners={partners} days={settings.historyDays} />
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
              <div className="card-header">📌 {partner}</div>
              {currentProjectData
                ? <ProjectMetricCards projectData={currentProjectData} partner={partner} />
                : <div className="state-msg">⚠️ Данные для <strong>{partner}</strong> ещё загружаются</div>
              }
            </div>
          )}

          {/* История */}
          <div className="section-title">📊 Детальная история</div>
          <AllProjectsHistoryTable
            key={`${partner}_${days}`}
            partners={[partner]}
            days={days}
          />

          {/* Графики */}
          <div className="card">
            <div className="card-header">📈 Графики</div>
            {partner && <Graph partner={partner} days={days} />}
          </div>
        </div>
      )}

      {/* ══ СРАВНЕНИЕ ═══════════════════════════════════════ */}
      {activeTab === 'compare' && (
        <div className="tab-content">
          <div className="card">
            <div className="card-header">📊 Сравнение проектов</div>
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
            <MultiGraph projects={compareProjects.map(p => p.value)} days={days} />
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

/* ── Оборачиваем в DataProvider ───────────────────────────── */
export default function App() {
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}
