import type { Reading } from '../lib/types';

/** Tiny inline SVG line: past (solid) + forecast (dashed), with the danger level as a red rule. */
export default function Sparkline({ readings, danger, label }: { readings: Reading[]; danger: number; label: string }) {
  const W = 300, H = 70, P = 4;
  const vals = readings.map((r) => r.level_m);
  const lo = Math.min(...vals, danger) - 0.1;
  const hi = Math.max(...vals, danger) + 0.1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (readings.length - 1);
  const y = (v: number) => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo);
  const nowIdx = readings.findIndex((r) => r.is_forecast) - 1;
  const path = (from: number, to: number) =>
    readings.slice(from, to + 1).map((r, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)},${y(r.level_m).toFixed(1)}`).join('');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
      <line x1={P} x2={W - P} y1={y(danger)} y2={y(danger)} className="spark-danger" />
      <line x1={x(nowIdx)} x2={x(nowIdx)} y1={P} y2={H - P} className="spark-now" />
      <path d={path(0, nowIdx)} className="spark-past" />
      <path d={path(nowIdx, readings.length - 1)} className="spark-fc" />
      <circle cx={x(nowIdx)} cy={y(readings[nowIdx].level_m)} r={3.5} className="spark-dot" />
    </svg>
  );
}
