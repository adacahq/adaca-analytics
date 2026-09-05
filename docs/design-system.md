# Adaca Analytics — Design System (Canvas)

> **Single source of truth: `src/app/globals.css`.** Every token, class and
> value in this document is read from that file, verified by grep at the
> time of writing. If the two ever disagree, the CSS has changed and this
> doc is stale — fix the doc, don't guess at what it "should" say.
>
> This is a **working reference for building a screen**, not a history of
> the system. The one place it looks backward is §12, where the old idiom
> catalogue lost some idioms on purpose.

---

## 1. What this is

Adaca Analytics runs on **Canvas** — the same design system as the sibling
Adaca Red and PMO apps, carried over token-for-token from Red. Two themes,
chosen by the operator and nothing else:

- **Light** — white, the default.
- **Dark** — deepest ink, opt-in.

`<html data-theme="light">` is set server-side by the root layout
(`src/app/layout.tsx`) and drives every colour in the system through one set
of CSS custom properties. The operator's choice is persisted to
`localStorage` under the key **`analytics-theme`** (`ThemeToggle.tsx`), and a
head script stamps `data-theme="dark"` onto `<html>` **before paint** if
that's what's stored:

```js
// src/app/layout.tsx — runs in <head>, before first paint
try{if(localStorage.getItem('analytics-theme')==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}
```

That pre-paint stamp is what prevents a flash of the wrong theme on load —
by the time React hydrates, the DOM attribute is already correct and
`suppressHydrationWarning` on `<html>` tells React not to complain about the
mismatch with its own server-rendered `data-theme="light"`.

The same script also stamps `.canvas-motion` onto `<html>` (unless the
visitor has `prefers-reduced-motion: reduce`) — see §9.

---

## 2. Tokens

### 2.1 Theme-invariant (`:root`)

These don't change between light and dark:

| Token | Value | Notes |
|---|---|---|
| `--blue` | `#2074ef` | Used once, for `::selection` — deliberately does **not** track the theme's `--accent` (light's accent happens to equal it; dark's doesn't). |
| `--ease` | `cubic-bezier(0.22, 0.8, 0.26, 1)` | The one easing curve in the system — every transition, from a 0.12s hover to the 0.9s theme cross-fade, uses it. |
| `--sb-w` | `264px` | Sidebar rail width. Collapses to `0px` under a `@media (max-width: 900px)` override once the rail becomes an off-canvas drawer. |
| `--font-sans` | `'Geist', system-ui, sans-serif` | Prose, headings, names. |
| `--font-mono` | `'Geist Mono', ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono', monospace` | Every label, unit, ID, figure, button. |
| `--amber` / `--red` / `--green` | `#c9862b` / `#d95e4a` / `#2f9e77` | The three raw semantic hues. Same value in both themes; `--warn`/`--crit`/`--ok` alias them (§4). |

Fonts load via a plain CSS `@import` at the top of `globals.css` (Geist
weights 300/400/500/600/700, Geist Mono 300/400/500) — **not** `next/font`.

The data ramp (`--accent-1/2/3`, `--accent-tint`, `--chart-1..6`,
default `--series-1..6`) also lives in this theme-invariant block — see §3.

### 2.2 Light theme (default — `html`, `html[data-theme='light']`)

