import React, { useState, useEffect } from 'react';
import { useDataStore } from '../context/DataContext';

/* ── PIN-защита ───────────────────────────────────────────── */
const PIN_KEY     = 'dm_admin_auth';
const PIN_STORE   = 'dm_admin_auth_pin';   // храним сам PIN для запросов к API
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
        sessionStorage.setItem(PIN_KEY,   '1');
        sessionStorage.setItem(PIN_STORE, next);  // сохраняем для API запросов
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
// Интервал обновления на СЕРВЕРЕ (как часто бэкенд ходит в БД)
const SERVER_INTERVALS = [
  { label: '30 сек',  ms: 30_000 },
  { label: '1 мин',   ms: 60_000 },
  { label: '2 мин',   ms: 120_000 },
  { label: '5 мин',   ms: 300_000 },
  { label: '10 мин',  ms: 600_000 },
  { label: '30 мин',  ms: 1_800_000 },
];

// Для обратной совместимости

const INTERVALS = SERVER_INTERVALS;

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

/* ── Управление проектами мониторинга (два блока) ────────────
 *
 * Левый блок  — ВСЕ овнеры из продакшен-БД (кроме уже добавленных);
 *               кнопка «Обновить из БД» перечитывает список овнеров.
 * Правый блок — проекты, находящиеся в мониторинге. У каждого два
 *               элемента управления:
 *                 • флажок «не приоритет» (такие проекты скрыты на
 *                   дашборде за кнопкой «Показать все проекты»);
 *                 • кнопка удаления из мониторинга.
 * Внизу — «Сохранить»: список уходит в monitored_projects.json,
 * сервер сразу снимает срез новых проектов и пушит данные по SSE.
 */
