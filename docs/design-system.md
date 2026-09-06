# Adaca Analytics Design System (Canvas)

> **Single source of truth: `src/app/globals.css`.** Every token, class and value
> in this document was read from that file when it was written. If the two ever
> disagree, the CSS has changed and this document is stale. Fix the document from
> the CSS, and never guess at what it should say.
>
> This is a working reference for building a screen. The one place it looks backward
> is §14, which records what was deliberately left behind when the system was ported.

---

## 1. What This Is

Adaca Analytics runs on **Canvas**, the design system shared with the sibling Adaca
Red and PMO apps, carried over token for token from Red. Two themes, chosen by the
operator and nothing else:

- **Light**, white, the default.
- **Dark**, deepest ink, opt-in.

The root layout (`src/app/layout.tsx`) renders `<html data-theme="light">` on the
server, and that attribute drives every colour in the system through one set of CSS
custom properties. The operator's choice is stored in `localStorage` under the key
`analytics-theme` (`ThemeToggle.tsx`), and a head script stamps
`data-theme="dark"` onto `<html>` before paint when that is what is stored:

```js
// src/app/layout.tsx, runs in <head> before first paint
try{if(localStorage.getItem('analytics-theme')==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}
```

That pre-paint stamp is what prevents a flash of the wrong theme. By the time React
hydrates, the DOM attribute is already correct, and `suppressHydrationWarning` on
`<html>` tells React not to report the difference from its own server-rendered
`data-theme="light"`.

The same script stamps `.canvas-motion` onto `<html>` unless the visitor has
`prefers-reduced-motion: reduce`. See §9.

---

## 2. Tokens

### 2.1 Theme-Invariant (`:root`)

These do not change between light and dark.

| Token | Value | Notes |
|---|---|---|
| `--blue` | `#2074ef` | Used once, for `::selection`. It deliberately does not track the theme's `--accent`. |
| `--ease` | `cubic-bezier(0.22, 0.8, 0.26, 1)` | The one easing curve in the system. Every transition uses it, from a 0.25s hover to the 0.9s theme cross-fade. |
| `--sb-w` | `264px` | Sidebar rail width. Collapses to `0px` under `@media (max-width: 900px)` once the rail becomes an off-canvas drawer. |
| `--font-sans` | `'Geist', system-ui, sans-serif` | Prose, headings, names. |
| `--font-mono` | `'Geist Mono', ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono', monospace` | Every label, unit, id, figure and button. |
| `--amber`, `--red`, `--green` | `#c9862b`, `#d95e4a`, `#2f9e77` | The three raw semantic hues. Same value in both themes. `--warn`, `--crit` and `--ok` alias them (§4). |

Fonts load through a plain CSS `@import` at the top of `globals.css` (Geist weights
300 to 700, Geist Mono 300 to 500), never through `next/font`.

The data ramp (`--accent-1/2/3`, `--accent-tint`, `--chart-1..6`, and the default
`--series-1..6`) also lives in this block. See §3.

### 2.2 Light Theme (Default: `html`, `html[data-theme='light']`)

| Token | Value |
|---|---|
| `--bg` | `#ffffff` |
| `--fg` | `#15293e` |
| `--muted` | `#5a6e86` |
| `--line` | `rgba(21, 41, 62, 0.12)` |
| `--card` | `#f6f8fb` |
| `--card-line` | `rgba(21, 41, 62, 0.1)` |
| `--ghost` | `rgba(21, 41, 62, 0.045)` |
| `--lift` | `#ffffff`, the surface of a raised tile inside a tray (`.tabs .ind`) |
| `--accent` | `#2074ef` |
| `--accent-ink` | `var(--bg)`, which resolves to white |
| `--accent-strong` | `#1a5fd0`, the text-bearing accent (§5) |
| `--info` | `#2a7f8f` |
| `--crit-strong` | `#b8412c`, the text-bearing crit (§5) |
| `--select-chevron` | an inline SVG data URI with the stroke baked as `#5a6e86`, this theme's `--muted` |

### 2.3 Dark Theme (Opt-in: `html[data-theme='dark']`)

| Token | Value |
|---|---|
| `--bg` | `#0a1524` |
| `--fg` | `#f2f6fb` |
| `--muted` | `#8598ae` |
| `--line` | `rgba(242, 246, 251, 0.12)` |
| `--card` | `rgba(255, 255, 255, 0.045)` |
| `--card-line` | `rgba(242, 246, 251, 0.1)` |
| `--ghost` | `rgba(255, 255, 255, 0.055)` |
| `--lift` | `#132235` |
| `--accent` | `#6fb2ff` |
| `--accent-ink` | `var(--bg)`, which resolves to near-black |
| `--accent-strong` | `#6fb2ff`, the same as `--accent`, because dark's accent already clears AA at 8.28:1 |
| `--info` | `#6fd0e0` |
| `--crit-strong` | `#ef7a66`, lifted off `--red` so it stays legible against a tinted hover fill |
| `--select-chevron` | the same SVG with the stroke baked as `#8598ae`, this theme's `--muted` |

