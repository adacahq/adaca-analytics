'use client';

import type { CSSProperties } from 'react';

const INLINE: CSSProperties = { display: 'inline-block', width: 'auto', minWidth: 160 };
const FULL: CSSProperties = { display: 'block', width: '100%' };

/**
 * On-brand date input: a native <input type="date"> in the `.field` grammar
 * (globals.css flips `color-scheme` per theme so the native picker matches
 * dark/light). The native control already emits/accepts ISO yyyy-mm-dd, so
 * the value contract is unchanged.
 *
 * `fullWidth` mirrors Select's prop of the same name. It matters here: the
 * wrapper is what sizes the control (the input itself is width:100% of it),
 * so without it a date field sits at 160px in a column of full-width inputs.
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  ariaLabel,
  fullWidth = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className="field" style={fullWidth ? FULL : INLINE}>
      <input
        type="date"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
