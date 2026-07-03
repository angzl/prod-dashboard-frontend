/**
 * DataContext — фронтовый стор.
 *
 * Стратегия (push-модель, без polling):
 *   1. При старте читаем данные из localStorage (мгновенно показываем)
 *   2. Открываем ОДНО SSE-соединение (/api/stream) на всё время работы страницы
 *   3. Сервер САМ присылает новые данные, как только его внутренний кеш
 *      обновился (раз в interval_seconds на бэкенде) — никаких повторных
 *      HTTP-запросов с фронта не требуется, независимо от числа открытых вкладок
 *   4. При разрыве соединения браузер (EventSource) автоматически переподключается
 */
import React, {
  createContext, useContext, useEffect,
  useRef, useCallback, useReducer,
} from 'react';

/* ── localStorage ──────────────────────────────────────────── */
const LS = {
  PARTNERS:      'dm_partners',
  SNAPSHOT:      'dm_snapshot',
  HISTORY:       'dm_history',
  TIMELINE:      'dm_timeline',
  SETTINGS:      'dm_settings',
  LAST_OK:       'dm_last_ok',
  SERVER_LAST_OK:'dm_server_last_ok',
};

const DEFAULT_SETTINGS = {
  historyDays:     30,
  offlineThreshMs: 300_000,  // сколько без сообщений от сервера → баннер "недоступен"
  intervalMs:      60_000,   // интервал обновления кеша НА СЕРВЕРЕ (для AdminPanel)
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
  timeline:  lsGet(LS.TIMELINE, { columns: [], data: {}, ranges: {} }),
  settings:  { ...DEFAULT_SETTINGS, ...lsGet(LS.SETTINGS, {}) },
  lastOk:    lsGet(LS.LAST_OK,  null),  // ISO — момент последнего полученного сообщения от сервера
  serverLastOk: lsGet(LS.SERVER_LAST_OK, null),  // last_ok с сервера (unix timestamp)
  status:    'idle',   // idle | loading | ok | error
  errorMsg:  null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload, errorMsg: action.error ?? null };

    /** Пришло сообщение из SSE-стрима — полный снимок данных с сервера */
    case 'STREAM_OK': {
      const { partners, snapshot, history, timeline, serverLastOk } = action.payload;

      // Если серверный last_ok не изменился и у нас уже есть данные —
      // это повторная отправка того же снимка (например, при переподключении
      // или обновлении страницы). Не обновляем state и не перезаписываем
      // lastOk, чтобы избежать ненужных ре-рендеров и «прыжков» таймстампа.
      if (
        serverLastOk !== undefined &&
        serverLastOk === state.serverLastOk &&
        (state.partners?.length || state.snapshot?.length)
      ) {
        return {
          ...state,
          status:   'ok',
          errorMsg: null,
        };
      }

      const lastOk = new Date().toISOString();

      if (partners !== undefined) lsSet(LS.PARTNERS, partners);
      if (snapshot  !== undefined) lsSet(LS.SNAPSHOT,  snapshot);
      if (history   !== undefined) lsSet(LS.HISTORY,   history);
      if (timeline  !== undefined) lsSet(LS.TIMELINE,  timeline);
      lsSet(LS.LAST_OK, lastOk);
      if (serverLastOk !== undefined) lsSet(LS.SERVER_LAST_OK, serverLastOk);

      return {
        ...state,
        partners:     partners     ?? state.partners,
        snapshot:     snapshot     ?? state.snapshot,
        history:      history      ?? state.history,
        timeline:     timeline     ?? state.timeline,
        lastOk,
        serverLastOk: serverLastOk ?? state.serverLastOk,
        status:       'ok',
        errorMsg:     null,
      };
    }

    case 'STREAM_ERROR':
      return { ...state, status: 'error', errorMsg: action.payload };

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.settings, ...action.payload };
      lsSet(LS.SETTINGS, settings);
      return { ...state, settings };
    }

    case 'CLEAR_CACHE': {
      [LS.PARTNERS, LS.SNAPSHOT, LS.HISTORY, LS.TIMELINE, LS.LAST_OK, LS.SERVER_LAST_OK].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
      return {
        ...state,
        partners: [],
        snapshot: [],
        history: {},
        timeline: { columns: [], data: {}, ranges: {} },
        lastOk: null,
        serverLastOk: null,
      };
    }

    default: return state;
  }
}

/* ── Context ───────────────────────────────────────────────── */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const apiBase   = import.meta.env.VITE_API_URL || '';
  const [state, dispatch] = useReducer(reducer, initialState);
  const esRef        = useRef(null);
  const reconnectRef  = useRef(null);

  /* ── Обработка одного сообщения из SSE-потока ──────────────── */
  const handleMessage = useCallback((ev) => {
    try {
      const data = JSON.parse(ev.data);
      dispatch({
        type: 'STREAM_OK',
        payload: {
          partners:     data.partners,
          snapshot:     data.snapshot,
          history:      data.history,
          timeline:     data.timeline,
          serverLastOk: data.last_ok,
        },
      });
    } catch {
      // Игнорируем битое сообщение — следующее придёт штатно
    }
  }, []);

  /* ── Подключение / переподключение SSE ─────────────────────── */
  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // Не показываем 'loading', если у нас уже есть закешированные данные —
    // иначе при обновлении страницы весь UI мигает спиннерами, хотя данные
    // уже есть в localStorage и покажутся мгновенно.
    const hasCached =
      lsGet(LS.PARTNERS, []).length > 0 || lsGet(LS.SNAPSHOT, []).length > 0;
    if (!hasCached) {
      dispatch({ type: 'SET_STATUS', payload: 'loading' });
    }

    const es = new EventSource(`${apiBase}/api/stream`);
    esRef.current = es;

    es.onmessage = handleMessage;

    es.onerror = () => {
      // EventSource сам будет пытаться переподключиться, но на всякий случай
      // подстрахуемся ручным reconnect, если браузер закрыл соединение совсем.
      dispatch({ type: 'STREAM_ERROR', payload: 'Соединение с сервером потеряно' });
      if (es.readyState === EventSource.CLOSED) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };
  }, [apiBase, handleMessage]);

  /* ── Запуск при монтировании ───────────────────────────────── */
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      if (esRef.current) esRef.current.close();
    };
  }, [connect]);

  /* ── Публичные методы ───────────────────────────────────────── */
  const updateSettings = useCallback(async (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });

    // Отправляем на бэкенд (интервал обновления кеша / глубина истории)
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
    // Просим сервер обновить кеш — свежие данные придут через SSE автоматически
    const pin = sessionStorage.getItem('dm_admin_auth_pin') || '';
    try {
      await fetch(`${apiBase}/api/admin/refresh?pin=${pin}`, { method: 'POST' });
    } catch {}
  }, [apiBase]);

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
