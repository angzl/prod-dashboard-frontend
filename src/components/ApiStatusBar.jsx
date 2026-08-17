import React, { useState } from 'react';
import { useDataStore } from '../context/DataContext';

export default function ApiStatusBar() {
  const { status, lastOk, isApiOffline, errorMsg, refreshNow } = useDataStore();
  const [dismissed, setDismissed] = useState(false);

  // Показываем баннер только при проблемах
  if (status === 'ok' || (status === 'idle' && !isApiOffline)) return null;
  if (dismissed) return null;

  const isOffline = isApiOffline || status === 'error';

  const lastOkStr = lastOk
    ? new Date(lastOk).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div style={{
      position:   'sticky',
      top:        0,
      zIndex:     200,
      display:    'flex',
      alignItems: 'center',
      gap:        12,
      padding:    '8px 20px',
      background: isOffline
        ? 'rgba(127,29,29,0.95)'
        : 'rgba(113,63,18,0.95)',
      backdropFilter: 'blur(4px)',
      borderBottom: `1px solid ${isOffline ? 'rgba(220,38,38,0.4)' : 'rgba(202,138,4,0.4)'}`,
      fontSize:   13,
      flexWrap:   'wrap',
    }}>
      {/* Иконка + текст */}
      <span style={{ fontSize: 16 }}>{isOffline ? '🔴' : '🟡'}</span>
      <span style={{ color: isOffline ? '#fca5a5' : '#fde047', fontWeight: 600, flex: 1 }}>
        {isOffline
          ? `API недоступен${errorMsg ? ` — ${errorMsg}` : ''}`
          : 'Обновление данных...'
        }
        {lastOkStr && isOffline && (
          <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.55)', marginLeft: 8 }}>
            Последние данные: {lastOkStr}
          </span>
        )}
      </span>

      {/* Кнопка обновить */}
      {isOffline && (
        <button
          onClick={refreshNow}
          style={{
            padding: '3px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      )}

      {/* Закрыть */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 14,
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}
