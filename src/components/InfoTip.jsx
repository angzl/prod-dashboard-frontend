import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * InfoTip — значок «i» со всплывающей подсказкой.
 *
 * Подсказка рендерится через портал в <body>, поэтому НЕ обрезается
 * таблицами с overflow:hidden/auto и sticky-колонками. Позиция
 * вычисляется относительно иконки и пересчитывается при скролле/resize.
 *
 * Открывается по наведению (мышь) и по клику (тач-устройства),
 * закрывается по уходу курсора, клику вне подсказки или Esc.
 */
export default function InfoTip({ text, title, placement = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const iconRef = useRef(null);
  const tipRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Вычисляем позицию тултипа относительно иконки
  const updatePos = useCallback(() => {
    const el = iconRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipW = Math.min(340, window.innerWidth - 24);
    let left, top;

    if (placement === 'top') {
      left = r.left + r.width / 2 - tipW / 2;
      top = r.top - 8; // прижмём к низу тултипа через transform
    } else {
      left = r.left + r.width / 2 - tipW / 2;
      top = r.bottom + 8;
    }

    // Не даём выйти за границы экрана по горизонтали
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));

    setPos({ left, top, tipW, placement });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    // Пересчёт при скролле/изменении размера, пока открыта подсказка
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  // Закрытие по Esc
  useLayoutEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Закрытие по клику вне иконки/подсказки
  useLayoutEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        iconRef.current && !iconRef.current.contains(e.target) &&
        tipRef.current && !tipRef.current.contains(e.target)
      ) setOpen(false);
    };
    // pointerdown, чтобы сработать раньше onClick по иконке-переключателю
    document.addEventListener('pointerdown', onClick, true);
    return () => document.removeEventListener('pointerdown', onClick, true);
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    setOpen(v => !v);
  };

  return (
    <>
      <span
        ref={iconRef}
        className={`info-tip-icon${open ? ' active' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Информация о блоке"
        title={undefined}
        onClick={toggle}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
      >
        i
      </span>

      {open && pos && createPortal(
        <div
          ref={tipRef}
          className="info-tip-popover"
          style={{
            left: pos.left,
            top: pos.placement === 'top' ? undefined : pos.top,
            bottom: pos.placement === 'top'
              ? window.innerHeight - pos.top
              : undefined,
            width: pos.tipW,
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {title && <div className="info-tip-title">{title}</div>}
          <div className="info-tip-text">{text}</div>
        </div>,
        document.body
      )}
    </>
  );
}