# Handoff: Bliss Programmer Redesign
## cba-programmer-v2 · firmware.chasebliss.com

---

## Overview

This is the UI redesign for all three routes of the Bliss Programmer web app:

| Route | Component | Purpose |
|---|---|---|
| `/` | `Programmer` | Public firmware flasher — production catalogue |
| `/beta` | `Programmer` (beta) | Internal firmware flasher — beta catalogue, password-gated |
| `/admin` | `LocalFlasher` | Admin tool — upload local files, flash, save to repo, manage catalogue |

---

## About the Design Files

The files in this bundle are **high-fidelity HTML prototypes** — they show the intended look, layout, interactions, and copy. They are not production code. Your task is to **recreate these designs in the existing `cba-programmer-v2` codebase** (Vite + React 19 + TypeScript + Tailwind v4), using its established component conventions.

The real WebUSB/DFU logic already exists in `src/lib/dfu/` and `src/lib/firmware-catalogue/` — these designs only replace the UI layer. Wire the new components onto the existing hooks and handlers in `Programmer.tsx` and `LocalFlasher.tsx`.

**Reference file:** `Bliss Programmer — All Pages.html` — open this in Chrome and use the route switcher at the bottom (`/ Home`, `/beta`, `/admin`) to preview all three pages.

---

## Design Tokens

### Colors
```
--cream:   #fefbf6   (page background, button background)
--ink:     #000000   (borders, text, primary)
--gold:    #ba8e51   (dropdown chevron accent)
--green:   #10b981   (success state, connected, update complete)
--red:     #ef4444   (beta banner, warning note, delete actions)
```

### Typography
- **Primary font:** Poppins (already loaded in app)
- **Mono font:** JetBrains Mono (used in admin page: filename, hex color, status readout)
- Base body: Poppins 13–14px, weight 400/700
- Section labels: 10px, weight 700, uppercase, letter-spacing 0.12em, color rgba(0,0,0,0.38)
- Step card titles: 13px, weight 700
- Page h1: `clamp(1.4rem, 2.2vw, 2rem)`, weight 700, letter-spacing -0.02em

### Spacing
- Page horizontal padding: `7vw`
- Max content width: `1200px`
- Grid gap (divider columns): `1px solid rgba(0,0,0,0.09)`
- Card inner padding: `15px 20px`
- Section gap (between labeled sections): `28px` bottom padding + border + `28px` top margin

### Borders & Shadows
- All primary borders: `2px solid #000`
- Card inner dividers: `1px solid rgba(0,0,0,0.08)`
- Dropdown open shadow: `0 8px 24px rgba(0,0,0,0.1)`
- Button hover shadow: `0 8px 20px rgba(0,0,0,0.11)`

---

## Shared Components

### `<Nav>`
Three-column flex layout, `max-width: 1200px`, `border-bottom: 2px solid #000`, `padding: 18px 0`.
- Left (33%): Back link — arrow SVG + "To main site", uppercase 11px bold, arrow translates -3px on hover
- Center (33%): CBA logo SVG, `width: 130px`
- Right (33%): "Instructions:" label + Mac icon (hover popover) + Windows icon (hover popover)

**Instruction popovers:** absolute positioned, `width: 380px`, cream bg, `border: 1px solid #000`, `padding: 28px`, `box-shadow: 0 20px 50px rgba(0,0,0,0.18)`. Appear on mouse enter, close 150ms after mouse leave (debounced). macOS and Windows variants. Windows has nested "Driver install" expand. Popovers contain the Note warning + numbered steps.

### `<StepCard>` (step number badge)
- `width: 26px`, `height: 26px`, `border: 2px solid #000`
- Idle: cream bg, black text showing step number
- Done: black bg, cream checkmark `✓`
- Transition: `background 0.25s`

### `<PedalDropdown>`
- `border: 2px solid #000`, cream bg, `padding: 12px 16px`
- Selected name renders in the pedal's `bgColor` (color transitions on selection)
- Gold chevron SVG rotates 180° when open
- Open shadow: `0 8px 24px rgba(0,0,0,0.1)`
- Dropdown items: `padding: 11px 16px`, `border-bottom: 1px solid rgba(0,0,0,0.08)`, hover bg = pedal `bgColor`
- Animation: `slideDown 0.1s ease` on open

### `<CbaButton>`
- `border: 2px solid #000`, cream bg, `height: 48px`, `font-weight: 700`, `font-size: 13px`
- Disabled: `opacity: 0.28`, `cursor: not-allowed`
- Hover: `font-style: italic`, `box-shadow: 0 8px 20px rgba(0,0,0,0.11)`
- Success variant: border + text color `#10b981`
- Danger variant: border + text color `#ef4444`

