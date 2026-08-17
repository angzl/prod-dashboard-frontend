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

  /* ── Применить полный снимок данных с сервера (SSE или HTTP) ── */
  const applyServerPayload = useCallback((data) => {
    if (!data) return;
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
  }, []);

  /* ── Обработка одного сообщения из SSE-потока ──────────────── */
  const handleMessage = useCallback((ev) => {
    try {
      applyServerPayload(JSON.parse(ev.data));
    } catch {
      // Игнорируем битое сообщение — следующее придёт штатно
    }
  }, [applyServerPayload]);

  /* ── HTTP-fallback: полный снимок одним GET /api/all ──────────
   * Страховка на случай, если SSE-стрим не работает (буферизующий
   * прокси, оборванный туннель, «зависшее» соединение). Сервер при
   * этом сам обновит кеш, если он устарел (ensure_fresh на бэкенде),
   * поэтому пользователь гарантированно получает свежие данные. */
  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/all`);
      if (!res.ok) return;
      applyServerPayload(await res.json());
    } catch {
      // Сервер недоступен — останемся на локальном кеше
    }
  }, [apiBase, applyServerPayload]);

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

    // Страховка при заходе: даже если SSE молчит/буферизуется прокси,
    // свежий снимок придёт обычным HTTP-запросом (idempotent — reducer
    // пропустит дубликат с тем же serverLastOk).
    fetchAll();

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

  /* ── freshness refs (для watchdog / visibilitychange) ───────── */
  const lastOkRef = useRef(state.lastOk);
  useEffect(() => { lastOkRef.current = state.lastOk; }, [state.lastOk]);

  /* ── Возврат на вкладку → сразу подтянуть свежие данные ───────
   * Главный кейс «старые данные при заходе»: пользователь возвращается
   * на страницу через несколько часов, а SSE-соединение давно умерло
   * (или было прибито прокси). Без этого данные остались бы
   * с прошлого захода из localStorage. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const last = lastOkRef.current;
      const ageMs = last ? Date.now() - new Date(last).getTime() : Infinity;
      if (ageMs > 60_000) fetchAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchAll]);

  /* ── Watchdog: SSE молчит слишком долго → HTTP-fallback ─────── */
  useEffect(() => {
    const id = setInterval(() => {
      const last = lastOkRef.current;
      const ageMs = last ? Date.now() - new Date(last).getTime() : Infinity;
      const limit = Math.max(state.settings.intervalMs, 60_000) + 60_000;
      if (ageMs > limit) fetchAll();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchAll, state.settings.intervalMs]);

  /* ── Публичные методы ───────────────────────────────────────── */
  const updateSettings = useCallback(async (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });

    // Отправляем на бэкенд (интервал обновления кеша / глубина истории).
    // Бэкенд ждёт pin, interval_seconds, history_days как QUERY-параметры,
    // а не в теле запроса — иначе FastAPI возвращает 422.
    const pin = sessionStorage.getItem('dm_admin_auth_pin') || '';
    const params = new URLSearchParams({ pin });
    if (patch.interval_seconds !== undefined) params.set('interval_seconds', patch.interval_seconds);
    if (patch.history_days !== undefined)     params.set('history_days',     patch.history_days);
    try {
      await fetch(`${apiBase}/api/admin/settings?${params.toString()}`, {
        method: 'POST',
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
    // Публичный endpoint БЕЗ PIN: обновление кеша — безопасная операция
    // (лёгкое чтение SQLite), она не должна требовать пароль админа.
    // 1) просим сервер обновить кеш; 2) сразу забираем свежий снимок
    // по HTTP — не ждём SSE, т.к. он может не работать через прокси.
    try {
      await fetch(`${apiBase}/api/refresh`, { method: 'POST' });
    } catch {}
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