Every themed property a component reads (`--bg`, `--fg`, `--card`, borders) transitions
over the same `0.9s var(--ease)` used on `html` and `body`, so flipping the toggle
cross-fades the whole screen at once instead of snapping section by section.

### 2.4 The Rail's Own Palette

The sidebar is always ink. It re-declares `--fg`, `--muted`, `--line`, `--ghost` and
`--accent` inside `.sb` so everything it contains reads on ink in both themes, and it
paints its gradient from two registered custom properties, `--rail-top` (`#142840`)
and `--rail-bottom` (`#0b1930`). Dark sets both to `#0a1524` so the rail merges with
the canvas, and because they are registered with `@property`, the merge rides the
same 0.9s ease as everything else.

---

## 3. Chrome and Data

**This is the most important rule in the file.**

`--accent` (blue: `#2074ef` light, `#6fb2ff` dark) is **chrome**: the rail's active
nav item, links, focus rings, the "you are here" state on tabs and segmented controls.
It is the operator's own colour, the one thing that says "this is interactive". The
`.btn-primary` fill uses `--accent-strong` instead (§5).

The **orange ramp is data, and only data**. It lives in the theme-invariant `:root`
block so it does not change with the theme. Only the blue chrome does.

| Token | Value | Role |
|---|---|---|
| `--accent-1` | `#ffc7ad` | Three-step shorthand: light |
| `--accent-2` | `#f87854` | Three-step shorthand: mid |
| `--accent-3` | `#cf4422` | Three-step shorthand: deep |
| `--accent-tint` | `rgba(248, 120, 84, 0.12)` | A faint orange fill, used for `.docs-prose blockquote` backgrounds |
| `--chart-1` to `--chart-6` | `#d6e6ff`, `#a8c9fb`, `#74a6f4`, `#3f7fe6`, `#2461c8`, `#163d86` | The six-step chart-series ramp, lightest to deepest. Blue by default; Settings, then Appearance, swaps it for red, yellow, green, orange or purple deployment-wide, through `data-palette` on the app wrapper (the ramps sit at the end of `globals.css`) |

`--series-1..6` alias the chart ramp, and **the order reverses by theme** so the
leading series colour stays legible against the ground:

- `:root` default, used by dark: `--series-1..6 = --chart-1..6`. Lightest leads,
  because a light line reads best against dark's near-black `--bg`.
- Light override: `--series-1..6 = --chart-6..1`. Darkest leads, because a light line
  would nearly vanish against white.

In this app the ramp colours every chart mark, every share bar in a ranked list, and
every sparkline. **Never use `--accent` for a chart series. Never use the orange ramp
for a button, a nav item, a link, or a focus ring.** Orange means "this is a measured
value" and blue means "this is a control".

---

## 4. Semantic Tones

Defined once for all themes (`html, html[data-theme='light'], html[data-theme='dark']`):

| Tone | Definition | Tint (chip and banner backgrounds) |
|---|---|---|
| `--ok` | `var(--green)`, `#2f9e77` | `--ok-tint`: `color-mix(in srgb, var(--green) 14%, transparent)` |
| `--warn` | `var(--amber)`, `#c9862b` | `--warn-tint`: `color-mix(in srgb, var(--amber) 14%, transparent)` |
| `--crit` | `var(--red)`, `#d95e4a` | `--crit-tint`: `color-mix(in srgb, var(--red) 14%, transparent)` |
| `--info` | `#2a7f8f` light, `#6fd0e0` dark | no dedicated tint token; themed per block (§2.2, §2.3) |

Tones carry **state**, never data: a KPI delta that went up or down (`.delta.up`,
`.delta.down`), an ingest run's status pill (`.pill.ok`, `.pill.crit`, `.pill.doing`),
a realtime dot that is live (`.rag.g`), an inline banner (`.alert.warn`,
`.alert.error`). A chart series is never a tone.

---

## 5. Text-Bearing Tokens

Text placed **on** an accent-coloured fill uses `--accent-ink`, defined as `var(--bg)`
in both theme blocks, so it flips with the theme:

- Light: `--accent-ink` resolves to white, on the light theme's darker, more saturated
  blue (`#2074ef`).
- Dark: `--accent-ink` resolves to near-black (`#0a1524`), on the dark theme's lighter,
  less saturated blue (`#6fb2ff`).

The CSS comment on the token spells out why it cannot be hardcoded: `#fff` on the dark
theme's lighter accent reads at roughly 2.1:1 and fails WCAG outright. Tying it to
`--bg` gives white-on-blue in light and navy-on-light-blue in dark, about 8.4:1.

`--accent-strong` and `--crit-strong` solve a related problem: a token that carries
text or a control boundary directly. `.btn-primary` fills with `--accent-strong`
(`#1a5fd0` light, unchanged in dark) because `--accent`'s white label reads 4.37:1 on
the light theme's `#2074ef`, under AA at the button's 10.5px type, while
`--accent-strong` reads 5.85:1. `.btn-danger`'s text and border likewise moved from
`--red` (3.72:1) to `--crit-strong` (`#b8412c` light, `#ef7a66` dark; 5.48:1 and
6.67:1). **Both tokens are for text-bearing or control-boundary use only.** The `.btn`
family is their only consumer. Chrome fills, bars and marks keep `--accent` and
`--crit`, and neither token touches the orange ramp.