| Token | Value |
|---|---|
| `--bg` | `#ffffff` |
| `--fg` | `#15293e` |
| `--muted` | `#5a6e86` |
| `--line` | `rgba(21, 41, 62, 0.12)` |
| `--card` | `#f6f8fb` |
| `--card-line` | `rgba(21, 41, 62, 0.1)` |
| `--ghost` | `rgba(21, 41, 62, 0.045)` |
| `--lift` | `#ffffff` — surface of a raised tile inside a tray (`.tabs .ind`) |
| `--accent` | `#2074ef` |
| `--accent-ink` | `var(--bg)` → resolves white |
| `--accent-strong` | `#1a5fd0` — text-bearing accent (§5); `--accent` labels at `4.37:1` on white, under AA at the button's `10.5px` |
| `--info` | `#2a7f8f` |
| `--crit-strong` | `#b8412c` — text-bearing crit (§5); `--red` labels at `3.72:1` on white, under AA at the same size |
| `--select-chevron` | an inline SVG data-URI, chevron stroke baked as `#5a6e86` (this theme's `--muted`) |

### 2.3 Dark theme (opt-in — `html[data-theme='dark']`)

| Token | Value |
|---|---|
| `--bg` | `#0a1524` |
| `--fg` | `#f2f6fb` |
| `--muted` | `#8598ae` |
| `--line` | `rgba(242, 246, 251, 0.12)` |
| `--card` | `rgba(255, 255, 255, 0.045)` |
| `--card-line` | `rgba(242, 246, 251, 0.1)` |
| `--ghost` | `rgba(255, 255, 255, 0.055)` |
| `--lift` | `#132235` — surface of a raised tile inside a tray (`.tabs .ind`) |
| `--accent` | `#6fb2ff` |
| `--accent-ink` | `var(--bg)` → resolves near-black |
| `--accent-strong` | `#6fb2ff` — same as `--accent`; dark's accent already clears AA (`8.28:1`) |
| `--info` | `#6fd0e0` |
| `--crit-strong` | `#ef7a66` — lifted off `--red` (`#d95e4a`) so it stays legible against a tinted hover fill |
| `--select-chevron` | same SVG, stroke baked as `#8598ae` (this theme's `--muted`) |

Every themed property (`--bg`, `--fg`, `--card`, borders, etc.) that a
component reads is set to transition over the same `0.9s var(--ease)` used
on `html`/`body`, so flipping the toggle cross-fades the whole screen at
once rather than snapping section by section.

---

## 3. The two colour layers — chrome vs data

**This is the most important rule in the file.**

`--accent` (blue: `#2074ef` light / `#6fb2ff` dark) is **chrome**: the
sidebar's active nav item, links, focus rings, the "you are here" state on
tabs and segmented controls. It is the operator's own colour — the one
thing that says "this is interactive, this is where you are." `.btn-primary`
fills with `--accent-strong` instead (§5): `--accent`'s white label reads
`4.37:1` on the light theme's `#2074ef`, under AA at the button's `10.5px`
type; `--accent-strong` (`#1a5fd0`) reads `5.85:1`. Dark is unaffected
(`8.28:1` either way) because dark's accent already clears AA.

The **orange ramp is data, never chrome**, and it lives entirely inside the
theme-invariant `:root` block (§2.1) so it does not change with the theme —
only the blue chrome does:

| Token | Value | Role |
|---|---|---|
| `--accent-1` | `#ffc7ad` | Three-step shorthand: light |
| `--accent-2` | `#f87854` | Three-step shorthand: mid |
| `--accent-3` | `#cf4422` | Three-step shorthand: deep |
| `--accent-tint` | `rgba(248, 120, 84, 0.12)` | A faint orange fill — used for `.docs-prose blockquote` backgrounds (paired with an `--accent`/blue left border there; that combination is existing markdown-prose styling, not a chrome/data violation worth copying elsewhere). |
| `--chart-1` … `--chart-6` | `#ffd8c2 → #fbb088 → #f6814f → #e85d30 → #c2451f → #8f3417` | The six-step chart-series ramp, lightest to deepest. |

`--series-1..6` alias the chart ramp, but **the order reverses by theme** so
the leading series colour stays legible against the ground:

- `:root` default (used by dark): `--series-1..6 = --chart-1..6` — lightest
  leads, because a light line reads best against dark's near-black `--bg`.
- Light theme override: `--series-1..6 = --chart-6..1` — darkest leads,
  because a light line would nearly vanish against white.

**Never use `--accent` for a RED score or a chart series. Never use the
orange ramp for a button, a nav item, a link, or a focus ring.** The RED
triangle's one graded edge is the only thing orange marks; everywhere else,
orange means "this is a measured value," and blue means "this is a control."

---

## 4. Semantic tones

Six tones, defined once for all themes (`html, html[data-theme='light'],
html[data-theme='dark']`):

| Tone | Definition | Tint (chip/heat backgrounds) |
|---|---|---|
| `--ok` | `var(--green)` → `#2f9e77` | `--ok-tint`: `color-mix(in srgb, var(--green) 14%, transparent)` |
| `--warn` | `var(--amber)` → `#c9862b` | `--warn-tint`: `color-mix(in srgb, var(--amber) 14%, transparent)` |
| `--crit` | `var(--red)` → `#d95e4a` | `--crit-tint`: `color-mix(in srgb, var(--red) 14%, transparent)` |
| `--info` | `#2a7f8f` light / `#6fd0e0` dark | no dedicated tint token — themed per-block (§2.2/2.3) |
| `neutral` | `var(--muted)` | (no dedicated tint — resolves through `--muted` directly) |
| `accent` | `var(--accent)` | (chrome blue, §3 — a valid tone choice for an enum, not a colour anyone should hand-roll) |

This is **Red's own vocabulary**, not carried over from PMO (which only has
`--green`/`--amber`/`--red`). It exists because the definitions layer lets
an admin tag *any* enum choice — initiative status, risk severity, whatever
gets added next — with a tone in **Admin → Definitions**, and
`TONE_COLOR` in `src/lib/definitions/choices.ts` resolves each of the six
names straight to one of these CSS variables:

```ts
// src/lib/definitions/choices.ts
export const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--muted)',
  info: 'var(--info)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  accent: 'var(--accent)',
};
```

All six have to stay visually distinct from each other, which is exactly
why `--info` is its own teal and not an alias of `--muted` — an admin
choosing between "Info" and "Neutral" in the choices editor has to be able
to tell them apart on the resulting chip, not just in the dropdown.

`Chips` and `FieldValue` resolve a value's colour from this metadata (either
directly, or via the `ChoiceProvider` context built by `loadChoiceMeta`) —
there is no hardcoded value→colour map anywhere in the app.

---

## 5. `--accent-ink`, `--accent-strong` & `--crit-strong`

Text placed **on** an accent-coloured fill (the segmented control's
selected state, etc.) uses `--accent-ink`, defined as `var(--bg)` in both
theme blocks — it flips with the theme instead of being a fixed colour:

- Light: `--accent-ink` resolves to white, on the light theme's darker,
  more saturated blue (`#2074ef`).
- Dark: `--accent-ink` resolves to near-black (`#0a1524`), on the dark
  theme's lighter, less saturated blue (`#6fb2ff`).

The CSS comment on this token spells out why it can't be hardcoded: `#fff`
on the dark theme's lighter accent reads at roughly 2.1:1 contrast and
fails WCAG outright. Tying it to `--bg` gives white-on-blue in light and
navy-on-light-blue in dark (~8.4:1) — a deliberate fix, not an oversight to
copy from PMO, which does hardcode `#fff` there.

