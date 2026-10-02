/**
 * DataContext — фронтовый стор.
 *
 * Стратегия «тонкий клиент» (push-модель, без polling, БЕЗ кеша браузера):
 *   1. Источник истины — ТОЛЬКО сервер: при старте показываем скелетоны,
 *      первое же SSE-сообщение приносит полный свежий снимок данных
 *   2. Открываем ОДНО SSE-соединение (/api/stream) на всё время работы страницы
 *   3. Сервер САМ присылает новые данные, как только его внутренний кеш
 *      обновился (раз в interval_seconds на бэкенде) — никаких повторных
 *      HTTP-запросов с фронта не требуется, независимо от числа открытых вкладок
 *   4. При разрыве соединения браузер (EventSource) автоматически переподключается
 *
 * Данные НЕ сохраняются в localStorage: у всех пользователей всегда одна и
 * та же (свежая) картина с сервера, а на слабых ПК нет фризов от
 * многомегабайтных JSON.parse/JSON.stringify на главном потоке браузера.
 * В localStorage остаются только персональные UI-настройки.
 */
import React, {
  createContext, useContext, useEffect,
  useRef, useCallback, useReducer, useState,
} from 'react';

/* ── localStorage: ТОЛЬКО персональные UI-настройки ─────────── */
const LS = {
  SETTINGS: 'dm_settings',
};

/* Ключи браузерного кеша старой версии (данные кешировались в браузере
 * у каждого пользователя). Один раз удаляем их при загрузке страницы,
 * чтобы у пользователей не лежали устаревшие мегабайты. */
const LEGACY_LS_KEYS = [
  'dm_partners', 'dm_snapshot', 'dm_history', 'dm_timeline',
  'dm_monitored', 'dm_last_ok', 'dm_server_last_ok',
];

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
/* Данные всегда начинаются пустыми — их принесёт первое сообщение
 * от сервера (SSE или HTTP-fallback GET /api/all). Локального кеша нет. */
const initialState = {
  partners:  [],
  snapshot:  [],
  history:   {},
  timeline:  { columns: [], data: {}, ranges: {} },
  // monitored — [{name, priority}] с сервера; флаг «не приоритет»
  // управляет видимостью проекта в сводках (скрыт за кнопкой «показать все»)
  monitored: [],
  // installations — [{name, category, active, monitor}] с сервера;
  // переключатель контекста «Прод / инсталяция» на дашборде
  installations: [],
  settings:  { ...DEFAULT_SETTINGS, ...lsGet(LS.SETTINGS, {}) },
  lastOk:    null,      // ISO — момент последнего полученного сообщения от сервера
  serverLastOk: null,   // last_ok с сервера (unix timestamp)
  status:    'loading', // idle | loading | ok | error
  errorMsg:  null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload, errorMsg: action.error ?? null };

    /** Пришло сообщение из SSE-стрима — полный снимок данных с сервера */
    case 'STREAM_OK': {
      const { partners, snapshot, history, timeline, monitored, installations, serverLastOk } = action.payload;

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

      // В localStorage данные больше не пишем — единственный источник
      // истины сервер; здесь только обновляем состояние в памяти.

      return {
        ...state,
        partners:     partners     ?? state.partners,
        snapshot:     snapshot     ?? state.snapshot,
        history:      history      ?? state.history,
        timeline:     timeline     ?? state.timeline,
        monitored:    monitored    ?? state.monitored,
        installations: installations ?? state.installations,
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
      // Локального кеша больше нет — очищаем только состояние в памяти,
      // свежие данные придут с сервера (refreshNow) на следующем цикле.
      return {
        ...state,
        partners: [],
        snapshot: [],
        history: {},
        timeline: { columns: [], data: {}, ranges: {} },
        monitored: [],
        installations: [],
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

  /* Есть ли уже данные с сервера — чтобы при переподключениях SSE
   * не мигать скелетонами, когда данные уже на экране. */
  const hasDataRef = useRef(false);
  useEffect(() => {
    hasDataRef.current =
      (state.partners?.length || 0) + (state.snapshot?.length || 0) > 0;
  }, [state.partners, state.snapshot]);

  /* Одноразовая чистка браузерного кеша старой версии: раньше данные
   * сохранялись в localStorage у каждого пользователя (мегабайты) —
   * теперь источник истины только сервер, старые ключи удаляем. */
  useEffect(() => {
    LEGACY_LS_KEYS.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  }, []);

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
        monitored:    data.monitored,
        installations: data.installations,
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
      // Сервер недоступен — остаёмся на последних полученных данных
    }
  }, [apiBase, applyServerPayload]);

  /* ── Подключение / переподключение SSE ─────────────────────── */
  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // Показываем 'loading' (скелетоны), только если данных с сервера ещё
    // нет — при автоматических переподключениях UI не должен мигать.
    if (!hasDataRef.current) {
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
   * (или было прибито прокси). Без этого вкладка осталась бы
   * на данных с прошлого захода. */
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

  /* Карта приоритетов: {ownerName: bool}. true = приоритетный.
   * Если проекта нет в monitored — считаем приоритетным (появится,
   * когда бэкенд ещё старый и не шлёт поле monitored). */
  const priorityMap = React.useMemo(() => {
    const m = {};
    (state.monitored || []).forEach(p => {
      if (p && typeof p.name === 'string') m[p.name] = p.priority !== false;
    });
    return m;
  }, [state.monitored]);

  const isApiOffline = (() => {
    if (state.status === 'ok') return false;
    if (!state.lastOk)         return state.status === 'error';
    return Date.now() - new Date(state.lastOk).getTime() > state.settings.offlineThreshMs;
  })();

  /* ── Переключатель контекста: прод / инсталяция ────────────────
   * Все компоненты читают из стора partners/snapshot. Здесь мы
   * подменяем их отфильтрованными по выбранной инсталяции версиями,
   * поэтому весь дашборд (таблицы, карточки, графики) автоматически
   * переключается контекстом без правок каждого компонента. */
  const [installationChoice, setInstallationChoice] = useState(null); // null → авто (прод)

  const prodName = React.useMemo(() => {
    const prod = (state.installations || []).find(i => i.category === 'prod');
    return prod?.name || state.installations?.[0]?.name || null;
  }, [state.installations]);

  const installation = installationChoice || prodName;

  const snapshot = React.useMemo(() => {
    if (!installation) return state.snapshot;
    return (state.snapshot || []).filter(r => (r.installation || prodName) === installation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.snapshot, installation, prodName]);

  const partners = React.useMemo(() => {
    if (!installation || installation === prodName) return state.partners;
    // у инсталяции нет списка партнёров — одна строка срезa = вся инсталяция
    return [...new Set(snapshot.map(r => r.partner))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, installation, prodName, state.partners]);

  const value = {
    ...state,
    partners,
    snapshot,
    allSnapshot: state.snapshot,     // снепшот без фильтра контекста (прод + инсталяции)
    installations: state.installations || [],
    installation,
    prodName,
    setInstallation: setInstallationChoice,
    isApiOffline,
    getHistory,
    priorityMap,
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