---

## 6. Typography

### 6.1 Fonts

Geist (sans) and Geist Mono, loaded by the CSS `@import` at the top of `globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500&display=swap');
```

### 6.2 Weights and Sizes

- **Body:** `font-weight: 300`, `font-size: 15px`, `line-height: 1.6`.
- **Headings** (`h1`, `h2`, `h3`): `font-weight: 600`, `letter-spacing: -0.02em`.
- `.view-title` (the page `<h1>`, §11) adds `clamp(26px, 4.4vw, 42px)` and a `1.1`
  line height. `.sub-title` (a tab's `<h2>`) is `clamp(20px, 3.2vw, 26px)` at `1.15`.
- `.lede` is `clamp(14.5px, 2.2vw, 16.5px)` at `1.75`, muted, capped at `54ch`.
- The modal title (`.mhead .mtitle`) is `clamp(16px, 3.6vw, 18px)`, inheriting weight
  and tracking from the shared heading rule.

### 6.3 The Mono Tracking Scale

Every mono label sits on one of these tracking values, tighter as the text gets
quieter:

| Tracking | Example classes | Used for |
|---|---|---|
| `0.26em` | `.eyebrow`, `.viztip .vk` | The loudest labels: page kickers, tooltip headers. |
| `0.2em` | `.tbmenu`, `.tbsect`, `.zone-label` | Topbar readouts, generic zone labels. |
| `0.18em` | `.field .flabel`, `.field-label`, `.sb .glabel`, `.brand span`, `.tabs button`, `.tgl`, `.wsteps .ws span`, `.live`, `.slate > span`, `.tbpanel .plabel` | Form labels, nav group headers, tabs, wizard steps, the live readout. |
| `0.16em` | `.pill`, `.mono-micro`, `.stat > span`, `.dtable th`, `.seg button`, `.rank .rh` | Status pills, table headers, stat captions, segmented controls, ranked-list headers. |
| `0.15em` | `.btn` | Buttons, eased from 0.2em so uppercase caps stop dissolving at 10.5px. |
| `0.14em` | `.tbbtn`, `.btn-text` | Topbar control buttons, text-styled buttons. |
| `0.12em` | `.delta small` | The "vs prev" caption beside a KPI delta. |
| `0.1em` | `.viztip .vr > span` | Chart tooltip units. |
| `0.06em` | `.delta` | The KPI delta figure itself. |
| `0.04em` | `.micro`, `.viztip .vn` | The quietest mono caption text, not uppercased. |

`.stat > span` tightens further, to `0.12em`, only inside the `max-width: 480px`
override.

### 6.4 Mono or Sans

If it is **machine-like** (a label, a tag, a count, a status, a date, a key, a figure,
an id) it is **Geist Mono, uppercase, positive tracking**, on one of the steps above.
If it is **language** (a heading, a sentence, a name, a description) it is **Geist**,
sentence case. This split is why the system reads as an instrument rather than a
generic app. Keep it strict when adding UI.

---

## 7. Geometry

### 7.1 Radius Scale

Radius is deliberately expressive under Canvas and steps through eight values,
verified against real call sites:

| Radius | Used for | Example classes |
|---|---|---|
| `6px` | Tiny chips | `.brand span` (the rail's product tag) |
| `8px` | Nav rows and compact menu rows | `.sb a.nv`, `a.sv`, `.chev`, `.add`, `.tbswitch`, `.tbmenu`, `.tbbtn`, `.tbpanel a`, `.tbrow`, `.menu-row`, `.tabs .ind`, `.rank .rr`, the modal close button, `select option` |
| `10px` | The default control radius | `.field input`, `textarea`, `select`, `.field-input`, `.viztip`, `.docs-prose code` and `pre` |
| `12px` | Small panel and group surfaces | `.sb .grp`, `.tbpanel`, `.stats`, `.alert`, `.tabs`, `[data-sonner-toast]` |
| `14px` | The standard card surface | `.card`, `.empty`, `.chart-card`, `.field select::picker(select)`, the react-grid-layout placeholder |
| `16px` | Dialogs | `.modal` |
| `20px` | Pills | `.pill`, `.seg button` |
| `40px` | Full-pill buttons and toggles | `.btn`, `.tgl` |
| `50%` | Circles | `.spin`, `.spinner`, `.rag` |

A few thin functional elements (the `.pbar` track and fill at 3px, the `.check` box at
5px) use radii sized to their own stroke width rather than this scale. `.btn-text` is
the one deliberate `border-radius: 0`, because it is a link styled as a button rather
than a boxed control.

### 7.2 The Shadow Idiom

One recipe, reused for every floating or elevated surface:

```
box-shadow: 0 <offset>px <blur>px -<spread>px rgba(10, 21, 36, <alpha>);
```

| Element | Value |
|---|---|
| `.tbpanel` | `0 24px 60px -24px rgba(10, 21, 36, 0.45)` |
| `.card:hover` | `0 16px 40px -22px rgba(10, 21, 36, 0.5)` |
| `.field select::picker(select)` | `0 24px 64px -28px rgba(10, 21, 36, 0.55)` |
| `.viztip` | `0 18px 48px -20px rgba(10, 21, 36, 0.5)` |
| `.sb.open` (mobile drawer) | `24px 0 80px -40px rgba(10, 21, 36, 0.6)`, horizontal because it slides in from the left |
| `.tabs .ind` | `0 0 0 1px var(--card-line), 0 8px 20px -14px rgba(10, 21, 36, 0.45)` |

The colour is always `rgba(10, 21, 36, …)` regardless of theme. Even on the light
theme an elevated panel drops a dark shadow, since a light shadow on white would
vanish. Offset runs 16 to 24px, blur 40 to 80px, spread -20 to -40px; the negative
spread keeps the shadow tight to the panel. Reserve it for things that float above the
canvas: dropped panels, open pickers, a tooltip. Never a resting card or an input.

A `box-shadow` with zero offset and blur and a positive spread is a different idiom, a
**halo** ring: `.rag.g` (`0 0 0 3px color-mix(in srgb, var(--green) 18%, transparent)`)
and `.field select:open` (`0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent)`).
Do not confuse the two.

---

## 8. Idiom Catalogue

Every named class in `globals.css`, grouped, one line each.

### Shell

| Class | What it is |
|---|---|
| `.wrap` | The page content column: `min(1100px, 100%)`, centred, with the page's vertical rhythm (`112px` top, `176px` bottom, tightening at narrower breakpoints). Wrap every page's content in this. |
| `.sb` | The fixed sidebar rail, `var(--sb-w)` wide. Ink gradient in light, flat `--bg` in dark. Becomes an off-canvas drawer (`.sb.open`) under 900px. |
| `.brand`, `.brand span` | The rail's logo row, and the small mono product-tag chip beside the wordmark. |
| `.sb nav`, `.grp`, `.glabel` | The nav's grouped-section wrapper, a group card, and its mono group heading. |
| `.sb a.nv`, `a.nv.on` | A top-level nav row and its active state (white text on an accent-tint fill, the one place active reads as white rather than accent, because it already sits inside the rail's tinted chrome). |
| `.sect.chv`, `.chev` | A nav section with a sub-view disclosure, and its chevron toggle button. |
| `.sect.addable`, `.add` | A group header with a hover-revealed "+" quick action (the Custom group's New dashboard). Shown outright on touch devices. |
| `.sb .views`, `.views.x` | The collapsible sub-view list, animated through `grid-template-rows: 0fr` to `1fr`. |
| `.sb a.sv`, `a.sv.on` | A sub-view row and its active state (accent text on an accent-tint fill). |
| `.tgl` | The theme-toggle pill. Lives in the topbar (`.tbctl`) and, under 900px, in the drawer (`.sbtgl`). |
| `.sbtgl` | The drawer-only wrapper for the theme toggle, shown under 900px where the topbar's is hidden. |
| `.tb` | The fixed topbar: 56px, blurred glass over the canvas. |
| `.tbl`, `.tbdrop`, `.tbmenu` | Topbar left cluster, a dropdown's positioning wrapper, and the mobile menu button. |
| `.tbswitch`, `.tbswitch.static` | A section readout button, or a non-interactive label when there is nothing to switch to (the setup screen before any site exists). |
| `.tbsect` | The mono "current section" label inside a readout button. |
| `.tbpanel`, `.tbpanel.right`, `.tbrow`, `a.on` | The dropped panel, its right-anchored variant, a row inside one, and an active row (accent text on a tint fill). |
| `.tbsep` | A divider rule inside a panel. |
| `.scrim` | The drawer's backdrop, mobile only. |
| `main.page` | Content offset for the fixed rail and topbar (`margin-left: var(--sb-w); padding-top: 56px`). |
| `.logo-light`, `.logo-dark` | The theme-aware wordmark swap. `.logo-light` is hidden by default and shown only under `[data-theme='light']`, which hides `.logo-dark` at the same time. |

### Type

| Class | What it is |
|---|---|
| `.eyebrow`, `.eyebrow.neutral` | The mono kicker above a page title, accent by default, `.neutral` for muted. |
| `.eyebrow-row` | An identity line pairing the eyebrow with state pills, always rendered so the header below never shifts. |
| `.view-title` | The page `<h1>` (§6.2, §11). |
| `.subhead`, `.sub-title` | The head of a tab's own content under a tab tray whose container header the layout owns (§11): `.subhead` is the flex row (h2 plus one right-aligned action), `.sub-title` the h2 itself. Built by `SubHead`. |
| `.lede` | The intro paragraph under a title, muted, capped at 54ch. |
| `.mono-micro` | Small muted mono caption text, uppercased. |
| `.micro` | The quietest mono caption text, not uppercased. |
| `.mono` | A bare `font-family: mono` utility for an inline value that needs the face without a named idiom. |
| `.zone-label` | Small muted mono utility text at 0.2em, used as the eyebrow of an empty state. |
| `.docs-prose` | Full markdown typography for note widgets: headings, lists, blockquote, code and pre, tables. The one place prose gets real heading spacing. |

### Buttons

The 40px-radius pill silhouette is unchanged from the Canvas port. What changed is the
weight and contrast: mono `500` at `10.5px` (the body's `300` dissolved at that size),
tracking eased from `0.2em` to `0.15em`, sizing on `min-height` rather than vertical
padding, and a border alpha that clears a contrast floor (border `3.08:1` light,
`3.16:1` dark; `.btn-primary` label `5.85:1` light, `8.28:1` dark; `.btn-danger` label
`5.48:1` light, `6.67:1` dark).

| Class | What it is |
|---|---|
| `.btn` | The base pill: mono `500`, `10.5px`, `0.15em` tracking, uppercase, `40px` radius, `min-height: 40px`, border at `color-mix(in srgb, var(--fg) 50%, transparent)`. |
| `.btn-primary` | Filled with `--accent-strong` (§5), text in `--accent-ink`. One per view. |
| `.btn-danger` | Text and border in `--crit-strong` (§5); fills on hover. |
| `.btn-ghost` | The quiet outline tier: a `24%` ink border, a `--muted` label, no fill. |
| `.btn.sm`, `.btn-sm` | The compact size: `min-height: 30px`, `9.5px` type. `.btn-sm` is a standalone alias that works without `.btn`. |
| `.btn-text` | A button styled as an inline text link: no border, no radius, no padding. |

### Pills

| Class | What it is |
|---|---|
| `.pill`, `.pill.doing`, `.review`, `.crit`, `.ok` | The rounded status pill and its semantic variants. The ingestion page maps run status onto them (`running` is `.doing`, `done` is `.ok`, `failed` is `.crit`). |

### Forms

| Class | What it is |
|---|---|
| `.field`, `.field .flabel` | A labelled field wrapper and its mono uppercase label. |
| `.field input`, `textarea`, `select` | The shared control chrome: `10px` radius, `--card` fill, border eases to `--accent` on focus. `color-scheme` flips per theme so native date pickers match. |
| `.ferr` | Inline field error text, red, mono. |
| `.check` | A labelled checkbox row. The box is a custom 5px-radius square with an accent mark, not the native control. |
| `.field-input`, `.field-label` | Standalone aliases of `.field input` and `.field .flabel` for markup outside a `.field` wrapper. |

Selects get one more layer. Under `@supports (appearance: base-select)`,
`.field select` upgrades from a styled native trigger to a fully themed
`::picker(select)` panel: a rounded-14 card with the §7.2 shadow, options with hover
and checked states, the current value read in accent. Browsers without that support
keep the styled trigger and the OS picker. Both paths are themed. The chevron itself
(`--select-chevron`, §2.2 and §2.3) is baked as an SVG data URI rather than a
pseudo-element, because a classic `<select>` ignores `::before` and `::after` in every
engine. Only the `base-select` path can use a real pseudo-element (`::picker-icon`).

### Tables

| Class | What it is |
|---|---|
| `.tscroll` | Sideways-scroll wrapper for a table wider than its container, with edge-fade gradients and shadow hints that hide once you reach that edge. |
| `.dtable`, `.dtable.compact` | The standard data table (mono uppercase headers, hairline rows) and a denser variant. |
| `.dtable td.m` | A mono, muted cell. |
| `.docs-prose table` | Markdown tables take the `.dtable` grammar automatically. |

### Overlays

| Class | What it is |
|---|---|
| `.overlay`, `.modal`, `.modal.wide` | The fixed backdrop, the dialog panel, and its wide (760px) variant. |
| `.modal .mhead`, `.mtitle`, `.mbody`, `.mfoot` | Dialog header, its title, body, and footer action row. The header's close button restates the rail's `.add` affordance on the modal's palette. |
| `.acc` | A native `<details>` accordion with a rotating "+" marker. |
| `[data-sonner-toast]` | On-brand theming for the sonner toast library: a rounded-12 body, `--fg` and `--muted` text, `--accent` success icon, `--red` error icon, a themed close button. |

### Data Display

| Class | What it is |
|---|---|
| `.stats`, `.stat` | The KPI strip: an auto-fit grid of hairline-gap cells. |
| `.card`, `.card .top`, `.tid`, `h3` | The entity card, its header row, a mono id, and its title. Lifts on hover. |
| `.slates`, `.slate` | Big free-floating mono figures, not gridded or bordered like `.stats`. |
| `.rag`, `.rag.g`, `.a`, `.r`, `.off` | A small health dot with a matching halo: green, amber, red, off. |
| `.pbar`, `i.warn`, `.crit` | A standalone slim progress bar, driven by `--w`. The ingest banner uses it. |
| `.wsteps`, `.ws.on`, `.done`, `.wl` | A horizontal wizard-step tracker and the line between steps. The setup wizard and the widget builder both use it. |
| `.seg`, `button.on` | A segmented choice control: the period presets, the wizard's mode switch, the builder's "Show as". |
| `.empty` | A dashed-border empty-state panel. |
| `.alert`, `.alert.warn`, `.error` | An inline banner. |
| `.divider` | A bare 1px hairline rule. |
| `.text-link`, `.muted-link` | An inline accent link, and a muted link that reads `--fg` on hover. |
| `.menu-row`, `.menu-row--danger` | A dropdown menu row for markup outside `.tbpanel`, and its red variant. |
| `.tabs`, `.tabs .ind` | The tab tray, a rounded-12 `.card` strip of mono tab labels, and its single sliding tile: a lifted rounded-8 `--lift` surface with the §7.2 shadow that `TabRail` (`ui/Tabs.tsx`) moves to whichever tab carries `.active`. No underline, no rule beneath the row. |
| `.tab-panel` | Top padding for a tab's content, plus a margin-collapse reset so a child's own top margin cannot leak through. |
| `.react-grid-item.react-grid-placeholder`, `.react-draggable-dragging`, `.react-resizable-handle(-se)` | Theming for react-grid-layout on the dashboard: an accent-tinted rounded-14 drop placeholder, a raised z-index while dragging, and a corner resize handle that turns accent on hover. |

### Charts

| Class | What it is |
|---|---|
| `.chart-card`, `.chart-head` | The bordered card a chart sits in, and its title row. Only a direct child `svg` fills the card; a recharts surface sizes itself. |
| `.viztip` | The shared tooltip plate (the `VizTip` component): mono readout rows with a stroke swatch per series. |
| `.spin`, `.spinner` | The loading spinner, two class names sharing one `@keyframes adaca-spin`. |

### Motion

See §9 for the behaviour. The selectors:

| Selector | What it is |
|---|---|
| `.canvas-motion` | The gate class stamped on `<html>` before paint, unless the visitor prefers reduced motion. Every animation rule in the file is scoped under it. |
| `.rv`, `.rv[data-in]`, `.rv[data-fast]` | The staggered reveal, its finished state, and the faster variant (0.5s, 50ms stagger) for elements already on screen at mount. |
| `[data-draw] .draw`, `.dashfade`, `.fill`, `text` | SVG stroke draw-on plus a delayed label fade, for diagrams. |
| `.canvas-motion .live .rag.g::after` | The realtime pulse ring. |
| `.canvas-motion .viztip` | The tooltip's entrance stamp. |

---

## 9. Motion

Everything animated in the app is gated on `.canvas-motion`, which the root layout's
head script adds to `<html>` before paint unless the visitor has
`prefers-reduced-motion: reduce`. Every `.rv` and `[data-draw]` rule in `globals.css`
is written `.canvas-motion .rv { … }`, so without the gate class those elements render
in their finished state.

**Reveals (`.rv`).** An element starts at `opacity: 0; transform: translateY(22px)`.
`CanvasMotion.tsx`, a client component mounted once in the root layout, watches every
`.rv`, `[data-draw]` and `[data-count]` on the page and stamps **`data-in`** on the
element (an attribute, not a class) the moment it scrolls into view, which
transitions it to `opacity: 1; transform: none` over `0.8s`. Stagger comes from a CSS
custom property set inline per element:

```tsx
<h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
```

`transition-delay: calc(var(--i, 0) * 80ms)` gives a clean 80ms cascade. Anything
already inside the viewport at mount is stamped `data-fast` (50ms stagger, 0.5s
duration) and fires on the next two animation frames instead of waiting for the
observer.

**Count-ins (`[data-count]`).** Not CSS. `CanvasMotion.tsx` reads `data-count` and
`data-suffix` off any element carrying them and animates its `textContent` from `0`
to the target over 900ms with a cubic ease-out, once, the first time it intersects.

**Streamed content.** `CanvasMotion` scans on every route change and also watches the
document with a `MutationObserver`, because a segment with a `loading.tsx` commits the
pathname change with its Suspense fallback on screen. A pathname-only scan would run
against the skeleton and never see the page, leaving every `.rv` at `opacity: 0`.

**Hydration.** Streamed markup reaches the observer before React hydrates it, and
React 19 logs a mismatch for any attribute the DOM carries that its props do not. So
`CanvasMotion` waits for the node's React fiber before stamping, with a long wall-clock
cap because a background tab defers hydration until it is shown again.

**Hidden tabs.** A backgrounded tab freezes CSS animation clocks, so a reveal that
never finishes would leave the page half-visible and a count-in would show zeros. When
`document.hidden` is true, `CanvasMotion` settles elements straight to their finished
state instead.

**The theme transition.** `html` and `body` set `transition: background 0.9s
var(--ease)` (`body` adds `color`), and every themed idiom repeats the same `0.9s
var(--ease)` on its own background, border and colour. Flipping the toggle reads as
the whole screen cross-fading together.

**Reduced motion.** A single `@media (prefers-reduced-motion: reduce)` block turns off
the `html` and `body` transition and `scroll-behavior`, forces `.rv` straight to its
finished state with `!important`, and disables every `animation`.

### The `.rv` Rules

- **Do not stamp `data-in` yourself.** `CanvasMotion` owns it. Server-rendering the
  attribute would skip the reveal and, worse, race the hydration check above.
- **Do not rename `.rv`, and do not reuse it as a class name for anything else.** The
  ranked list's value cell is `.rval`, not `.rv`.
- `.rv` can sit on any element, including one whose `className` React recomputes,
  because the finished state is an attribute React does not manage.

---

## 10. House Rules

- **Active state reads as accent text, or a tint fill. Never a dot, never a left
  bar.** Verified across the live call sites: `.sb a.sv.on` (accent text plus tint
  fill), `.tabs button.active` and `a.active` (accent text on a lifted tile),
  `.seg button.on` (accent text plus tint border), `.wsteps .ws.on span` (accent text),
  `.pill.doing` and the semantic pills (accent or tone text only). RAG dots (`.rag`)
  and chart marks are data, a health signal or a series colour, and they stay.
- **Colour always goes through `var(--token)`. Layout goes through Tailwind. Prefer a
  named class from §8 over hand-rolling either.** If the idiom you need already
  exists (a card, a pill, a form field), use it. Fall through to raw Tailwind plus
  `var(--token)` only for one-off layout.
- **`globals.css` rules are unlayered, and therefore outrank Tailwind utilities, on
  purpose.** Tailwind v4's utilities live inside CSS cascade layers, and every
  selector written directly in `globals.css` is in no layer. Per the cascade layers
  spec, unlayered rules beat layered ones regardless of specificity or source order.
  Know this before reaching for a Tailwind utility to override something a named class
  already styles. It will not win.
- **`:focus-visible` is global and visible.** `:focus-visible { outline: 2px solid
  var(--accent); outline-offset: 2px; }` is set once on `html` and repeated per idiom
  where a component needs its own offset (nav rows, chevrons, form controls, all at
  `outline-offset: -2px` or similar to sit inside their own border). Do not remove
  focus rings. If a control needs a different offset, add it explicitly.
- **Chrome is blue, data is orange, state is a tone** (§3, §4). A chart series is
  never `--accent`, a button is never orange, and a delta is never a series colour.

---

## 11. Page Composition

The shell nests three fixed regions and one scrolling column:

```
.sb (fixed rail, var(--sb-w))   .tb (fixed topbar, 56px)
                                 main.page (margin-left: var(--sb-w); padding-top: 56px)
                                   .wrap (centred content column)
```

Every page's own content opens with the same header macro: a `.view-title` with an
optional right-aligned primary action, and a `.lede`. The dashboard screen
(`DashboardGrid.tsx`) is the reference:

```tsx
<div className="flex items-end justify-between gap-6 flex-wrap">
  <h1 className="view-title rv">{dashboard.name}</h1>
  <span className="rv flex items-center gap-2" style={{ '--i': 1 } as CSSProperties}>
    <button type="button" className="btn btn-ghost btn-sm">Customise</button>
  </span>
</div>
<p className="lede rv" style={{ '--i': 1 } as CSSProperties}>{lede}</p>
```

The title row is a `flex justify-between` so the primary action sits right-aligned
against the title, never the lede. `--i` staggers the reveal (§9): the title first
(`0`), then the action and the lede together (`1`).

When a view carries a tab strip, the macro above describes the *container* and is
rendered once by the section's `layout.tsx` (Settings is the example). The tray
follows it, and each tab's own head is `.subhead` (an h2 `.sub-title` plus one
right-aligned action) and a `.lede`, via `SubHead` (`ui/SubHead.tsx`). Everything
above the tray must be identical for every tab so the strip never moves between them.

An `.eyebrow` sits above the title only when it carries something the title does not.
No screen in this app currently uses one.

---

## 12. Analytics Idioms

What this app adds on top of Canvas (the `ANALYTICS IDIOMS` block at the end of
`globals.css`). Every value sits on the scales above.

| Class | What it is |
|---|---|
| `.kpi`, `.kv`, `.kf`, `.kspark` | The KPI tile: a mono figure in the `.slate` grammar at card size, the footer row with its delta, and a 34px sparkline in `--series-1`. |
| `.delta`, `.delta.up`, `.delta.down` | Relative change against the previous period, coloured by the semantic tones because it is state, not a series. |
| `.rank`, `.rh`, `.rr`, `.rl`, `.rval` | The ranked list: a header row, then rows with a `--w`-driven `--series-1` share wash behind label and value. Inside a widget the header is sticky. **`.rval`, not `.rv`.** |
| `a.rr.link`, `.dlink` | A ranked row or table cell that opens an entity page: the cursor plus an `--accent` underline on hover say "this opens", and the share wash deepens on hover. |
| `.chart-click`, `.tick-link`, `.ctip`, `a.kpi`, `.kopen` | The chart affordances: a clickable plot and its legend take the pointer, axis labels that open something underline in the accent, the one tooltip (`.ctip`) lists the values and ends with the click hint ("Click to open", "Tap again to open" on touch), and a KPI tile that is a link shows `.kopen` on hover. |
| `.detail`, `.bgrid`, `.bcard`, `.wnote-hint` | The entity page: the stat strip draws its own hairlines (`box-shadow`) so a wrapped last row never shows a grey block, breakdown cards sit in an auto-fill 3-up grid, and `.wnote-hint` is the one-line notice above them. |
| `.tbmid`, `.tbbtn.filter`, `.tbx`, `.tbpanel.filter`, `.srow`, `kbd.kb` | The topbar's middle group: the period and filter buttons, the filter's clear cross, the filter panel with its saved-segment rows, and the shortcut key caps beside presets (hidden on touch). |
| `.tblive`, `.tbmenu`, `.hb`, `.tbbrand`, `.sbfoot`, `.sbsites` | The live-count chip (desktop), the drawer button whose three bars fold into a cross while open, the mark at the bar's left on small screens, and the drawer foot with the site picker and theme toggle. |
| `.seeall`, `.explore` | "See all" in a card head (shown on hover, always on touch) and the explore page's tools row, sticky header and scrolling table. |
| `.share-root`, `.share-brand`, `.sharerow` | A shared dashboard's shell (no rail, `--sb-w: 0`; `.embed` drops the bar) and the rows of the share dialog. |
| `[data-palette]`, `.swatches` | The chart palette stamped on the app and share wrappers, and the six-swatch preview on the Appearance page. |
| `.live` | The realtime readout: a `.rag.g` dot with a `.canvas-motion`-gated pulse ring. |
| `.tbctl`, `.tbbtn` | Topbar readout buttons (the site switcher and the period control), each dropping a `.tbpanel`. `.tbpanel.range` is the period form, `.tbpanel.center` centres under its trigger, `.tbpanel .plabel` labels a group inside it. |
| `.widget`, `.wbody`, `.wbody.center`, `.wnote` | A `.chart-card` that fills its grid cell, the scrolling body, a centred empty or error message, and note prose. Inside a widget a table's `.tscroll` becomes the scroller so its `thead` can stick. |
| `.pick`, `.pick.on` | A `.card` that is a button: the builder's category, dataset and chart-type choices, and the new-dashboard template choices. |
| `.sbtgl` | The drawer-only theme toggle wrapper. |

---

## 13. Responsive Behaviour

| Breakpoint | What changes |
|---|---|
| `max-width: 900px` | `--sb-w` becomes `0px`. The rail becomes an off-canvas drawer (`.sb.open`) behind a `.scrim`, hidden from the tab order and accessibility tree while closed. The topbar shows `.tbmenu`. Right-anchored panels and `.tbpanel.center` drop as a sheet under the bar. `.wrap` tightens to `72px 20px 112px`. The theme toggle appears in the drawer (`.sbtgl`). |
| `max-width: 900px` | The rail is a drawer behind the hamburger, which takes the bar's right end; the mark takes the left; the site switcher and the live count leave the bar for the drawer's foot. The dashboard grid stops being react-grid-layout's: `.react-grid-layout` becomes a two-column CSS grid (`data-wide` widgets and notes span both), inline transforms lose to `!important` overrides on purpose, and edit mode swaps the drag handle for `.wmove` buttons. |
| `max-width: 640px` | Modal padding tightens and modals become bottom sheets (`.overlay` anchors to the bottom, `.mbody` scrolls, `.mfoot` sticks). The topbar drops its mono readout labels and the theme toggle. KPI tiles shrink to their content (a 2×2 strip), charts take a fixed phone-sized plot, lists grow to their rows, the step indicator keeps only the current step's name, and wide tables are replaced by `.mcard` lists through the `.only-sm` and `.not-sm` pair. On coarse pointers rows, links and panel items grow their padding, never their type. |
| `max-width: 480px` | The `.stats` strip tightens. |
| `max-width: 420px` | `.wrap` tightens to `64px 16px 96px`. |
| `pointer: coarse` | Form controls read at 16px so iOS Safari does not zoom on focus. The smallest controls grow their padding, not their type: `.btn` to a 44px minimum, `.btn.sm` to 40px, `.check input` to 20px. |

---

## 14. What Was Not Ported

`globals.css` carries a `PORT NOTES` comment block recording what did not make the
crossing from Red's Canvas: the kanban board and its drag machinery, milestone rows,
the activity feed, the project chart, queue slips, gauges, the dive line, the risk
heat map, the permission matrix, the Lexical editor, the tag input, the topbar
identity chip and the sign-in furniture. None of them has a call site here.

Re-port any of these from `/Users/lambros/Apps/adaca/red/src/app/globals.css` if a
future screen needs the idiom, and treat Red's version as a starting point rather
than a drop-in.

The `SHARED ALIASES` block that follows it keeps the standalone forms of a few Canvas
idioms (`.mono`, `.btn-sm`, `.text-link`, `.muted-link`, `.menu-row`, `.spinner`,
`.divider`, `.field-input`, `.field-label`) because the components ported from Red use
them.