### `<BinaryHero>` (animated SVG)
The `assets/binaryV2.svg` is inlined. Groups with classes `.move-1` through `.move-10` each get a different CSS animation (float, pulse, drift) with staggered delays:
```css
.move-1 { animation: bFloat 3.2s ease-in-out infinite; }
.move-2 { animation: bDrift 4.1s ease-in-out infinite 0.4s; }
.move-4 { animation: bPulse 3.6s ease-in-out infinite 0.2s; }
/* etc — see full list in HTML file */
```
When `flashing=true`, all animation durations compress to `0.6s`.
- `.st0` and `.st1` fill: `#000`
- On `/beta` page: `opacity: 0.25`
- On `/admin` page: `opacity: 0.18`, `width: 200px`

### `<ProgressBar>`
- `height: 5px` (6px in admin), `appearance: none`
- Track: `rgba(0,0,0,0.1)`
- Fill: pedal `bgColor` (set via inline `<style>` tag targeting unique id)
- Fill transition: `width 0.4s ease`

---

## Page: `/` Home

**Layout:** Two-column grid `1fr 1px 300px`, full viewport height.

### Left column (`padding: 44px 52px 80px 0`)
**Heading row:** h1 "Bliss Programmer." + `<BinaryHero width=220 opacity=0.3>` side by side, `gap: 20px`, `align-items: center`.

**Three step cards** stacked with `margin-bottom: -2px` (overlapping borders):

**Card 1 — Select firmware**
- Header row: step badge + "Select firmware" label left; selected pedal color swatch (9×9px) + name right (fades in on selection)
- Body (hidden once step 2 is done): full-width `<PedalDropdown>`
- Background tints to `${pedal.bgColor}10` when selected, transition `0.5s`

**Card 2 — Connect pedal**
- `opacity: 0.28` until step 1 done
- Body: helper text + `<CbaButton>Connect</CbaButton>` (180px wide)
- Header shows "Connected ✓" text in green when done
- Body hidden once connected

**Card 3 — Update firmware**
- `opacity: 0.28` until step 2 done
- Body idle: `<CbaButton success>Update</CbaButton>`
- Body flashing: progress bar + "Uploading… X%" pulsing green text
- Body done: "Update complete." + "Flash again" button

### Right column (`padding: 44px 0 80px 36px`, `position: sticky; top: 24px`)
Section label "Instructions" + macOS/Windows tab strip + instruction content.

Tab strip: `border-bottom: 1px solid rgba(0,0,0,0.15)`. Active tab: `border-bottom: 2px solid #000`, margin-bottom: -1px. Inactive: color `rgba(0,0,0,0.3)`.

---

## Page: `/beta`

Same layout as `/` with these differences:

**Red beta banner** (full-width, above everything):
```
background: #ef4444; color: #fff; padding: 8px 7vw;
```
White pill "BETA" badge + italic text "Unreleased firmware. For internal testing only — not for customer devices."

**Dark nav zone** (replaces standard nav bg):
```
background: #000; padding: 0 7vw;
```
- Logo: `filter: invert(1)`
- Back link: color `#fefbf6`
- Right slot: monospace text "internal · not for customers" in `rgba(254,251,246,0.35)`
- No instructions icons in nav (instructions still in right panel)

**Title:** "Beta Programmer." (not "Bliss Programmer.")

**Dropdown items:** beta catalogue only — e.g. COMBO TEST, MOOD MKII dev, Blooper v3.1-rc

**BinaryHero:** `opacity: 0.25`

---

## Page: `/admin`

**Layout:** Three zones stacked vertically, two-column content grid.

### Admin header stripe
```
background: #000; padding: 0 7vw;
```
Logo (inverted, 70% opacity, 100px wide) + "Admin" label (JetBrains Mono, 11px, uppercase) + "Exit admin" back link (cream 45% opacity).

### Page header
```
background: #fefbf6; border-bottom: 2px solid #000; padding: 0 7vw;
```
Left: eyebrow "firmware.chasebliss.com" (10px, uppercase, 35% opacity) + h1 "Admin Flasher."
Right: `<BinaryHero width=200 opacity=0.18>`

### Two-column body grid: `1fr 1px 400px`

**Left column (`padding: 36px 48px 80px 0`)**

**Section 1 — Load firmware file**
- Label: "1. Load firmware file"
- Drop zone: dashed border (solid when file loaded), upload icon SVG, filename or placeholder text. Border goes solid `#000` on load, background tints to `rgba(186,142,81,0.06)`.
- Below drop zone (when file loaded): filename + size in JetBrains Mono 11px + "Remove" link
- `opacity: 1` always

