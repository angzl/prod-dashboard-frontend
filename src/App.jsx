import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Graph from './components/Graph';
import MultiGraph from './components/MultiGraph';
import PartnerTable from './components/PartnerTable';
import AllProjectsHistoryTable from './components/AllProjectsHistoryTable';
import MetricCards from './components/MetricCards';
import ProjectMetricCards from './components/ProjectMetricCards';
import './App.css';

// Стили для react-select в тёмной теме
const selectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: '#222536',
    borderColor: state.isFocused ? '#6366f1' : '#2e3248',
    boxShadow: state.isFocused ? '0 0 0 1px #6366f1' : 'none',
    color: '#e2e8f0',
    fontSize: 13,
    borderRadius: 8,
    '&:hover': { borderColor: 'rgba(99,102,241,0.5)' },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#1a1d27',
    border: '1px solid #2e3248',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#222536' : 'transparent',
    color: state.isSelected ? '#a5b4fc' : '#e2e8f0',
    fontSize: 13,
    cursor: 'pointer',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'rgba(99,102,241,0.2)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: 20,
  }),
  multiValueLabel: (base) => ({ ...base, color: '#a5b4fc', fontSize: 12 }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#8892a4',
    borderRadius: '0 20px 20px 0',
    '&:hover': { backgroundColor: 'rgba(220,38,38,0.2)', color: '#f87171' },
  }),
  input:       (base) => ({ ...base, color: '#e2e8f0' }),
  placeholder: (base) => ({ ...base, color: '#8892a4', fontSize: 13 }),
  singleValue: (base) => ({ ...base, color: '#e2e8f0' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8892a4' }),
  clearIndicator: (base) => ({ ...base, color: '#8892a4' }),
};

function App() {
  const apiBase = import.meta.env.VITE_API_URL || '';

  const [partners,        setPartners]        = useState([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [days,            setDays]            = useState(30);
  const [snapshot,        setSnapshot]        = useState([]);
  const [activeTab,       setActiveTab]       = useState('overview');
  const [compareProjects, setCompareProjects] = useState([]);

  useEffect(() => {
    fetch(`${apiBase}/api/partners`)
      .then(r => r.json())
      .then(data => {
        setPartners(data);
        if (data.length > 0) setSelectedPartner(data[0]);

        const params = new URLSearchParams();
        data.forEach(p => params.append('partners', p));
        fetch(`${apiBase}/api/snapshot?${params}`)
          .then(r => r.json())
          .then(snap => setSnapshot(snap))
          .catch(() => {});
      })
      .catch(console.error);
  }, [apiBase]);

  const currentProjectData = snapshot.find(p => p.partner === selectedPartner);
  const partnerOptions     = partners.map(p => ({ value: p, label: p }));

  return (
    <div>
      {/* ── Шапка ── */}
      <div className="page-header">
        <h1>📊 Prod Monitoring Dashboard</h1>
        <span className="badge-date">
          Обновлено: {new Date().toLocaleDateString('ru-RU')}
        </span>
      </div>

      {/* ── Вкладки ── */}
      <div className="tabs">
        {[
          { id: 'overview', label: '📋 Сводка'      },
          { id: 'detail',   label: '📈 Детализация' },
          { id: 'compare',  label: '📊 Сравнение'   },
        ].map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ СВОДКА ══════════════ */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <MetricCards partners={partners} snapshot={snapshot} />

          <div className="section-title">📋 Сводка по всем проектам</div>
          <PartnerTable partners={partners} />

          <div className="section-title">📊 История по всем проектам</div>
          <AllProjectsHistoryTable partners={partners} days={365} />
        </div>
      )}

      {/* ══════════════ ДЕТАЛИЗАЦИЯ ══════════════ */}
      {activeTab === 'detail' && (
        <div className="tab-content">
          {/* Фильтры */}
          <div className="card filters-card">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <span className="filter-label">Проект</span>
                <select value={selectedPartner} onChange={e => setSelectedPartner(e.target.value)}>
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
          {selectedPartner && (
            <div className="card">
              <div className="card-header">
                📌 {selectedPartner}
              </div>
              {currentProjectData
                ? <ProjectMetricCards projectData={currentProjectData} partner={selectedPartner} />
                : <div className="state-msg">
                    ⚠️ Данные для <strong>{selectedPartner}</strong> не найдены
                    {snapshot.length === 0 && ' — срез ещё не загружен'}
                  </div>
              }
            </div>
          )}

          {/* История */}
          <div className="section-title">📊 Детальная история</div>
          <AllProjectsHistoryTable
            key={selectedPartner}
            partners={[selectedPartner]}
            days={days}
          />

          {/* Графики */}
          <div className="card">
            <div className="card-header">📈 Графики</div>
            {selectedPartner && <Graph partner={selectedPartner} days={days} />}
          </div>
        </div>
      )}

      {/* ══════════════ СРАВНЕНИЕ ══════════════ */}
      {activeTab === 'compare' && (
        <div className="tab-content">
          <div className="card">
            <div className="card-header">📊 Сравнение проектов</div>

            <div style={{ marginBottom: 20 }}>
              <span className="filter-label" style={{ marginBottom: 6 }}>
                Выберите проекты
              </span>
              <Select
                isMulti
                options={partnerOptions}
                value={compareProjects}
                onChange={setCompareProjects}
                placeholder="Выберите проекты для сравнения..."
                styles={selectStyles}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <span className="filter-label">Период (дней)</span>
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                style={{ marginLeft: 8 }}
              >
                {[7, 14, 30, 60, 90].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <MultiGraph projects={compareProjects.map(p => p.value)} days={days} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
