import { describe, expect, it } from 'vitest';
import { classify, normalize, bnToAsciiDigits, asciiToBnDigits, extractWaterLevel } from '../classifier';
import cases from '../cases.json';

interface Case { text: string; severity: number; water_level?: string; feet?: number; needs?: string[]; needs_exclude?: string[] }

describe('Bangla classifier — shared cases (mirrored in backend pytest)', () => {
  it('has at least 25 Bangla examples', () => {
    expect((cases as Case[]).length).toBeGreaterThanOrEqual(25);
  });

  for (const c of cases as Case[]) {
    it(`${c.text} → ${c.severity}`, () => {
      const r = classify(c.text);
      expect(r.severity, JSON.stringify(r.signals)).toBe(c.severity);
      if (c.water_level) {
        expect(r.water_level?.label).toBe(c.water_level);
        if (c.feet !== undefined) expect(r.water_level?.feet).toBeCloseTo(c.feet, 1);
      }
      for (const n of c.needs ?? []) expect(r.needs).toContain(n);
      for (const n of c.needs_exclude ?? []) expect(r.needs).not.toContain(n);
    });
  }
});

describe('normalisation', () => {
  it('converts Bangla digits', () => {
    expect(bnToAsciiDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(asciiToBnDigits(2026)).toBe('২০২৬');
  });
  it('unifies decomposed nukta letters', () => {
    expect(normalize('বাড়ছে')).toBe(normalize('বাড়ছে'));
    expect(normalize('পানী')).toBe('পানি');
  });
  it('strips danda and punctuation', () => {
    expect(normalize('পানি বাড়ছে।')).toBe(normalize('পানি বাড়ছে'));
    expect(normalize('পানি বাড়ছে।').endsWith('।')).toBe(false);
  });
  it('parses Bangla-digit measurements', () => {
    expect(extractWaterLevel(normalize('উঠোনে ৩ ফুট পানি'))?.feet).toBe(3);
  });
  it('returns low-confidence normal for empty text', () => {
    const r = classify('');
    expect(r.severity).toBe(0);
    expect(r.needs).toEqual([]);
  });
});