`--accent-strong` / `--crit-strong` solve a related but separate problem:
a token that carries text or a control boundary directly, rather than
sitting under `--accent-ink`. `.btn-primary` no longer fills with `--accent`
— it fills with `--accent-strong` (`#1a5fd0` light / `#6fb2ff` dark, i.e.
unchanged in dark), because `--accent`'s white label reads `4.37:1` on the
light theme's `#2074ef`, under AA at the button's `10.5px` type;
`--accent-strong` reads `5.85:1`. `.btn-danger`'s text/border similarly
moved from `--red` (`3.72:1`) to `--crit-strong` (`#b8412c` light /
`#ef7a66` dark, `5.48:1` light / `6.67:1` dark). **Both tokens are for
text-bearing or control-boundary use only** — the `.btn` family is their
only consumer. Chrome fills, bars and marks keep `--accent`/`--crit`
unchanged, and neither token touches the RED orange ramp (§3).

---

## 6. Typography

### 6.1 Fonts

Geist (sans) and Geist Mono, loaded by a CSS `@import` at the very top of
`globals.css` — not `next/font`:

```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500&display=swap');
```

### 6.2 Weight & the body/heading rule

- **Body:** `font-weight: 300`, `font-size: 15px`, `line-height: 1.6`
  (the literal `body` rule in `globals.css`).
