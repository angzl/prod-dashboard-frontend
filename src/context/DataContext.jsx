/**
 * DataContext — фронтовый стор.
 *
 * Стратегия:
 *   1. При старте читаем данные из localStorage (мгновенно показываем)
 *   2. Делаем ОДИН fetch с API чтобы синхронизировать свежие данные
 *   3. Далее опрашиваем только /api/cache/status (лёгкий эндпоинт)
 *      — если last_ok изменился → делаем полный fetch
 *   4. Никакого тяжёлого polling с фронта — вся нагрузка на бэкенд
 */
import React, {
  createContext, useContext, useEffect,
  useRef, useCallback, useReducer,
} from 'react';

/* ── localStorage ──────────────────────────────────────────── */
const LS = {
  PARTNERS:  'dm_partners',
  SNAPSHOT:  'dm_snapshot',
  HISTORY:   'dm_history',
  SETTINGS:  'dm_settings',
  LAST_OK:   'dm_last_ok',
};

const DEFAULT_SETTINGS = {
  pollStatusMs:    15_000,   // как часто фронт проверяет /api/cache/status
  historyDays:     30,
  offlineThreshMs: 300_000,  // 5 мин без ответа → показываем баннер
};

function lsGet(key, fallback = null) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ── Reducer ───────────────────────────────────────────────── */
const initialState = {
  partners:  lsGet(LS.PARTNERS, []),
  snapshot:  lsGet(LS.SNAPSHOT, []),
  history:   lsGet(LS.HISTORY,  {}),
  settings:  { ...DEFAULT_SETTINGS, ...lsGet(LS.SETTINGS, {}) },
  lastOk:    lsGet(LS.LAST_OK,  null),  // ISO — момент последнего успешного fetch
  serverLastOk: null,                   // last_ok с сервера (unix timestamp)
  status:    'idle',   // idle | loading | ok | error
  errorMsg:  null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload, errorMsg: action.error ?? null };

    case 'FETCH_OK': {
      const { partners, snapshot, historyKey, historyData, serverLastOk } = action.payload;
      const lastOk  = new Date().toISOString();
      const history = { ...state.history };
      if (historyKey && historyData !== undefined)
        history[historyKey] = historyData;

      if (partners !== undefined) lsSet(LS.PARTNERS, partners);
      if (snapshot  !== undefined) lsSet(LS.SNAPSHOT,  snapshot);
      if (historyKey) lsSet(LS.HISTORY, history);
      lsSet(LS.LAST_OK, lastOk);

      return {
        ...state,
        partners:     partners     ?? state.partners,
        snapshot:     snapshot     ?? state.snapshot,
        history,
        lastOk,
        serverLastOk: serverLastOk ?? state.serverLastOk,
        status:       'ok',
        errorMsg:     null,
      };
    }

    case 'SET_SERVER_LAST_OK':
      return { ...state, serverLastOk: action.payload };

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
      return { ...state, partners: [], snapshot: [], history: {}, lastOk: null, serverLastOk: null };
    }

    default: return state;
  }
}

/* ── Context ───────────────────────────────────────────────── */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const apiBase   = import.meta.env.VITE_API_URL || '';
  const [state, dispatch] = useReducer(reducer, initialState);
  const statusTimerRef    = useRef(null);
  const fetchingRef       = useRef(false);
  // Запоминаем last_ok с сервера который уже загружен
  const loadedServerTs    = useRef(null);

  /* ── Полный fetch данных с сервера ─────────────────────── */
  const fetchAll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    dispatch({ type: 'SET_STATUS', payload: 'loading' });

    try {
      // 1. Партнёры
      const pRes = await fetch(`${apiBase}/api/partners`);
      if (!pRes.ok) throw new Error(`partners ${pRes.status}`);
      const partners = await pRes.json();

      // 2. Снепшот
      const params = new URLSearchParams();
      partners.forEach(p => params.append('partners', p));
      const sRes = await fetch(`${apiBase}/api/snapshot?${params}`);
      if (!sRes.ok) throw new Error(`snapshot ${sRes.status}`);
      const snapshot = await sRes.json();

      dispatch({ type: 'FETCH_OK', payload: { partners, snapshot } });

      // 3. История — параллельно, не блокируем
      const { historyDays } = state.settings;
      partners.forEach(async partner => {
        try {
          const hRes = await fetch(
            `${apiBase}/api/history?partner=${encodeURIComponent(partner)}&days=${historyDays}`
          );
          if (!hRes.ok) return;
          const historyData = await hRes.json();
          dispatch({
            type: 'FETCH_OK',
            payload: { historyKey: `${partner}_${historyDays}`, historyData },
          });
        } catch {}
      });

    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: err.message });
    } finally {
      fetchingRef.current = false;
    }
  }, [apiBase, state.settings.historyDays]);

  /* ── Лёгкий опрос статуса кеша ─────────────────────────── */
  const pollStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${apiBase}/api/cache/status`);
      if (!res.ok) return;
      const data = await res.json();

      const serverTs = data.last_ok;  // unix float или null

      // Если сервер обновил данные с момента нашего последнего fetch → тянем
      if (serverTs && serverTs !== loadedServerTs.current) {
        loadedServerTs.current = serverTs;
        await fetchAll();
      } else {
        // Просто сохраняем серверный ts для индикации
        dispatch({ type: 'SET_SERVER_LAST_OK', payload: serverTs });
      }
    } catch {
      // Сеть упала — не меняем статус, данные из localStorage остаются
    }
  }, [apiBase, fetchAll]);

  /* ── Запуск: сначала fetchAll, потом polling статуса ────── */
  useEffect(() => {
    // Первичный fetch при монтировании
    fetchAll();

    // Polling статуса — лёгкий
    statusTimerRef.current = setInterval(pollStatus, state.settings.pollStatusMs);
    return () => clearInterval(statusTimerRef.current);
  }, []); // только при монтировании

  // Перезапускаем polling статуса при смене интервала
  useEffect(() => {
    clearInterval(statusTimerRef.current);
    statusTimerRef.current = setInterval(pollStatus, state.settings.pollStatusMs);
    return () => clearInterval(statusTimerRef.current);
  }, [state.settings.pollStatusMs, pollStatus]);

  /* ── Публичные методы ───────────────────────────────────── */
  const updateSettings = useCallback(async (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });

    // Отправляем на бэкенд
    const pin = sessionStorage.getItem('dm_admin_auth_pin') || '';
    const params = new URLSearchParams({ pin, ...patch });
    try {
      await fetch(`${apiBase}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
    } catch {}
  }, [apiBase]);

  const clearCache = useCallback(async () => {
    dispatch({ type: 'CLEAR_CACHE' });
    const pin = sessionStorage.getItem('dm_admin_auth_pin') || '';
    try {
      await fetch(`${apiBase}/api/admin/clear?pin=${pin}`, { method: 'POST' });
    } catch {}
  }, [apiBase]);

  const refreshNow = useCallback(async () => {
    // Просим сервер обновить кеш
    const pin = sessionStorage.getItem('dm_admin_auth_pin') || '';
    try {
      await fetch(`${apiBase}/api/admin/refresh?pin=${pin}`, { method: 'POST' });
    } catch {}
    // И тянем свежие данные
    await fetchAll();
  }, [apiBase, fetchAll]);

  const getHistory = (partner, days) =>
    state.history[`${partner}_${days}`] ?? null;

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
