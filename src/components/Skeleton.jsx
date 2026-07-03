import React from 'react';

/**
 * Skeleton — анимированный плейсхолдер на месте контента при загрузке.
 * Используется как fallback для React.lazy/Suspense, чтобы не показывать
 * голый текст «Загрузка...», а дать визуальную заглушку нужной высоты.
 */
export function SkeletonBlock({ height = 200, marginBottom = 0 }) {
  return (
    <div style={{
      height,
      marginBottom,
      borderRadius: 'var(--radius)',
      background: 'linear-gradient(90deg, var(--surface) 0%, var(--surface2) 50%, var(--surface) 100%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.4s ease-in-out infinite',
      border: '1px solid var(--border)',
    }} />
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: 12,
      padding: '0 24px',
      marginBottom: 24,
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          height: 80,
          borderRadius: 'var(--radius)',
          background: 'linear-gradient(90deg, var(--surface) 0%, var(--surface2) 50%, var(--surface) 100%)',
          backgroundSize: '200% 100%',
          animation: `skeletonShimmer 1.4s ease-in-out infinite`,
          animationDelay: `${i * 0.1}s`,
          border: '1px solid var(--border)',
        }} />
      ))}
    </div>
  );
}

export default function Skeleton({ height = 300, text = 'Загрузка...' }) {
  return (
    <div>
      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <SkeletonBlock height={height} />
      <div className="state-msg">{text}</div>
    </div>
  );
}