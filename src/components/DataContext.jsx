/**
 * DataContext — глобальный стор данных с:
 *  - polling (автообновление по интервалу)
 *  - localStorage кеш (переживает обновление страницы и падение API)
 *  - статус API (online / offline / updating)
 *  - история запросов (время последнего успешного обновления)
 */
import React, { createContext, useContext, useEffect, useRef, useCallback, useReducer } from 'react';

/* ── Ключи localStorage ───────────────────────────────────── */
const LS = {
  PARTNERS:  'dm_partners',
  SNAPSHOT:  'dm_snapshot',
  HISTORY:   'dm_history',   // { [partner]: { [days]: data } }
  SETTINGS:  'dm_settings',
  LAST_OK:   'dm_last_ok',   // ISO timestamp последнего успешного fetch
};

/* ── Настройки по умолчанию ───────────────────────────────── */
const DEFAULT_SETTINGS = {
  intervalMs:      60_000,   // 1 минута
  historyDays:     30,
  apiTimeoutMs:    10_000,   // считаем API упавшим если нет ответа 10с
  offlineThreshMs: 120_000,  // показываем "API недоступен" если нет ответа 2 мин
};

/* ── Утилиты localStorage ─────────────────────────────────── */
function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ── Reducer ──────────────────────────────────────────────── */
const initialState = {
  partners:   lsGet(LS.PARTNERS,  []),
  snapshot:   lsGet(LS.SNAPSHOT,  []),
  history:    lsGet(LS.HISTORY,   {}),
  settings:   { ...DEFAULT_SETTINGS, ...lsGet(LS.SETTINGS, {}) },
  lastOk:     lsGet(LS.LAST_OK,   null),  // ISO string
  status:     'idle',   // idle | loading | ok | error
  errorMsg:   null,
};

function reducer(state, action) {
  switch (action.type) {

    case 'SET_STATUS':
      return { ...state, status: action.payload, errorMsg: action.error ?? null };

    case 'FETCH_OK': {
      const { partners, snapshot, historyKey, historyData } = action.payload;
      const lastOk = new Date().toISOString();

      // Обновляем историю точечно: { partner_days: data }
      const history = { ...state.history };
      if (historyKey && historyData !== undefined) {
        history[historyKey] = historyData;
      }

      // Сохраняем в localStorage
      if (partners !== undefined) lsSet(LS.PARTNERS, partners);
      if (snapshot  !== undefined) lsSet(LS.SNAPSHOT,  snapshot);
      if (historyKey) lsSet(LS.HISTORY, history);
      lsSet(LS.LAST_OK, lastOk);

      return {
        ...state,
        partners:  partners  ?? state.partners,
        snapshot:  snapshot  ?? state.snapshot,
        history,
        lastOk,
        status:    'ok',
        errorMsg:  null,
      };
    }

    case 'FETCH_ERROR':
      return { ...state, status: 'error', errorMsg: action.payload };

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.settings, ...action.payload };
      lsSet(LS.SETTINGS, settings);
      return { ...state, settings };
    }

    case 'CLEAR_CACHE': {
      [LS.PARTNERS, LS.SNAPSHOT, LS.HISTORY, LS.LAST_OK].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
      return {
        ...state,
        partners: [], snapshot: [], history: {},
        lastOk: null, status: 'idle', errorMsg: null,
      };
    }

    default: return state;
  }
}

/* ── Context ──────────────────────────────────────────────── */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const [state, dispatch] = useReducer(reducer, initialState);
  const timerRef    = useRef(null);
  const fetchingRef = useRef(false);

  /* ── Основной fetch цикл ───────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    dispatch({ type: 'SET_STATUS', payload: 'loading' });

    const { apiTimeoutMs, historyDays } = state.settings;

    try {
      const ctrl = new AbortController();
      const to   = setTimeout(() => ctrl.abort(), apiTimeoutMs);

      // 1. Список проектов
      const pRes  = await fetch(`${apiBase}/api/partners`, { signal: ctrl.signal });
      if (!pRes.ok) throw new Error(`partners: ${pRes.status}`);
      const partners = await pRes.json();

      // 2. Снепшот всех проектов
      const params = new URLSearchParams();
      partners.forEach(p => params.append('partners', p));
      const sRes = await fetch(`${apiBase}/api/snapshot?${params}`, { signal: ctrl.signal });
      if (!sRes.ok) throw new Error(`snapshot: ${sRes.status}`);
      const snapshot = await sRes.json();

      clearTimeout(to);

      dispatch({ type: 'FETCH_OK', payload: { partners, snapshot } });

      // 3. История по каждому проекту (параллельно, НЕ блокируем основной статус)
      partners.forEach(async (partner) => {
        const key = `${partner}_${historyDays}`;
        try {
          const hRes = await fetch(
            `${apiBase}/api/history?partner=${encodeURIComponent(partner)}&days=${historyDays}`
          );
          if (!hRes.ok) return;
          const historyData = await hRes.json();
          dispatch({ type: 'FETCH_OK', payload: { historyKey: key, historyData } });
        } catch {}
      });

    } catch (err) {
      if (err.name === 'AbortError') {
        dispatch({ type: 'FETCH_ERROR', payload: 'Таймаут запроса к API' });
      } else {
        dispatch({ type: 'FETCH_ERROR', payload: err.message });
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [apiBase, state.settings.apiTimeoutMs, state.settings.historyDays]);

  /* ── Запуск polling ────────────────────────────────────── */
  const startPolling = useCallback(() => {
    stopPolling();
    fetchAll(); // сразу
    timerRef.current = setInterval(fetchAll, state.settings.intervalMs);
  }, [fetchAll, state.settings.intervalMs]);

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // При монтировании и при смене настроек — перезапускаем polling
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [state.settings.intervalMs, state.settings.historyDays]);

  /* ── Публичные методы ──────────────────────────────────── */
  const updateSettings = (patch) => dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
  const clearCache     = ()      => dispatch({ type: 'CLEAR_CACHE' });
  const refreshNow     = ()      => { stopPolling(); startPolling(); };

  // Хелпер: получить историю из кеша
  const getHistory = (partner, days) =>
    state.history[`${partner}_${days}`] ?? null;

  // Статус API: если последний успешный fetch был давно — считаем offline
  const isApiOffline = (() => {
    if (state.status === 'ok') return false;
    if (!state.lastOk)         return state.status === 'error';
    return Date.now() - new Date(state.lastOk).getTime() > state.settings.offlineThreshMs;
  })();

  const value = {
    ...state,
    isApiOffline,
    getHistory,
    updateSettings,
    clearCache,
    refreshNow,
    DEFAULT_SETTINGS,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataStore must be used inside DataProvider');
  return ctx;
}
