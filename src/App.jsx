import React, { useState, useEffect } from 'react';
import Graph from './components/Graph';
import PartnerTable from './components/PartnerTable';
import AllProjectsHistoryTable from './components/AllProjectsHistoryTable';
import MetricCards from './components/MetricCards';
import BSStatusChart from './components/BSStatusChart';
import './App.css';

function App() {
  const apiBase = import.meta.env.VITE_API_URL || '';

  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [days, setDays] = useState(30);
  const [snapshot, setSnapshot] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetch(`${apiBase}/api/partners`)
      .then(res => res.json())
      .then(data => {
        setPartners(data);
        if (data.length > 0) setSelectedPartner(data[0]);
        const params = new URLSearchParams();
        data.forEach(p => params.append('partners', p));
        fetch(`${apiBase}/api/snapshot?${params.toString()}`)
          .then(res => res.json())
          .then(snap => setSnapshot(snap))
          .catch(() => {});
      })
      .catch(console.error);
  }, [apiBase]);

  const handlePartnerChange = (e) => setSelectedPartner(e.target.value);
  const handleDaysChange = (e) => setDays(Number(e.target.value));

  return (
    <div className="App">
      <h1>📊 Prod Monitoring Dashboard</h1>

      {/* Вкладки */}
      <div className="tabs">
        <button
          className={activeTab === 'overview' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('overview')}
        >
          📋 Сводка
        </button>
        <button
          className={activeTab === 'detail' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('detail')}
        >
          📈 Детализация
        </button>
      </div>

      {/* Содержимое вкладки "Сводка" – ВСЕ данные без фильтров */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="dashboard-row">
            <div className="row-item metrics-wrapper">
              <MetricCards partners={partners} snapshot={snapshot} />
            </div>
            <div className="row-item bs-chart-wrapper">
              <div className="card" style={{ padding: '16px', height: '100%' }}>
                <BSStatusChart partners={partners} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">📋 Сводка по всем проектам</div>
            <PartnerTable partners={partners} />
          </div>

          <div className="card">
            <AllProjectsHistoryTable partners={partners} days={365} /> {/* Все данные */}
          </div>
        </div>
      )}

      {/* Содержимое вкладки "Детализация" – с фильтрами */}
      {activeTab === 'detail' && (
        <div className="tab-content">
          {/* Локальные фильтры */}
          <div className="card filters-card">
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ marginRight: '8px', color: '#b0c4e0' }}>Проект:</label>
                <select value={selectedPartner} onChange={handlePartnerChange}>
                  {partners.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ marginRight: '8px', color: '#b0c4e0' }}>Период (дней):</label>
                <select value={days} onChange={handleDaysChange}>
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={90}>90</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">📈 Детальная история</div>
            <AllProjectsHistoryTable
              key={selectedPartner}
              partners={[selectedPartner]}
              days={days}
              title={`📊 Детальная история ${selectedPartner}`}
            />
          </div>

          <div className="card">
            <div className="card-header">📊 Графики</div>
            {selectedPartner && <Graph partner={selectedPartner} days={days} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;