import { useState, useEffect, useRef } from 'react';

/**
 * Плавная анимация числа от 0 до target.
 *
 * Важно: предыдущая версия не отменяла requestAnimationFrame в cleanup,
 * из-за чего после размонтирования компонента продолжали лететь setCount —
 * это вызывало утечку кадров и React-предупреждение "Can't perform a state
 * update on an unmounted component". Теперь rAF корректно сбрасывается.
 */
export function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    let startTime = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const current = Math.floor(target * progress);
      setCount(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}