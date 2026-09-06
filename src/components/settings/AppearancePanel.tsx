'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import { PALETTES, type PaletteKey } from '@/lib/palette';
import { setPaletteAction } from '@/lib/settings-actions';

/**
 * Settings → Appearance: the chart palette, chosen from a dropdown and saved
 * as it changes. The swatches preview the six series steps of the chosen
 * ramp in the current theme, before the rest of the app re-renders with it.
 */
export default function AppearancePanel({ palette }: { palette: PaletteKey }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<PaletteKey>(palette);
  const [pending, startTransition] = useTransition();

  function change(v: string) {
    const key = v as PaletteKey;
    setChosen(key);
    startTransition(async () => {
      const r = await setPaletteAction(key);
      if (r.ok) {
        toast.success(`Charts are now ${PALETTES.find((p) => p.key === key)?.label.replace(' (default)', '').toLowerCase()}`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="card" style={{ padding: '18px 20px', maxWidth: 560 }}>
      <div className="field">
        <span className="field-label">Chart colours</span>
        <Select fullWidth value={chosen} onChange={change} options={PALETTES.map((p) => ({ value: p.key, label: p.label }))} ariaLabel="Chart colours" />
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
          The ramp every chart mark, share bar and sparkline takes, in both themes, for everyone who opens this deployment. Buttons, links and the rail stay blue.
        </p>
      </div>
      <div className="swatches mt-4" data-palette={chosen} aria-hidden style={{ opacity: pending ? 0.6 : 1 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} style={{ background: `var(--series-${i})` }} />
        ))}
      </div>
    </div>
  );
}