**Section 2 — Connect & flash** (`opacity: 0.4` until file loaded)
- Label: "2. Connect & flash"
- Two buttons side by side: Connect (170px) + Update (170px, success variant when ready)
- Progress state: progress bar + "Uploading… X%" / "Flash complete."

**Section 3 — Save to repo** (`opacity: 0.4` until file loaded)
- Label: "3. Save to repo (optional)"
- Form fields (all `border: 2px solid #000`, cream bg, `padding: 9px 12px`, bold 13px):
  - **Name** — text input, placeholder "e.g. MOOD MKII v1.2"
  - **Description** — text input, placeholder "Brief changelog", labeled "(optional)"
  - **Accent color** — `<input type="color">` (40×36px, bordered) + hex value in JetBrains Mono + 20×20px color preview swatch
  - **Target** — radio group: Beta / Production
- Save button (180px) + inline success/error message

**Right column (`padding: 36px 0 80px 36px`)**

**Catalogue header:** "In-repo firmwares" section label + "Refresh" link (right-aligned, underlined).

**Filter pills row:** All (count) / Production (count, green) / Beta (count, gold) — each pill: `border: 1px solid rgba(0,0,0,0.12)`, cream bg, `padding: 4px 10px`.

**Firmware table** (`border: 2px solid #000`):
- Header row: `background: rgba(0,0,0,0.03)`, `border-bottom: 2px solid #000`
  - Columns: Target (80px) | Name (1fr) | File (1fr) | Delete (auto)
  - Column labels: 9px uppercase, letter-spacing 0.12em, 35% opacity
- Data rows: `padding: 12px 14px`, `border-bottom: 1px solid rgba(0,0,0,0.07)`
  - Target badge: `font-size: 9px`, uppercase, `color: #ba8e51` (beta) or `color: #10b981` (production)
  - Name: 13px bold
  - Filename: JetBrains Mono 11px, 45% opacity, truncated
  - Delete button: `border: 1px solid #ef4444`, red text 10px uppercase; hover: red bg, cream text. Busy state: `opacity: 0.4`
- Deleting row: `opacity: 0.4`, slight bg tint

**Hint text below table:** 11px, 30% opacity, "Changes committed via Save to repo are visible after the next Vercel deploy."

---

## Interactions & Animations

### Page load
`animation: fadeIn 0.4s ease-out` — opacity 0 + translateY(5px) → opacity 1 + translateY(0)

### Dropdown slide-in
`animation: slideDown 0.1s ease` — opacity 0 + translateY(-6px) → opacity 1 + translateY(0)

### Step cards unlock
`opacity: 0.28` → `opacity: 1`, `transition: opacity 0.3s`

### BinaryHero groups
- `bFloat`: 0%,100% translateY(0) → 50% translateY(-4px)
- `bDrift`: 0%,100% translateX(0) → 50% translateX(3px)
- `bPulse`: 0%,100% opacity 0.55 → 50% opacity 1
- When `flashing=true`: all durations → 0.6s

### Flash progress
Progress bar fill animates via CSS `transition: width 0.4s ease`.
Status text pulses: `animation: pulse 1.8s ease-in-out infinite` (opacity 1 → 0.3 → 1).

### Button hover
`font-style: italic`, `box-shadow: 0 8px 20px rgba(0,0,0,0.11)`, `transition: 0.2s`

### Card 1 background tint
`background: ${pedal.bgColor}10`, `transition: background 0.5s`

---

## Assets

| File | Usage |
|---|---|
| `assets/logo.svg` | CBA wordmark. Invert with `filter: invert(1)` on dark backgrounds. |
| `assets/binaryV2.svg` | Inline as `<BinaryHero>` — do not use as `<img>` (needs class-based animation). |

---

## Files in This Package

| File | Description |
|---|---|
| `Bliss Programmer — All Pages.html` | Main design reference — open in Chrome, use route switcher |
| `assets/logo.svg` | CBA logo |
| `assets/binaryV2.svg` | Binary art SVG |
| `README.md` | This document |

---

## Implementation Notes

- The existing `Nav.tsx` instruction popovers can stay — just restyle to match new layout.
- `BinaryHero.tsx` already exists in the repo. Add the `.move-N` CSS animations to `src/index.css` and pass a `flashing` prop.
- The step-card unlock pattern (opacity + pointer-events) replaces the current centered-column layout in `Programmer.tsx`.
- For `/admin`, the `LocalFlasher.tsx` two-column grid replaces the current centered single-column layout. All existing state, API calls, and handlers stay identical — only the JSX changes.
- Tailwind v4 note: use arbitrary values (`border-[2px]`, `opacity-[0.28]`) or extend the theme for the custom cream/ink/gold/green/red tokens if not already defined in `src/index.css`.
