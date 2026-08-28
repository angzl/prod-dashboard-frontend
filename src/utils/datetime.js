/**
 * Утилиты для работы со временем срезов (snap_datetime) из БД.
 *
 * snap_datetime приходит с бэкенда в одном из видов:
 *   - "2026-08-27 07:31:04"  (SQLite TEXT)
 *   - "2026-08-27T07:31:04"  (ISO — после jsonable_encoder FastAPI)
 * Парсим вручную (не через new Date), чтобы не зависеть от
 * кросс-браузерных различий парсинга не-ISO строк.
 */

/** Разобрать строку snap_datetime на компоненты. */
export function parseSnapDt(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).replace('T', ' ').slice(0, 19);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/);
  if (!m) return null;
  return { y: m[1], mo: m[2], d: m[3], hh: m[4], mm: m[5] };
}

/** "2026-08-27 07:31:04" → "27.08.2026 07:31" (полная дата + ЧЧ:ММ). */
export function fmtSnapDt(raw) {
  const p = parseSnapDt(raw);
  if (!p) return null;
  return `${p.d}.${p.mo}.${p.y} ${p.hh}:${p.mm}`;
}

/** "2026-08-27 07:31:04" → "07:31" (только ЧЧ:ММ). */
export function fmtSnapTime(raw) {
  const p = parseSnapDt(raw);
  if (!p) return null;
  return `${p.hh}:${p.mm}`;
}

/**
 * Самый свежий snap_datetime по массиву строк snapshot.
 * Сравнение строк вида "YYYY-MM-DD HH:MM:SS" корректно работает
 * лексикографически, поэтому MAX — это обычное строковое сравнение.
 */
export function getLatestSnapDt(snapshot) {
  let max = null;
  (snapshot || []).forEach((r) => {
    const v = r && r.snap_datetime;
    if (v != null && String(v).trim() !== '') {
      const s = String(v);
      if (!max || s > max) max = s;
    }
  });
  return max;
}