- **Headings** (`h1`, `h2`, `h3`): `font-weight: 600`, `letter-spacing:
  -0.02em`. `.view-title` (the page-header macro's `<h1>`, §11) restates
  this explicitly plus its own `clamp(26px, 4.4vw, 42px)` size and `1.1`
  line-height.

### 6.3 The mono letter-spacing scale

Every mono label in the system sits on one of these tracking values —
tighter as the text gets less shouty, from a 10px eyebrow down to an
11px inline caption:

| Tracking | Example class | Used for |
|---|---|---|
| `0.26em` | `.eyebrow`, `.viztip .vk` | The loudest labels: page kickers, tooltip headers. |
| `0.22em` | `.modal .mhead .zone-label` | Modal header zone labels. |
| `0.2em` | `.tbmenu`, `.tbsect`, `.zone-label` | Topbar readouts, generic zone labels. |
| `0.18em` | `.field .flabel`, `.sb .glabel`, `.brand span`, `.tabs button/a` | Form field labels, nav group headers, tabs. |
| `0.16em` | `.pill`, `.mono-micro`, `.stat > span`, `.dtable th` | Status pills, table headers, stat captions. |
| `0.15em` | `.btn` | Buttons — eased from 0.2em so uppercase caps stop dissolving at the button's 10.5px size. |
| `0.14em` | `.tbid`/`.tbwho`, `.riskheat .rhaxis`, `.pmatrix th` | Identity readouts, matrix/axis labels. |
| `0.1em` | `.viztip .vr > span`, `.evt .t` | Chart tooltip units, activity-feed timestamps. |
| `0.08em` | `.q .qbig i` | Queue-row figure units. |
| `0.06em` | `.tag-chip.mono` | Uppercase-mono tag chips. |
| `0.04em` | `.micro`, `.viztip .vn` | The quietest mono caption text, not uppercased. |

(`.stat > span` tightens further, to `0.12em`, only inside the
`max-width: 480px` mobile override — a responsive squeeze on that one
idiom, not a separate scale step.)

### 6.4 Mono vs sans — the rule

If it's **machine-ish** — a label, a tag, a count, a status, a date, a key,
a score, a code token, an ID — it's **Geist Mono, uppercase, positive
letter-spacing** (one of the steps above). If it's **language** — a
heading, a sentence, a name, a description — it's **Geist**, sentence
case. This split is why the system reads as an instrument rather than a
generic app; keep it strict when adding new UI.

---

## 7. Geometry

### 7.1 Radius scale

The old system's `--radius: 0` custom property, and the two blanket
`!important` rules that flattened every `rounded-*`/`shadow-*` Tailwind
utility site-wide, are **gone from this file and must not come back**.
Radius is deliberately expressive under Canvas, and it steps through nine
values, verified against real call sites:

| Radius | Used for | Example classes |
|---|---|---|
| `6px` | Tiny controls & small chips | `.brand span` (sidebar product tag), `.grip` (kanban drag handle) |
| `8px` | Nav rows & compact menu rows | `.sb a.nv`/`a.sv`, `.tbswitch`, `.tbuser`, `.tbpanel a`/`.menu-row`, `.chev`, `.gtip`, `.tabs .ind` (tab tile) |
| `10px` | The default control radius | `.field input`/`textarea`/`select` (+ `.field-input`), `.viztip`, `.rh` (risk-heat cell), `.docs-prose code`/`pre`, `.lexical-wrap`, `.tag-input` |
| `12px` | Small panel/group surfaces | `.sb .grp`, `.tbpanel`, `.stats` strip, `.alert`, `.tabs` |
| `14px` | The standard card/surface radius | `.card`, `.badd`, `.empty`, `.gchart`, `.chart-card`, `.field select::picker(select)` |
| `16px` | Dialogs | `.modal` |
| `20px` | Pills | `.pill`, `.seg button`, `.tag-chip` |
| `40px` | Full-pill buttons/toggles | `.btn`, `.tgl` |
| `50%` | Circles | `.tbavatar`, `.own i`, `.avatar-s`, `.spin`/`.spinner`, `.rag` |

A handful of thin functional elements (progress-bar tracks/fills at
2–4px, the `.check` box at 5px, the narrow-viewport `.riskheat` cell at
9px) use ad-hoc radii sized to their own stroke width rather than this
scale — they aren't a second system to reuse elsewhere. `.btn-text` is the
one deliberate `border-radius: 0` in the file, because it's a link styled
as a button, not a boxed control.

### 7.2 The shadow idiom

One recipe, reused for every floating/elevated surface:

```
box-shadow: 0 <offset>px <blur>px -<spread>px rgba(10, 21, 36, <alpha>);
```

| Element | Value |
|---|---|
| `.tbpanel` | `0 24px 60px -24px rgba(10, 21, 36, 0.45)` |
| `.card:hover` | `0 16px 40px -22px rgba(10, 21, 36, 0.5)` |
| `.bghost .card` (dragged card) | `0 24px 56px -20px rgba(10, 21, 36, 0.55)` |
| `.field select::picker(select)` | `0 24px 64px -28px rgba(10, 21, 36, 0.55)` |
| `.viztip` | `0 18px 48px -20px rgba(10, 21, 36, 0.5)` |
| `.sb.open` (mobile drawer) | `24px 0 80px -40px rgba(10, 21, 36, 0.6)` (horizontal, since it slides in from the left) |
| `.tabs .ind` (tab tile) | `0 0 0 1px var(--card-line), 0 8px 20px -14px rgba(10, 21, 36, 0.45)` |

The colour is always `rgba(10, 21, 36, …)` regardless of theme — even on
the light theme, an elevated panel drops a *dark* shadow (a light shadow on
white would simply vanish). Offset runs 16–24px, blur 40–80px, spread
−20 to −40px (the negative spread keeps the shadow tight to the panel
rather than bleeding past its edge). Reserve this for things that float
above the canvas — dropped panels, open pickers, a card mid-drag, a
tooltip — never for a resting card or an input.

Box-shadow is also used for a *different*, non-elevation purpose — a
"halo" ring, e.g. `.rag` (`0 0 0 3px color-mix(in srgb, <tone> 18%,
transparent)`) and `.field select:open` (`0 0 0 4px color-mix(in srgb,
var(--accent) 15%, transparent)`). Don't confuse the two: a halo has zero
offset/blur and a positive spread; the lift idiom above always has a
negative spread.

---

## 8. Idiom catalogue

Every named class in `globals.css`, grouped. One line each — this is the
part you'll actually reach for while building a screen.

### Shell

| Class | What it is |
|---|---|
| `.wrap` | The page content column: `min(1100px, 100%)`, centred, with the page's vertical rhythm (`112px`/`176px` top/bottom, tightening at narrower breakpoints). Wrap every page's content in this. |
| `.sb` | The fixed sidebar rail (`var(--sb-w)`, `264px`). Ink gradient in light mode, flattens to solid `--bg` in dark. Becomes an off-canvas drawer (`.sb.open`) under 900px. |
| `.brand` / `.brand span` | The sidebar logo row / the small mono product-tag chip beside the wordmark. |
| `.sb nav`, `.grp`, `.glabel` | The nav's grouped-section wrapper / a group card / its mono group heading. |
| `.sb a.nv`, `a.nv.on` | A top-level nav row / its active state (white text + accent-tint fill — the one place active reads as white rather than accent, because it's already inside the rail's own tinted chrome). |
| `.sect.chv`, `.chev` | A nav section with a sub-view disclosure / its chevron toggle button. |
| `.sb .views`, `.views.x` | The collapsible sub-view list (animates via `grid-template-rows: 0fr → 1fr`). |
| `.sb a.sv`, `a.sv.on` | A sub-view row / its active state (accent text + accent-tint fill). |
| `.tgl` | The theme-toggle pill (lives in the topbar identity panel). |
| `.tb` | The fixed topbar: 56px, blurred glass over the canvas. |
| `.tbl`, `.tbdrop`, `.tbmenu` | Topbar left cluster / a dropdown's positioning wrapper / the mobile hamburger button. |
| `.tbswitch`, `.tbswitch.static` | The section·view readout button, or a non-interactive label when there's nothing to switch to. |
| `.tbsect` | The mono "current section" label inside `.tbswitch`. |
| `.tbuser`, `.tbavatar`, `.tbid` | The identity trigger button / circular initials avatar / mono identity readout beside it. |
| `.tbpanel`, `.tbpanel.right`, `a.on` | The dropped panel (identity menu, search results) / right-anchored variant / an active row inside one (declared but currently unused by any call site — see §10). |
| `.tbwho`, `.tbsep` | A panel's "who's signed in" header row / a divider rule inside a panel. |
| `.scrim` | The drawer's backdrop, mobile only. |
| `main.page` | Content offset for the fixed sidebar + topbar (`margin-left: var(--sb-w); padding-top: 56px`). |
| `.logo-light`, `.logo-dark` | The theme-aware wordmark swap — `.logo-light` is hidden by default and shown only under `[data-theme='light']`, which simultaneously hides `.logo-dark`. |

### Type

| Class | What it is |
|---|---|
| `.eyebrow`, `.eyebrow.neutral` | The mono kicker above a page title — accent by default, `.neutral` for a muted variant. |
| `.eyebrow-row` | An identity line pairing the eyebrow with the record's state pills (`NodeShell`) — always rendered so the header below it never shifts. |
| `.view-title` | The page `<h1>` (§6.2, §11). |
| `.subhead`, `.sub-title` | The head of a tab's own content, under a tab tray whose container header the layout owns (§11): `.subhead` is the flex row (h2 + one right-aligned action), `.sub-title` the h2 itself. Built by `SubHead`. |
| `.lede` | The intro paragraph under a title — muted, capped at 54ch. |
| `.mono-micro` | Small muted mono caption text. |
| `.mono` | A bare `font-family: mono` utility, for an inline value that needs the face without a named idiom's full styling. |
| `.docs-prose` | Full markdown typography for `RichTextView` — headings, lists, blockquote, code/pre, tables all get their own rhythm here; it's the one place prose gets real heading spacing rather than the app's tight UI type. |

### Buttons

The `40px`-radius pill silhouette (§7.1) is deliberately unchanged from the
Canvas port — only the weight changed: mono `500` at `10.5px` (the body's
`300` dissolved at that size), tracking eased `0.2em` → `0.15em`, sizing on
`min-height` rather than vertical padding, and a border/label alpha that
actually clears a contrast floor. Measured before → after (light / dark):
border `1.26:1 → 3.08:1` / `1.37:1 → 3.16:1`; `.btn-primary` label
`4.37:1 → 5.85:1` / `8.28:1` unchanged; `.btn-danger` label
`3.72:1 → 5.48:1` / `4.93:1 → 6.67:1`.

| Class | What it is |
|---|---|
| `.btn` | The base pill button — mono `500`, `10.5px`, `0.15em` tracking, uppercase, `40px` radius, `min-height: 40px`, border at `color-mix(in srgb, var(--fg) 50%, transparent)`. |
| `.btn-primary` | Filled with `--accent-strong` (not `--accent` — see §5), text in `--accent-ink`. One per view. |
| `.btn-danger` | Text/border in `--crit-strong` (not `--red` — see §5); fills on hover. |
| `.btn-ghost` | The quiet outline tier — `color-mix(in srgb, var(--fg) 24%, transparent)` border, `--muted` label, no fill. Still defined in Red to fix a gap where PMO's own markup uses `.btn-ghost` without ever defining it; the old `--ghost` fill read at `1.09:1` against white and vanished entirely on a `.card` ground. |
| `.btn.sm` / `.btn-sm` | The compact size — `min-height: 30px`, `9.5px` type. `.btn-sm` is a standalone alias so it works without also requiring `.btn`. |
| `.btn-text` | A button styled as an inline text link — no border, no radius, no padding. |

### Pills & identity

| Class | What it is |
|---|---|
| `.pill`, `.pill.doing`/`.review`/`.crit`/`.ok` | The rounded status pill and its semantic colour variants. |
| `.own`, `.own i` | An attribution row — name plus a tiny circular initials avatar. |
| `.avatar-s` | A standalone small circular avatar (same geometry as `.own i`, usable outside `.own`). |
| `.tag-chip`, `.tag-chip.mono` | A removable chip inside `.tag-input` — plain or uppercase-mono. |

### Forms

| Class | What it is |
|---|---|
| `.field`, `.field .flabel` | A labelled field wrapper / its mono uppercase label. |
| `.field input`/`textarea`/`select` | The shared control chrome: `10px` radius, `--card` fill, border eases to `--accent` on focus. |
| `.ferr` | Inline field error text — red, mono. |
| `.check` | A labelled checkbox row; the box itself is a custom 5px-radius square with an accent check mark, not the native control. |
| `.field-input`, `.field-label` | Standalone aliases of `.field input` / `.field .flabel`, for markup outside a `.field` wrapper. |
| `.tag-input`, `.tag-chip` | A multi-value input (enum choices, scale labels) with removable chips. |
| `.statesel` | A status pill that *is* a real `<select>` — the control sits transparent and absolutely-positioned over the pill so it keeps the pill's shape while staying keyboard-reachable. |
| `.lexical-wrap`, `.lexical-toolbar`, `.lexical-tool`, `.lexical-div`, `.lexical-editable`, `.lexical-placeholder` | The Lexical rich-text editor's chrome (`.card` surface + 10px radius): outer wrapper / toolbar row / a toolbar button / a toolbar divider / the editable body / its empty-state placeholder text. |

Selects get one more layer: under `@supports (appearance: base-select)`,
`.field select` upgrades from a styled native trigger to a fully themed
`::picker(select)` panel (rounded-14 card, the §7.2 shadow, options with
hover/checked states). Browsers without that support keep the styled
trigger and the OS's native picker — both paths are themed, neither is
broken. The chevron itself (`--select-chevron`, §2.2/2.3) is baked as an
SVG data-URI rather than a pseudo-element, because a classic `<select>`
ignores `::before`/`::after` in every engine; only the `base-select` path
can use a real pseudo-element (`::picker-icon`).

### Tables

| Class | What it is |
|---|---|
| `.tscroll` | Sideways-scroll wrapper for a table wider than its container — edge-fade gradients plus small arrow hints that self-hide once you've scrolled to that edge. |
| `.dtable`, `.dtable.compact` | The standard data table (mono uppercase headers, hairline rows) / a denser-padding variant. |
| `.pmatrix` | The permissions matrix — centred cells, muted `.locked` rows. |
| `.docs-prose table` | Markdown tables inherit the `.dtable` grammar automatically. |

### Overlays

| Class | What it is |
|---|---|
| `.overlay`, `.modal`, `.modal.wide` | The fixed backdrop / the dialog panel / its wide (760px) variant. |
| `.modal .mhead`, `.mbody`, `.mfoot` | Dialog header (carries a `.zone-label`) / body / footer action row. |
| `.acc`, `.disclosure` | Native `<details>` wrappers — the config accordion, and the public report's collapsed sections. |
| `.mark` | The registration-mark crosshair (`Modal`) — a small `::before`/`::after` cross drawn in `--accent`, positioned absolutely on a `position: relative` corner. |
| `[data-sonner-toast]` | On-brand theming for the `sonner` toast library — rounded-12 body, `--fg`/`--muted` text, `--accent` success icon, `--red` error icon, a themed close button. |

### Data display

| Class | What it is |
|---|---|
| `.stats`, `.stat` | The KPI strip — an auto-fit grid of hairline-gap cells. |
| `.mstones`, `.ms`, `.ms.sub` | Milestone/progress rows with an inline bar; `.sub` is the indented child variant. |
| `.card`, `.card.dragging`, `.card.committed` | The ticket/entity card, its mid-drag state, and its "just landed" flash animation. |
| `.board`, `.bcol`, `.bcol.dragover`, `.badd` | The kanban board / a lane / a lane being dragged over / a lane's add-card control. |
| `.bslot`, `.grip`, `.bdrop`, `.bghost`, `.bmoving` | Drag machinery: card positioning wrapper / drag handle / drop-line indicator / the card riding the pointer / a body-level class while a drag is live. |
| `.feed`, `.evt` | An activity thread and its timestamped entries. |
| `.queue`, `.q` | Numbered "slip" rows — large index numeral, title, trailing metric. |
| `.slates`, `.slate` | Big free-floating stat figures (not gridded/bordered like `.stats`). |
| `.gauges`, `.gauge`, `.gfill.warn`/`.crit`/`.ok` | A labelled reading with a track+fill bar; the fill's semantic colour variants. |
| `.dive`, `.dstop`, `.dstop.now` | A vertical timeline of stops, current stop in accent. |
| `.riskheat`, `.rh` | The likelihood × impact grid, and one cell. |
| `.rag`, `.rag.g`/`.a`/`.r`/`.off` | A small health dot with a matching halo — green/amber/red/off. |
| `.pbar`, `i.warn`/`.crit` | A standalone slim progress bar. |
| `.wsteps`, `.ws.on`/`.done` | A horizontal wizard-step tracker. |
| `.seg`, `button.on` | A segmented filter/choice control — also styles RED's 0–4 rating buttons directly via `.seg button`; no separate `.seg-btn` rule exists. |
| `.bfilters` | The kanban board's own filter-row layout — no control styling of its own, it routes selects through `.field`. |
| `.empty` | A dashed-border empty-state panel. |
| `.alert`, `.alert.warn`/`.error` | An inline banner. |
| `.micro`, `.zone-label` | Small muted mono utility text. |
| `.divider` | A bare 1px hairline rule. |
| `.text-link`, `.muted-link` | Inline accent link / muted-hover-to-`--fg` link. |
| `.menu-row`, `.menu-row--danger` | A dropdown menu row for markup outside `.tbpanel`'s own structure. |
| `.tabs`, `.tabs .ind` | The tab tray — a rounded-12 `.card` strip holding mono tab labels — and its single sliding tile: a lifted rounded-8 `--lift` surface with the §7.2 shadow that `TabRail` (`ui/Tabs.tsx`) moves to whichever tab carries `.active`. No underline, no rule beneath the row. |
| `.tab-panel` | Top padding for a tab's content, plus a margin-collapse reset so a child's own top margin can't leak through. |
| `.tstrip` | The sidebar's small "today's time" readout block. |
| `.card .bsprint` | The sprint label on a kanban card — quiet muted mono, deliberately *not* accent, because it's context rather than state. |
| `.toc-row`, `.toc-row__arrow` | A table-of-contents row (`Toc` component) whose trailing arrow turns accent on row hover. |
| `.report-toc-link` | A public-report ToC link — turns accent on hover. |
| `.react-grid-item.react-grid-placeholder`, `.react-draggable-dragging`, `.react-resizable-handle(-se)` | Theming for `react-grid-layout` on the dashboard: the drop-placeholder (accent-tinted, rounded-14), a raised z-index while dragging, and an accent-on-hover resize handle. |

### Charts

| Class | What it is |
|---|---|
| `.gchart`, `.gchart-scroll`, `.gbar`, `.ghandle`, `.gtip` | The draggable Gantt-style project chart, its scroll wrapper, a draggable bar / resize handle, and its hover tooltip. |
| `.viztip` | The shared tooltip plate for every other chart (the `VizTip` component) — mono readout rows with a stroke swatch per series. |
| `.chart-card`, `.chart-head` | The bordered card a recharts chart sits in, and its title row. |
| `[data-tip]` hover rules | Lift/brighten the hovered mark across `.rh`, `.gauge .gfill`, `.pbar i`, and any other `[data-tip]` element. |
| `.spin`, `.spinner` | The loading spinner — two class names sharing one `@keyframes adaca-spin`. |

### Motion

See §9 for the full behaviour; the classes themselves:

| Class | What it is |
|---|---|
| `.canvas-motion` | The gate class stamped on `<html>` pre-paint, unless the visitor prefers reduced motion. Every animation rule in the file is scoped under it. |
| `.rv`, `.rv.in` | The staggered reveal — `.in` is what `CanvasMotion` adds on intersect. |
| `.rv-fast` | A faster variant (0.5s, 50ms stagger) for elements already on-screen at load. |
| `[data-draw] .draw`, `.dashfade`, `.fill`, `text` | SVG stroke draw-on plus a delayed label fade, for diagrams. |

---

## 9. Motion

Everything animated in the app is gated on `.canvas-motion`, which the
root layout's head script adds to `<html>` before paint *unless* the
visitor has `prefers-reduced-motion: reduce` — every `.rv`/`[data-draw]`
rule in `globals.css` is written `.canvas-motion .rv { … }`, so without the
gate class those elements simply render in their finished state.

**Reveals (`.rv`).** An element starts at `opacity: 0; transform:
translateY(22px)`; `CanvasMotion.tsx` (a client component mounted once in
the root layout) watches every `.rv`/`[data-draw]` on the page with an
`IntersectionObserver` and adds `.in` the moment it scrolls into view,
which transitions it to `opacity: 1; transform: none` over `0.8s`. Stagger
comes from a CSS custom property set inline per element:

```tsx
<h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
```

`transition-delay: calc(var(--i, 0) * 80ms)` — so `--i: 0, 1, 2…` gives a
clean 80ms cascade. `.rv-fast` (50ms stagger, 0.5s duration) is applied
automatically, in JS, to anything already inside the viewport at mount —
those don't wait for the observer, they fire on the next two animation
frames instead.

**Count-ins (`[data-count]`).** Not CSS — `CanvasMotion.tsx` reads
`data-count`/`data-suffix` off any element carrying that attribute and
animates its `textContent` from `0` to the target over 900ms with a cubic
ease-out, once, the first time it intersects.

**The theme transition.** `html`/`body` set `transition: background 0.9s
var(--ease)` (`body` adds `color`), and essentially every themed idiom in
the catalogue repeats `transition: … 0.9s var(--ease)` on its own
background/border/colour properties. That's deliberate: flipping the
`ThemeToggle` should read as the whole screen cross-fading together, not
each panel snapping to its new colours at a different moment.

**Reduced motion.** A single `@media (prefers-reduced-motion: reduce)`
block turns off the `html`/`body` transition and `scroll-behavior`, forces
`.rv`/`.rv-fast` straight to their `.in` state with `!important`, and kills
all `animation`s outright. `CanvasMotion.tsx` also short-circuits on
`document.hidden` (a backgrounded tab freezes CSS animation clocks, and a
reveal that never finishes intersecting would leave the page permanently
half-visible) and finishes every reveal/count-in immediately in that case
too.

### The `.rv` trap

**Never put `.rv` on an element whose `className` React recomputes.**

`CanvasMotion` adds `.in` by calling `el.classList.add('in')` directly on
the live DOM node, and then calls `io.unobserve(el)` — each element only
ever gets this treatment once. React has no idea that mutation happened,
because it manages `className` as a prop, not by reading the DOM. If that
element's `className` is later recomputed by React — a conditional class
string built from state, e.g. `className={active ? 'rv on' : 'rv'}` — React
overwrites `element.className` wholesale on the next render and silently
drops the `.in` the browser already added. Nothing re-triggers the
observer (it already unobserved), so the element is now permanently stuck
at `opacity: 0` with no way back.

Reveal a **static** wrapper instead, and let the dynamic classes live on a
child:

```tsx
// Wrong — className recomputes on `active`, and eventually drops `.in` forever
<div className={active ? 'rv card on' : 'rv card'} style={{ '--i': i }}>

// Right — .rv sits on a wrapper whose className never changes after mount
<div className="rv" style={{ '--i': i }}>
  <div className={active ? 'card on' : 'card'}>…</div>
</div>
```

---

## 10. House rules

- **Active state reads as accent text, or a tint fill — never a dot, never
  a left bar.** This is the dominant pattern, verified across the live
  call sites: `.sb a.sv.on` (accent text + tint fill), `.tabs
  button.active`/`a.active` (accent text on a lifted tile), `.seg button.on`
  (accent text + tint border), `.wsteps .ws.on span` (accent text),
  `.pill.doing`/`.review`/`.crit`/`.ok` (accent/semantic text only). RAG
  dots (`.rag`), avatars and chart marks are **data** — a health signal, an
  identity, a series colour — not a "you are here" affordance, and they
  stay.
  One declared exception worth knowing about: `.tbpanel a.on::before`
  still draws a 3px accent left bar for an active dropdown-panel row. As
  of this doc, **no call site in the app renders
  `.tbpanel`/`.tbrow` with `.on`** — it's dormant, not exercised. If a
  future screen wires up an active row inside a `.tbpanel`, know the bar
  is there; either use it deliberately or drop the rule, don't be
  surprised by it.
- **Colour always goes inline via `var(--token)`; layout goes via
  Tailwind — but prefer a named class from §8 over hand-rolling either.**
  If the idiom you need already exists (a card, a pill, a form field), use
  it; only fall through to raw Tailwind + `var(--token)` for genuinely
  one-off layout.
- **`globals.css` rules are unlayered, and therefore outrank Tailwind
  utilities — deliberately.** Tailwind v4's utilities live inside CSS
  cascade layers (`@import 'tailwindcss'` registers them); every selector
  written directly in `globals.css` is not in any layer. Per the cascade
  layers spec, unlayered rules beat layered ones regardless of
  specificity or source order. This is exploited on purpose in at least
  one place — the comment on `.bfilters` explains that a hypothetical
  `.bfilters select` rule would silently outrank the `.field select`
  styling the `Select` primitive relies on, which is exactly why that
  block deliberately contains no such rule. Know this before reaching for
  a Tailwind utility to override something a named class already styles —
  it won't win.
- **`:focus-visible` is global and visible.** `:focus-visible { outline:
  2px solid var(--accent); outline-offset: 2px; }` is set once on `html`
  and repeated per-idiom where a component needs its own offset (nav rows,
  chevrons, form controls, etc., all `outline-offset: -2px` or similar to
  sit inside their own border rather than outside it). Don't remove focus
  rings; if a control needs a different offset, add it explicitly rather
  than suppressing the outline.

---

## 11. Page composition

The authenticated shell nests three fixed regions and one scrolling
column:

```
.sb (fixed rail, var(--sb-w))   .tb (fixed topbar, 56px)
                                 └─ main.page (margin-left: var(--sb-w); padding-top: 56px)
                                     └─ .wrap (centred content column)
```

Every page's own content then opens with the same header macro: a
`.view-title` with an optional right-aligned primary action, and a `.lede`.
An `.eyebrow` sits above the title only when it carries something the title
doesn't — a record's type on `NodeShell` (`.eyebrow-row`, with its state
pills) — never to restate the title or the section the sidebar and topbar
already show; the list, report, search, dashboard and public pages have none.
Real example (`EntityListPage.tsx`, trimmed):

```tsx
<div>
  <div className="flex items-end justify-between gap-6 flex-wrap">
    <h1 className="view-title rv flex items-center gap-3">
      {title}
    </h1>
    <span className="rv flex items-center gap-3" style={{ '--i': 1 } as CSSProperties}>
      <Link href={`${basePath}/new`} className="btn btn-primary sm">
        New {def.label}
      </Link>
    </span>
  </div>
  <p className="lede rv" style={{ '--i': 1 } as CSSProperties}>
    {count} {word} on record. Filter by any tracked field, or open one for the full detail.
  </p>

  <div className="mt-10">{/* page body */}</div>
</div>
```

The title row is a `flex justify-between` so the one primary action sits
right-aligned against the title, not the lede. `--i` staggers the reveal
(§9): title implicitly first (`0`), action and lede both `1` (they appear
together).

When a view carries a tab strip, the macro above describes the *container*
and is rendered once — the section by its `layout.tsx` (e.g.
`(app)/admin/layout.tsx`), the record by `NodeShell` — the tray follows it,
and each tab's own head is `.subhead` (an h2 `.sub-title` + one
right-aligned action) + a `.lede`, via `SubHead` (`ui/SubHead.tsx`).
Everything above the tray must be identical for every tab, so the strip
never moves between them.

