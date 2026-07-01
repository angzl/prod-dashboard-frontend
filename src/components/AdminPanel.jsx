import React, { useState, useEffect } from 'react';
import { useDataStore } from '../context/DataContext';

/* ── PIN-защита ───────────────────────────────────────────── */
const PIN_KEY     = 'dm_admin_auth';
const ADMIN_PIN   = import.meta.env.VITE_ADMIN_PIN || '1234';

function PinGate({ onUnlock }) {
  const [pin,  setPin]  = useState('');
  const [err,  setErr]  = useState(false);
  const [shake, setShake] = useState(false);

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const press = (d) => {
    if (d === '⌫') { setPin(p => p.slice(0, -1)); setErr(false); return; }
    if (d === '')  return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        sessionStorage.setItem(PIN_KEY, '1');
        onUnlock();
      } else {
        setErr(true);
        setShake(true);
        setTimeout(() => { setPin(''); setErr(false); setShake(false); }, 700);
      }
    }
  };

  return (
    <div style={{
      maxWidth: 280, margin: '60px auto', textAlign: 'center',
      animation: shake ? 'pinShake 0.5s ease' : 'none',
    }}>
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>

      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        🔐 Введите PIN
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 28 }}>
        Доступ к настройкам защищён
      </div>

      {/* Индикатор */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 28 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < pin.length
              ? (err ? '#f87171' : '#6366f1')
              : 'var(--border)',
            transition: 'background 0.15s',
          }} />
        ))}
      </div>

      {/* Цифровая клавиатура */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {digits.map((d, i) => (
          <button
            key={i}
            onClick={() => press(d)}
            style={{
              height: 52, borderRadius: 10,
              fontSize: d === '⌫' ? 20 : 22, fontWeight: 600,
              background: d === '' ? 'transparent' : 'var(--surface2)',
              border: `1px solid ${d === '' ? 'transparent' : 'var(--border)'}`,
              color: d === '⌫' ? 'var(--text-muted)' : 'var(--text)',
              cursor: d === '' ? 'default' : 'pointer',
              transition: 'background 0.12s',
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ marginTop: 16, color: '#f87171', fontSize: 13 }}>
          Неверный PIN
        </div>
      )}
    </div>
  );
}

