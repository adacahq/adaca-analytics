'use client';

import type { CSSProperties } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  /** Render a hairline separator row immediately above this option. */
  dividerBefore?: boolean;
}

/** A native <select> has no divider row of its own, so a `dividerBefore` flag
 *  starts a new <optgroup> — the closest native equivalent to a separator. */
function groupOptions(options: SelectOption[]): SelectOption[][] {
  const groups: SelectOption[][] = [];
  let current: SelectOption[] = [];
  for (const opt of options) {
    if (opt.dividerBefore && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(opt);
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * On-brand select: a native <select> in the `.field` grammar (globals.css).
 * Browsers with `appearance: base-select` get an in-page picker panel;
 * everything else gets the styled trigger + native picker — both for free
 * from the CSS, no JS popover of our own. Callers that already seed their
 * own `{ value: '' }` "any/none" option keep it as-is; `placeholder` only
 * injects a leading blank option when the caller hasn't supplied one.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  mono = false,
  fullWidth = false,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
  ariaLabel?: string;
}) {
  const hasEmptyOption = options.some((o) => o.value === '');
  const groups = groupOptions(options);
  const wrapStyle: CSSProperties | undefined = fullWidth
    ? undefined
    : { display: 'inline-block', width: 'auto', minWidth: 120 };

  return (
    <div className="field" style={wrapStyle}>
      <select
        aria-label={ariaLabel}
        className={mono ? 'mono' : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && !hasEmptyOption && <option value="">{placeholder}</option>}
        {groups.map((group, gi) =>
          groups.length > 1 ? (
            <optgroup key={gi}>
              {group.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </select>
    </div>
  );
}
