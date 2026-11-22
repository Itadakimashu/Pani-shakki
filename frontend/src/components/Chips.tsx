import { useI18n } from '../i18n/I18n';
import { LEVELS, NEEDS, SEVERITY, TRUST_FLAGS } from '../i18n/strings';
import type { WaterLevel } from '../lib/types';

export function SeverityChip({ level, big }: { level: number; big?: boolean }) {
  const { pick, n } = useI18n();
  const s = SEVERITY[level as 0 | 1 | 2 | 3];
  return <span className={`chip sev sev-${level}${big ? ' chip-big' : ''}`}>{n(level)} · {pick(s)}</span>;
}

export function NeedChips({ needs }: { needs: string[] }) {
  const { pick } = useI18n();
  return (
    <>
      {needs.map((x) => (
        <span key={x} className="chip chip-need">{NEEDS[x]?.icon} {NEEDS[x] ? pick(NEEDS[x]) : x}</span>
      ))}
    </>
  );
}

export function WaterChip({ w }: { w: WaterLevel | null }) {
  const { pick, n, lang } = useI18n();
  if (!w) return null;
  const label = w.label === 'feet' ? `${n(w.feet)} ${lang === 'bn' ? 'ফুট পানি' : 'ft of water'}` : pick(LEVELS[w.label] ?? { bn: w.label, en: w.label });
  return <span className="chip chip-water">🌊 {label}</span>;
}

export function TrustChips({ score, flags }: { score: number; flags: string[] }) {
  const { pick, n } = useI18n();
  const bad = flags.filter((f) => f !== 'corroborated');
  return (
    <>
      {score < 0.5 && <span className="chip chip-warn">⚠ {n(Math.round(score * 100))}%</span>}
      {bad.map((f) => <span key={f} className="chip chip-flag">{TRUST_FLAGS[f] ? pick(TRUST_FLAGS[f]) : f}</span>)}
      {flags.includes('corroborated') && <span className="chip chip-ok">✓ {pick(TRUST_FLAGS.corroborated)}</span>}
    </>
  );
}