---

## 12. What was deliberately not ported

`globals.css` carries a "PORT NOTES" comment block (near the end of the
file, just before the RED-specific idioms) recording exactly what didn't
make the crossing from PMO's Canvas system, and why:

**Skipped outright — zero Red call sites:**

| Idiom | What it was |
|---|---|
| `.fleet` / `.fl` | Portfolio water-bars |
| `.cmx` | Compliance matrix |
| `.roster` / `.r*` | Resourcing views |
| `.lgroup` / `.lrow` | Ledger rows |
| `.gate` | Gate plaque |
| `.rail` | Client-portal view-stop nav |
| `.evid` | Sign-off evidence |

Re-port any of these from `/Users/lambros/Apps/adaca/pmo/src/app/globals.css`
if a future Red screen needs the idiom — they were never translated onto
Red's token/radius scale, so treat PMO's version as a starting point, not
a drop-in.

**Deleted outright — zero Red call sites, verified by grep:** `.btn-dark`,
`.btn-lg`, `.axis`, `.section-header`(`-rule`), `.zone-tag`, `.rev-tag`,
`.nav-link` (+ `.nav-link-bar`), `.nav-section-link`, `.coord`,
`.index-card`, `.split-prose`(`--note`), `.report-tile`(`__arrow`),
`.disclosure-caret`, `.canvas-grid`. The nav-prefixed ones went when the
sidebar was rebuilt on `.sb`/`.nv` (§8, Shell); the rest went with the 14
unused `canvas/*` components they belonged to. **Do not reintroduce
`.canvas-grid`** (the old dot-grid texture) or the `§NN` section-header/
rev-stamp furniture (`.section-header`, `.zone-tag`, `.rev-tag`) — none of
it survived the port, and nothing in the current app expects it.