function MonitoredProjectsSection() {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const { refreshNow } = useDataStore();

  const [owners, setOwners]         = useState([]);        // все овнеры из БД
  const [monitored, setMonitored]   = useState([]);        // [{name, priority}]
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [dirty, setDirty]           = useState(false);
  const [msg, setMsg]               = useState(null);

  const pin = () => sessionStorage.getItem('dm_admin_auth_pin') || '';

  const loadData = async (refreshOwners = false) => {
    setLoading(true);
    try {
      const [ownersRes, monRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/owners?pin=${pin()}${refreshOwners ? '&refresh=true' : ''}`),
        fetch(`${apiBase}/api/admin/monitored?pin=${pin()}`),
      ]);
      const ownersData = await ownersRes.json();
      const monData    = await monRes.json();
      setOwners(ownersData.owners || []);
      setMonitored((monData.projects || []).map(p => ({
        name: p.name, priority: p.priority !== false,
      })));
      setDirty(false);
    } catch {
      setMsg({ type: 'error', text: 'Не удалось загрузить список проектов' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(false); /* eslint-disable-line */ }, []);

  const monitoredNames = new Set(monitored.map(p => p.name));
  const available = owners.filter(o => !monitoredNames.has(o));

  const q = search.trim().toLowerCase();
  const filteredAvailable = q ? available.filter(o => o.toLowerCase().includes(q)) : available;

  const addToMonitored = (name) => {
    setMonitored(m => [...m, { name, priority: true }]);
    setDirty(true);
  };

  const removeFromMonitored = (name) => {
    setMonitored(m => m.filter(p => p.name !== name));
    setDirty(true);
  };

  const togglePriority = (name) => {
    setMonitored(m => m.map(p => p.name === name ? { ...p, priority: !p.priority } : p));
    setDirty(true);
  };

  const save = async () => {
    if (monitored.length === 0) {
      if (!confirm('Список мониторинга пуст — сохранить пустым?')) return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/monitored?pin=${pin()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: monitored }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDirty(false);
      setMsg({ type: 'ok', text: '✅ Сохранено. Срез новых проектов снимается, данные появятся через несколько секунд.' });
      // Подтянуть обновлённый список партнёров в общий стор
      setTimeout(() => refreshNow(), 1500);
    } catch (e) {
      setMsg({ type: 'error', text: `Ошибка сохранения: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  const boxStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 12, minHeight: 260, maxHeight: 420,
    overflowY: 'auto', flex: '1 1 280px',
  };
  const listRowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '7px 10px', borderRadius: 7,
    background: 'var(--surface)', border: '1px solid var(--border)',
    marginBottom: 6, fontSize: 13,
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
        Проекты в мониторинге
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Слева — все овнеры из продакшен-БД, справа — проекты мониторинга.
        Флажок «не приоритет» скрывает проект в сводках за кнопкой «Показать все проекты».
        Мониторинг всех проектов (срез в локальную БД) выполняется каждые 3 часа.
      </div>

      {/* Панель поиска + обновления овнеров */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Поиск овнера..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 220px', padding: '7px 12px', borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => loadData(true)}
          disabled={loading}
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          {loading ? '⏳ Загрузка...' : '🔄 Обновить список из БД'}
        </button>
      </div>

      {/* Два блока */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Левый: доступные */}
        <div style={boxStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            📦 Доступные овнеры ({filteredAvailable.length})
          </div>
          {filteredAvailable.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              Нет доступных проектов
            </div>
          )}
          {filteredAvailable.map(name => (
            <div key={name} style={listRowStyle}>
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              <button
                onClick={() => addToMonitored(name)}
                title="Добавить в мониторинг"
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                  color: '#a5b4fc', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ➕
              </button>
            </div>
          ))}
        </div>

        {/* Правый: в мониторинге */}
        <div style={boxStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            📡 В мониторинге ({monitored.length})
          </div>
          {monitored.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              Добавьте проекты из левого блока
            </div>
          )}
          {monitored.map(p => (
            <div key={p.name} style={listRowStyle}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                overflow: 'hidden', flex: 1, userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={p.priority}
                  onChange={() => togglePriority(p.name)}
                  title={p.priority ? 'Приоритетный (виден сразу)' : '«Не приоритет» — скрыт за кнопкой «Показать все»'}
                  style={{ accentColor: '#6366f1', width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{
                  color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', fontWeight: p.priority ? 600 : 400,
                  fontStyle: p.priority ? 'normal' : 'italic',
                }}>
                  {p.name}
                </span>
                {!p.priority && (
                  <span style={{ fontSize: 10, color: '#fcd34d', flexShrink: 0 }} title="Не приоритет">
                    ○ не приоритет
                  </span>
                )}
              </label>
              <button
                onClick={() => removeFromMonitored(p.name)}
                title="Убрать из мониторинга"
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)',
                  color: '#f87171', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Сохранение */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <button
          onClick={save}
          disabled={saving || loading || !dirty}
          style={{
            padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: dirty && !saving ? 'rgba(99,102,241,0.25)' : 'var(--surface2)',
            border: `1px solid ${dirty && !saving ? 'var(--accent)' : 'var(--border)'}`,
            color: dirty && !saving ? '#a5b4fc' : 'var(--text-muted)',
            cursor: dirty && !saving ? 'pointer' : 'default',
          }}
        >
          {saving ? '⏳ Сохранение и срез данных...' : '💾 Сохранить'}
        </button>
        {dirty && (
          <span style={{ fontSize: 12, color: '#fcd34d' }}>● Есть несохранённые изменения</span>
        )}
        {msg && (
          <span style={{ fontSize: 12, color: msg.type === 'ok' ? '#4ade80' : '#f87171' }}>
            {msg.text}
          </span>
        )}
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
          Серверное обновление
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Бэкенд опрашивает БД по расписанию. Все пользователи получают обновления
          через push-соединение (SSE) — сколько бы вкладок ни было открыто,
          ни к БД, ни к API никаких повторных запросов с фронта не идёт.
        </div>


        <SettingRow
          label="Интервал обновления на сервере"
          sub="Как часто бэкенд ходит в БД и обновляет кеш"
        >
          <SegmentControl
            value={settings.intervalMs}
            options={SERVER_INTERVALS}
            onChange={(ms) => save({ intervalMs: ms, interval_seconds: Math.round(ms / 1000) })}
          />
        </SettingRow>

        <SettingRow
          label="Глубина истории"

          sub="За сколько дней загружать исторические данные"
        >
          <SegmentControl
            value={settings.historyDays}
            options={DAYS_OPTIONS}
            onChange={(d) => save({ historyDays: d, history_days: d })}
            valueKey={undefined}
            labelKey={undefined}
          />
        </SettingRow>

        <SettingRow
          label="Порог баннера 'API недоступен'"
          sub="Через какое время без ответа показывать предупреждение"
        >
          <SegmentControl
            value={settings.offlineThreshMs}
            options={OFFLINE_OPTIONS}
            onChange={(ms) => save({ offlineThreshMs: ms })}
          />
        </SettingRow>
      </div>

      {/* Секция: Проекты мониторинга (два блока) */}
      <MonitoredProjectsSection />

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
