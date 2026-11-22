import { useI18n } from '../i18n/I18n';
import type { Union } from '../lib/types';

export default function UnionSelect({ unions, value, onChange, allLabel, id }: {
  unions: Union[]; value: string; onChange: (v: string) => void; allLabel?: string; id?: string;
}) {
  const { lang, t } = useI18n();
  const districts = [...new Set(unions.map((u) => (lang === 'bn' ? u.district_bn : u.district_en)))];
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel ?? t('chooseUnion')}</option>
      {districts.map((d) => (
        <optgroup key={d} label={d}>
          {unions.filter((u) => (lang === 'bn' ? u.district_bn : u.district_en) === d).map((u) => (
            <option key={u.id} value={u.id}>
              {lang === 'bn' ? `${u.name_bn} (${u.upazila_bn})` : `${u.name_en} (${u.upazila_en})`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