---

## 13. Analytics idioms

What this app adds on top of Canvas (the `ANALYTICS IDIOMS` block at the end
of `globals.css`). Every value sits on the scales above.

| Class | What it is |
|---|---|
| `.kpi`, `.kv`, `.kf`, `.kspark` | The KPI tile: a mono figure (`.slate` grammar at card size), the footer row with its delta, and a 34px sparkline in `--series-1`. |
| `.delta`, `.delta.up`, `.delta.down` | Relative change against the previous period, coloured by the semantic tones because it is state, not a series. |
| `.rank`, `.rh`, `.rr`, `.rl`, `.rval` | The ranked list: header row, then rows with a `--w`-driven `--series-1` share wash behind label and value. **`.rval`, not `.rv`** — `.rv` is the reveal class. |
| `.live` | The realtime readout: a `.rag.g` dot with a `.canvas-motion`-gated pulse ring. |
| `.tbctl`, `.tbbtn` | Topbar readout buttons (site switcher, period) in the `.tbswitch` grammar, each dropping a `.tbpanel`; `.tbpanel.range` is the period form, `.tbpanel.center` centres under its trigger. |
| `.widget`, `.wbody`, `.wbody.center`, `.wnote` | A `.chart-card` that fills its grid cell; the scrolling body; a centred empty/error message; note prose. |
| `.pick`, `.pick.on` | A `.card` that is a button — the builder's category / dataset / chart-type choices. |
| `.sbtgl` | The drawer-only theme toggle, shown under 900px where the topbar's is hidden. |
| `a.rr.link`, `.dlink` | A ranked row or table cell that opens an entity page: the cursor plus an `--accent` underline on hover say "this opens"; the share wash deepens on hover. |
| `.chart-click`, `.tick-link`, `.ctip`, `a.kpi`, `.kopen` | The chart affordances: a clickable plot and its legend take the pointer; axis labels that open something underline in the accent; the one tooltip (`.ctip`) lists the values and ends with the click hint in accent mono ("Click to open", "Click to narrow to this day"); a KPI tile that is a link colours its figure on hover and carries a small "open ↗" cue. Marks that open nothing keep the default cursor and no hint. |
| `.detail`, `.bgrid`, `.bcard`, `.wnote-hint` | The entity page: the stat strip draws its own hairlines (`box-shadow`) so a wrapped last row never shows a grey block; breakdown cards sit in an auto-fill 3-up grid that stacks under 640px; the hint links to Settings when the pair families are missing. `.view-title.mono` renders paths and hosts in the mono face at a smaller size. |

Small screens (`max-width: 640px`): the topbar drops its mono labels and the
theme toggle, and the dashboard grid stops being a grid — widgets stack
full-width with resize handles hidden (react-grid-layout's inline transforms
lose to `!important` overrides on purpose).
