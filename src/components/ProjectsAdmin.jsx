import React, { useState, useEffect } from 'react';
import { useDataStore } from '../context/DataContext';

/* ── Управление инсталяциями и БД (projects.json) ──────────────
 * Карточки проектов (прод/инсталяции) + редактор:
 * - имя, категория, sg_version, флаг мониторинга;
 * - SSH-туннель (host/port/username/путь до ключа);
 * - список БД (SG/SG2/MS/MS2) с добавлением/удалением строк;
 * - «Проверить подключение» (до сохранения), «Сохранить»,
 *   «Удалить», «Сделать активным».
 * Пароли приходят с сервера замаскированными ('***'):
 * пустое поле / '***' при сохранении = «не менять».
 */

const DB_TYPES = ['SG', 'SG2', 'MS', 'MS2'];

const emptyDb = () => ({
  name: '', type: 'SG', host: '', port: 5432, database: '',
  user: '', password: '', devreg_database: '',
});

const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '6px 8px', fontSize: 12, color: 'var(--text)', width: '100%',
  boxSizing: 'border-box',
};
const labelStyle = {
  fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: 3, display: 'block',
};

/* ── Редактор одного проекта ─────────────────────────────────── */
function ProjectEditor({ initial, onDone, onCancel, apiBase, pin }) {
  const isNew = !initial?.name;
  const [p, setP] = useState(() => ({
    name: initial?.name || '',
    category: initial?.category || 'installation',
    use_ssh: !!initial?.use_ssh,
    sg_version: initial?.sg_version || 1,
    monitor: initial?.monitor !== false,
    ssh: { host: '', port: 22, username: '', private_key: '', passphrase: '', ...(initial?.ssh || {}) },
    databases: (initial?.databases?.length ? initial.databases : [emptyDb()]),
  }));
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const setDb = (i, patch) => setP((x) => ({
    ...x, databases: x.databases.map((d, j) => (j === i ? { ...d, ...patch } : d)),
  }));

  const test = async () => {
    setTesting(true); setTestResult(null); setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/projects/test?pin=${pin}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setTestResult(data.result);
    } catch (e) {
      setMsg({ type: 'error', text: `Ошибка теста: ${e.message}` });
    } finally { setTesting(false); }
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/admin/projects?pin=${pin}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      onDone(data.project);
    } catch (e) {
      setMsg({ type: 'error', text: `Ошибка сохранения: ${e.message}` });
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 14, marginBottom: 10,
    }}>
      {/* Основные поля */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px,1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <span style={labelStyle}>Название</span>
          <input style={inputStyle} value={p.name} disabled={!isNew}
            onChange={(e) => set({ name: e.target.value })} placeholder="Чита" />
        </div>
        <div>
          <span style={labelStyle}>Категория</span>
          <select style={inputStyle} value={p.category}
            onChange={(e) => set({ category: e.target.value })}>
            <option value="installation">installation</option>
            <option value="prod">prod</option>
          </select>
        </div>
        <div>
          <span style={labelStyle}>Версия SG</span>
          <select style={inputStyle} value={p.sg_version}
            onChange={(e) => set({ sg_version: Number(e.target.value) })}>
            <option value={1}>1 (БС из SG)</option>
            <option value={2}>2 (БС из SG2)</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
          <input type="checkbox" id="mon" checked={p.monitor}
            onChange={(e) => set({ monitor: e.target.checked })} />
          <label htmlFor="mon" style={{ fontSize: 12, color: 'var(--text)' }}>
            мониторить (фоновые срезы)
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 16 }}>
          <input type="checkbox" id="ssh" checked={p.use_ssh}
            onChange={(e) => set({ use_ssh: e.target.checked })} />
          <label htmlFor="ssh" style={{ fontSize: 12, color: 'var(--text)' }}>
            SSH-туннель
          </label>
        </div>
      </div>

      {/* SSH */}
      {p.use_ssh && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 10, marginBottom: 12,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 10,
        }}>
          <div>
            <span style={labelStyle}>SSH host</span>
            <input style={inputStyle} value={p.ssh.host || ''}
              onChange={(e) => set({ ssh: { ...p.ssh, host: e.target.value } })} />
          </div>
          <div>
            <span style={labelStyle}>SSH port</span>
            <input style={inputStyle} type="number" value={p.ssh.port || 22}
              onChange={(e) => set({ ssh: { ...p.ssh, port: Number(e.target.value) } })} />
          </div>
          <div>
            <span style={labelStyle}>Пользователь</span>
            <input style={inputStyle} value={p.ssh.username || ''}
              onChange={(e) => set({ ssh: { ...p.ssh, username: e.target.value } })} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <span style={labelStyle}>Путь до приватного ключа (на сервере бота)</span>
            <input style={inputStyle} value={p.ssh.private_key || ''}
              placeholder="C:\Users\serverorp\.ssh\support-keys\chita-support-key"
              onChange={(e) => set({ ssh: { ...p.ssh, private_key: e.target.value } })} />
          </div>
        </div>
      )}

      {/* Таблица БД */}
      <span style={labelStyle}>Базы данных</span>
      {p.databases.map((d, i) => (
        <div key={i} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 10, marginBottom: 6,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 8,
          position: 'relative',
        }}>
          <button
            title="Удалить БД"
            onClick={() => setP((x) => ({ ...x, databases: x.databases.filter((_, j) => j !== i) }))}
            style={{
              position: 'absolute', top: 6, right: 6, width: 20, height: 20,
              borderRadius: 5, border: '1px solid rgba(220,38,38,0.35)',
              background: 'rgba(220,38,38,0.12)', color: '#f87171',
              fontSize: 12, cursor: 'pointer', lineHeight: 1,
            }}>✕</button>
          <div>
            <span style={labelStyle}>Название</span>
            <input style={inputStyle} value={d.name || ''}
              onChange={(e) => setDb(i, { name: e.target.value })} placeholder="SG DB" />
          </div>
          <div>
            <span style={labelStyle}>Тип</span>
            <select style={inputStyle} value={d.type || 'SG'}
              onChange={(e) => setDb(i, { type: e.target.value })}>
              {DB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Host</span>
            <input style={inputStyle} value={d.host || ''}
              onChange={(e) => setDb(i, { host: e.target.value })} />
          </div>
          <div>
            <span style={labelStyle}>Port</span>
            <input style={inputStyle} type="number" value={d.port || 5432}
              onChange={(e) => setDb(i, { port: Number(e.target.value) })} />
          </div>
          <div>
            <span style={labelStyle}>База</span>
            <input style={inputStyle} value={d.database || ''}
              onChange={(e) => setDb(i, { database: e.target.value })} placeholder="nwksrvdb" />
          </div>
          <div>
            <span style={labelStyle}>Пользователь</span>
            <input style={inputStyle} value={d.user || ''}
              onChange={(e) => setDb(i, { user: e.target.value })} />
          </div>
          <div>
            <span style={labelStyle}>Пароль</span>
            <input style={inputStyle} type="password" value={d.password || ''}
              placeholder={d.password === '***' ? 'не менять' : ''}
              onChange={(e) => setDb(i, { password: e.target.value })} />
          </div>
          {d.type === 'SG' && (
            <div>
              <span style={labelStyle}>Devreg БД</span>
              <input style={inputStyle} value={d.devreg_database || ''}
                placeholder="devregsrvdb"
                onChange={(e) => setDb(i, { devreg_database: e.target.value })} />
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() => setP((x) => ({ ...x, databases: [...x.databases, emptyDb()] }))}
        style={{
          padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: 'var(--surface2)', border: '1px dashed var(--border)',
          color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 12,
        }}>+ Добавить БД</button>

      {/* Результат теста */}
      {testResult && (
        <div style={{
          background: 'var(--surface)',
          border: `1px solid ${testResult.ok ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
          borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12,
        }}>
          <b>{testResult.ok ? '✅ Подключение успешно' : '❌ Есть проблемы'}</b>
          {testResult.ssh && <div style={{ marginTop: 4 }}>SSH: {testResult.ssh}</div>}
          {testResult.databases.map((d) => (
            <div key={d.type} style={{ marginTop: 2, color: d.status === 'OK' ? '#4ade80' : '#f87171' }}>
              {d.status === 'OK' ? '✓' : '✗'} {d.type} ({d.name}): {d.status}
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div style={{
          fontSize: 12, marginBottom: 8, padding: '6px 10px', borderRadius: 6,
          color: msg.type === 'error' ? '#f87171' : '#4ade80',
          background: msg.type === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(74,222,128,0.08)',
        }}>{msg.text}</div>
      )}

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={test} disabled={testing}
          style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: 'rgba(99,102,241,0.2)', border: '1px solid #6366f1',
            color: '#a5b4fc', cursor: 'pointer',
          }}>{testing ? '⏳ Проверка...' : '🔌 Проверить подключение'}</button>
        <button onClick={save} disabled={saving}
          style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.45)',
            color: '#4ade80', cursor: 'pointer',
          }}>{saving ? '⏳ Сохранение...' : '💾 Сохранить'}</button>
        <button onClick={onCancel}
          style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}>Отмена</button>
      </div>
    </div>
  );
}


/* ── Основная секция: карточки проектов ──────────────────────── */
export default function ProjectsAdminSection() {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const { refreshNow } = useDataStore();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | {} (новый) | проект
  const [msg, setMsg] = useState(null);

  const pin = () => sessionStorage.getItem('dm_admin_auth_pin') || '';

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/projects?pin=${pin()}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      setMsg({ type: 'error', text: 'Не удалось загрузить список проектов' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const remove = async (name) => {
    if (!confirm(`Удалить проект «${name}»? Действие необратимо.`)) return;
    try {
      const res = await fetch(
        `${apiBase}/api/admin/projects/${encodeURIComponent(name)}?pin=${pin()}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setMsg({ type: 'ok', text: `Проект «${name}» удалён` });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  };


  const onSaved = (project) => {
    setEditing(null);
    setMsg({ type: 'ok', text: `Проект «${project.name}» сохранён` });
    load();
    // дать бэкенду секунду на пересоздание клиента, затем подтянуть данные
    setTimeout(() => refreshNow(), 1500);
  };

  const catBadge = (c) => c === 'prod'
    ? { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }
    : { background: 'rgba(251,191,36,0.12)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.35)' };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
        Инсталяции и БД
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Подключения к прод и инсталяциям (projects.json). Инсталяции мониторятся
        фоновыми срезами (агрегатом по всей инсталяции), прод — по партнёрам.
        «Активный» — чей контекст показывает бот.
      </div>

      {msg && (
        <div style={{
          fontSize: 12, marginBottom: 10, padding: '6px 10px', borderRadius: 6,
          color: msg.type === 'error' ? '#f87171' : '#4ade80',
          background: msg.type === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(74,222,128,0.08)',
        }}>{msg.text}</div>
      )}

      {editing !== null && (
        <ProjectEditor
          initial={editing.name ? editing : {}}
          apiBase={apiBase}
          pin={pin()}
          onDone={onSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Загрузка…</div>
      ) : (
        <>
          {projects.map((p) => (
            <div key={p.name} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 14 }}>{p.active ? '●' : '○'}</span>
              <b style={{ fontSize: 13, color: 'var(--text)' }}>{p.name}</b>
              <span style={{
                ...catBadge(p.category), fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
              }}>{p.category}</span>
              {p.use_ssh && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  SSH: {p.ssh?.host}:{p.ssh?.port}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {p.databases.map((d) => d.type).join(' · ') || 'нет БД'}
                {p.monitor === false ? ' · мониторинг выкл' : ''}
              </span>
              <span style={{ flex: 1 }} />
              <button onClick={() => setEditing(p)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
                  color: '#a5b4fc', cursor: 'pointer',
                }}>Изменить</button>
              <button onClick={() => remove(p.name)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)',
                  color: '#f87171', cursor: 'pointer',
                }}>Удалить</button>
            </div>
          ))}
          <button onClick={() => setEditing({})}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)',
              color: '#4ade80', cursor: 'pointer',
            }}>+ Добавить инсталяцию</button>
        </>
      )}
    </div>
  );
}
