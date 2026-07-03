import React from 'react';

/**
 * ErrorBoundary — предохраняет приложение от «белого экрана».
 *
 * Если любой компонент в дереве бросает ошибку при рендере, React
 * размонтирует всё поддерево. Без boundary падает весь app.
 * Здесь мы перехватываем ошибку, показываем дружелюбное сообщение
 * и кнопку «перезагрузить», не теряя остальной UI.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // В реальном проекте сюда можно добавить отправку в Sentry/Logflare.
    // Пока — просто пишем в консоль.
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || 'Неизвестная ошибка';
      return (
        <div style={{
          margin: '40px auto',
          maxWidth: 520,
          padding: 32,
          background: 'var(--surface)',
          border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: 12,
          boxShadow: 'var(--shadow)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Что-то пошло не так
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
            Произошла ошибка при отрисовке интерфейса.
          </p>
          <p style={{
            fontSize: 12, color: '#f87171', marginBottom: 20,
            fontFamily: 'monospace', background: 'rgba(220,38,38,0.08)',
            padding: '8px 12px', borderRadius: 6, wordBreak: 'break-word',
          }}>
            {msg}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'rgba(99,102,241,0.2)', border: '1px solid var(--accent)',
                color: '#a5b4fc', cursor: 'pointer',
              }}
            >
              Попробовать снова
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', cursor: 'pointer',
              }}
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}