/* ── Строка настройки ─────────────────────────────────────── */
function SettingRow({ label, sub, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--border)',
      gap: 16, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ── Выбор интервала ──────────────────────────────────────── */
const INTERVALS = [
  { label: '30 сек',  ms: 30_000 },
  { label: '1 мин',   ms: 60_000 },
  { label: '2 мин',   ms: 120_000 },
  { label: '5 мин',   ms: 300_000 },
  { label: '10 мин',  ms: 600_000 },
  { label: '30 мин',  ms: 1_800_000 },
  { label: 'Выкл.',   ms: 0 },
];

const DAYS_OPTIONS = [7, 14, 30, 60, 90, 180, 365];
const TIMEOUT_OPTIONS = [5_000, 10_000, 15_000, 30_000];
const OFFLINE_OPTIONS = [
  { label: '1 мин',  ms: 60_000 },
  { label: '2 мин',  ms: 120_000 },
  { label: '5 мин',  ms: 300_000 },
  { label: '10 мин', ms: 600_000 },
];

function SegmentControl({ value, options, onChange, valueKey = 'ms', labelKey = 'label' }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'object' ? opt[valueKey] : opt;
        const l = typeof opt === 'object' ? opt[labelKey] : `${opt} д.`;
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              padding: '5px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: active ? 'rgba(99,102,241,0.25)' : 'var(--surface2)',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              color: active ? '#a5b4fc' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/* ── Статус API ───────────────────────────────────────────── */
function ApiStatusBadge({ status, lastOk, isOffline }) {
  const configs = {
    ok:      { color: '#4ade80', bg: 'rgba(22,163,74,0.15)',  dot: '#4ade80',  label: 'API онлайн' },
    loading: { color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)', dot: '#a5b4fc',  label: 'Обновление...' },
    error:   { color: '#f87171', bg: 'rgba(220,38,38,0.15)',  dot: '#f87171',  label: 'Ошибка API' },
    idle:    { color: 'var(--text-muted)', bg: 'var(--surface2)', dot: 'var(--border)', label: 'Ожидание' },
  };
  const c = configs[isOffline ? 'error' : status] ?? configs.idle;

  const lastOkStr = lastOk
    ? new Date(lastOk).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : 'никогда';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '12px 16px', borderRadius: 10,
      background: c.bg, border: `1px solid ${c.dot}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: c.dot,
          boxShadow: status === 'ok' ? `0 0 6px ${c.dot}` : 'none',
          animation: status === 'loading' ? 'pulse 1s infinite' : 'none',
        }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.label}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Последнее обновление: <strong style={{ color: 'var(--text)' }}>{lastOkStr}</strong>
      </div>
    </div>
  );
}

/* ── Основная панель ──────────────────────────────────────── */
function AdminPanelContent() {
  const {
    settings, status, lastOk, isApiOffline, errorMsg,
    partners, snapshot, history,
    updateSettings, clearCache, refreshNow, DEFAULT_SETTINGS,
  } = useDataStore();

  const [saved, setSaved] = useState(false);

  const save = (patch) => {
    updateSettings(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Считаем размер кеша
  const cacheSize = (() => {
    try {
      const keys = ['dm_partners','dm_snapshot','dm_history','dm_last_ok'];
      const bytes = keys.reduce((acc, k) => acc + (localStorage.getItem(k)?.length ?? 0), 0);
      return bytes < 1024 ? `${bytes} B` : `${(bytes/1024).toFixed(1)} KB`;
    } catch { return '—'; }
  })();

  const historyEntries = Object.keys(history).length;

  return (
    <div style={{ maxWidth: 680, padding: '0 24px 40px 24px' }}>

      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          ⚙️ Настройки данных
        </h2>
        {saved && (
          <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
            ✓ Сохранено
          </span>
        )}
      </div>

      {/* Статус API */}
      <div style={{ marginBottom: 24 }}>
        <ApiStatusBadge status={status} lastOk={lastOk} isOffline={isApiOffline} />
        {errorMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Секция: Автообновление */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
          Автообновление
        </div>

        <SettingRow
          label="Интервал обновления"
          sub="Как часто опрашивать API для всех вкладок"
        >
          <SegmentControl
            value={settings.intervalMs}
            options={INTERVALS}
            onChange={(ms) => save({ intervalMs: ms })}
          />
        </SettingRow>

        <SettingRow
          label="Глубина истории"
          sub="За сколько дней загружать исторические данные"
        >
          <SegmentControl
            value={settings.historyDays}
            options={DAYS_OPTIONS}
            onChange={(d) => save({ historyDays: d })}
            valueKey={undefined}
            labelKey={undefined}
          />
        </SettingRow>

        <SettingRow
          label="Таймаут запроса"
          sub="Через сколько секунд считать запрос зависшим"
        >
          <SegmentControl
            value={settings.apiTimeoutMs}
            options={TIMEOUT_OPTIONS.map(ms => ({ ms, label: `${ms/1000}с` }))}
            onChange={(ms) => save({ apiTimeoutMs: ms })}
          />
        </SettingRow>

        <SettingRow
          label="Порог недоступности API"
          sub="Через какое время без ответа показывать баннер 'API недоступен'"
        >
          <SegmentControl
            value={settings.offlineThreshMs}
            options={OFFLINE_OPTIONS}
            onChange={(ms) => save({ offlineThreshMs: ms })}
          />
        </SettingRow>
      </div>

      {/* Секция: Действия */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
          Действия
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={refreshNow}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(99,102,241,0.2)', border: '1px solid var(--accent)',
              color: '#a5b4fc', cursor: 'pointer',
            }}
          >
            🔄 Обновить сейчас
          </button>
          <button
            onClick={() => {
              if (confirm('Очистить весь кеш? Данные будут загружены заново.')) clearCache();
            }}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)',
              color: '#f87171', cursor: 'pointer',
            }}
          >
            🗑 Очистить кеш
          </button>
          <button
            onClick={() => {
              updateSettings({ ...DEFAULT_SETTINGS });
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            ↩ Сбросить настройки
          </button>
        </div>
      </div>

      {/* Секция: Состояние кеша */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
          Состояние кеша
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))',
          gap: 10,
        }}>
          {[
            { label: 'Проектов',        value: partners.length },
            { label: 'Записей снепшота', value: snapshot.length },
            { label: 'Ключей истории',  value: historyEntries },
            { label: 'Размер кеша',     value: cacheSize },
            { label: 'Интервал',        value: settings.intervalMs === 0 ? 'Выкл.' : `${settings.intervalMs / 1000}с` },
            { label: 'История (дней)',   value: settings.historyDays },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Экспорт с PIN-защитой ────────────────────────────────── */
export default function AdminPanel() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(PIN_KEY) === '1'
  );

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <AdminPanelContent />;
}
