# Chase Bliss Audio — Design System

Chase Bliss Audio (CBA) makes boutique, handcrafted guitar effects pedals. Each pedal is a unique instrument — highly collectable, deeply artistic, and beloved by experimental musicians worldwide. The company blends technical precision with an artisan, human-centred philosophy. Collaborations with other audio brands (e.g. Goodhertz for "Lossy") are a recurring thread.

## Brand Tagline
**"Digital Brain Analog Heart"** — core brand philosophy. Every pedal fuses digital processing power with analog warmth and human expression. This phrase appears in the footer of every page as an SVG lockup.

## Products (Active Lineup)
| Product | Tagline | Notes |
|---|---|---|
| Brothers AM | Twins of Tone | Also: Monochrome Edition (LE) |
| Clean | Creative Compressor | |
| Onward | Dynamic Sampler | |
| Lossy | Artifacts on Demand | Collab: Goodhertz. Also: Monochrome Edition (LE) |
| MOOD MKII | Instant Ambience | |
| Generation Loss MKII | VHS Duplicator | |
| blooper | Bottomless Looper | lowercase brand name |
| CXM 1978 | Vintage Studioverb | Part of "Automatone" line |
| CHOMPI | Sampler | Separate nav section |
| Habit | — | Recent |
| Preamp MKII | — | Automatone line |
| Thermae | — | |
| Condor HiFi | — | |
| Dark World | — | |
| Warped Vinyl HiFi | — | |

## Sources

- **Codebase**: `cba-firmware-interface-program/` — the "Bliss Programmer" firmware updater web app, live at [https://firmware.chasebliss.com](https://firmware.chasebliss.com)
- **Product photography**: `assets/lossy.png` (Lossy pedal, collab with Goodhertz), `assets/mood.png` (MOOD MKII pedal)
- **Logo SVG**: `assets/logo.svg` (wordmark, extracted from app source)
- **Decorative asset**: `assets/binaryV2.svg` (binary/code art used as hero illustration)

---

## Brand Story
Founded 2013 by **Joel Korte**, named in honor of his brother Chase Korte (killed 2007). The name comes from Joseph Campbell's "Follow Your Bliss." Joel studied EE, worked at ZVEX 2008–2013, then founded Chase Bliss. Headquartered in **Minneapolis, with a team also in Amsterdam**.

Key copy: *"We're a group of pedal makers in Minneapolis. And Amsterdam."* — casual, warm, direct.

Key copy: *"Offer new and deeply personal ways to interact with effects."*

**Art Director**: Eric Nyffeler (explains the cohesive visual identity).

**Founder**: Joel Korte

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Direct and precise** — no filler words. Technical instructions are numbered, clear, and imperative ("Select your pedal", "Click the Update button").
- **Warm but not casual** — never flippant. The brand respects the customer's intelligence and their gear.
- **No exclamation points** in UI copy (except error states with "Flash Blink!" as a playful dev-facing easter egg).
- **No emoji** in UI. The brand's visual richness comes from product photography and typography, not emoji decoration.
- **"Your pedal"** — always possessive, reinforcing ownership and care. "Your pedal may be damaged..." signals serious respect for the user's instrument.
- **Title Case** for product names: "Bliss Programmer", "MOOD MKII", "Lossy", "DFU in FS mode".
- **Sentence case** for instructional copy, descriptions, and labels.
- **We/You**: The UI speaks directly to the user ("Select your pedal", "Connect your pedal"). No corporate "we".
- **Warning copy** is blunt and safety-first: "Your pedal may be damaged by uploading incorrect firmware." — not softened.
- **Beta copy** uses ALL-CAPS tags ("Beta") with a straightforward disclaimer: "Unreleased firmware. For internal testing only, not for customer devices."

### Examples
- "Select your pedal and version from the dropdown menu."
- "Connect your pedal using a data transfer micro USB cable."
- "Your pedal may be damaged by uploading incorrect firmware."
- "Bliss Programmer." (the period is intentional — declarative, definitive)
- "To main site" (lowercase, minimal)

---

## VISUAL FOUNDATIONS

### Colors
- **Cream / Page Background**: `#fefbf6` — warm off-white, used universally as the page and component background. Not pure white; it has warmth.
- **Black**: `#000000` — used for all borders (2px solid), primary text, and the logo.
- **Gold / Amber Accent**: `#ba8e51` — used sparingly in SVG icons (dropdown chevron). Warm, analog-feeling.
- **Success Green**: `#10b981` — Tailwind emerald-500. Used for success states, progress indicators, and the Update button's active border/text.
- **Error Red**: `#ef4444` (red-400/500) — used for warning banners and error states.
- **Pedal-derived palette** (product photography; not used in UI directly):
  - MOOD MKII lavender: `#b48ecf` / `#c4a0d8`
  - Lossy pink: `#f4a0b5` / `#e8789a`
  - Chase Bliss red (hardware accent, top of pedals): `#c0392b`

### Typography
- **Primary font**: Poppins (Google Fonts) — loaded at weights 400, 500, 600, 700 + italic variants
- **No serif, no mono** in the UI. Poppins is the sole typeface.
- **Heading style**: Bold (700), sometimes with a 2px solid black border box around it (`.h1` pattern)
- **Body**: Regular (400), line-height 1.5
- **Italic** is used as an interaction state — buttons go italic on hover. Not decorative.
- **Font smoothing**: `-webkit-font-smoothing: antialiased` applied globally.
- **Scale**: Fluid heading via `calc((2 - 1) * 1.2vw + 1rem)`. Body text ~14–16px.
- **Letter spacing**: Used for uppercase tags (e.g. Beta banner: `letter-spacing: 0.12em`)

### Spacing & Layout
- **Page padding**: `0 7vw` — fluid horizontal padding tied to viewport width.
- **Max content width**: 1200px (nav)
- **Component sizing**: Buttons/labels are fixed `200px wide × 50px tall`. Min-width `204px`.
- **Border**: `2px solid black` on almost all interactive elements and section headers.
- **No border-radius anywhere** — sharp, architectural corners throughout.
- **Vertical rhythm**: margin-bottom 80px on app body.

### Backgrounds & Surfaces
- Single background color `#fefbf6` — no gradients, no textures, no patterns in the UI.
- Pedal photography is full-bleed product shots on white background.
- The `binaryV2.svg` is a decorative hero illustration (binary code art, ~650px wide).
- Overlays and dropdowns use the same cream background with a black border.

### Shadows
- Buttons use `box-shadow: 0 20px 25px -5px rgb(0 0 0/0.1), 0 8px 10px -6px rgb(0 0 0/0.1)` when active/hovered.
- Accordion gets `shadow-xl` on hover.
- Instruction panels use `shadow-2xl`.
- No shadows by default — shadow is earned through interaction or state.

### Animations
- **Fade in on load**: `animation: fadeIn 1s ease-out forwards` on the app body (opacity 0→1).
- **Transitions**: `0.3s ease` for color, `0.15s ease` for transforms, `0.3s ease-in-out` for box-shadow.
- **Hover on back-link SVG**: `translateX(-5px)` — subtle leftward nudge.
- **Accordion chevron**: `rotate(180deg)` on open.
- **Pulse animation**: `cubic-bezier(0.4, 0, 0.6, 1)` for loading states.
- **Vue `<transition name="fade">`**: used for instruction overlays and accordion content.
- No bounces, no spring animations. All easing is smooth/professional.

### Hover & Interaction States
- **Button hover**: font-style becomes `italic` (distinctive, brand-specific pattern).
- **Button disabled**: `opacity: 0.4`, `cursor: not-allowed`, no italic.
- **Dropdown items**: background color changes to the pedal's `bgColor` on hover.
- **Accordion**: box-shadow appears on mouseenter.
- **Navigation link**: SVG icon nudges left on hover.

### Borders
- `2px solid black` universally on buttons, labels, headings, overlays, dropdowns.
- `1px solid black` on accordion window / instruction panels.
- Success state: `2px solid #10b981` on success message.
- Error/warning: `bg-red-400 text-white` inline warning tags (no border).

### Corner Radii
- **Zero.** No `border-radius` anywhere in the custom CSS. All corners are square and sharp.

### Cards & Containers
- Bordered boxes with `2px solid black`, cream fill, optional shadow on hover.
- Instruction panels: `border: 1px solid black`, `padding: 40px`, `width: 500px`.
- No card elevation by default — shadows only appear on interaction.

### Iconography
See ICONOGRAPHY section below.

### Color Vibe of Imagery
- Product photography is studio-shot on **pure white** backgrounds with dramatic shadow — clean, aspirational.
- Each pedal has a distinct pastel/saturated color palette unique to that product (pink, lavender, teal, etc.).
- The CBA "K" mark (small chevron/arrow icon, Chase Bliss logomark) appears on the lower face of each pedal in a contrasting color.

### Transparency & Blur
- No blur effects used.
- Opacity transitions used for button disabled states (0.4) and fade animations.

---

## ICONOGRAPHY

- **No icon library**. The app uses **hand-coded inline SVGs** exclusively.
- **Platform icons**: Apple (iOS-style path) and Windows (4-square grid) SVG icons for instruction selectors. Both are simple, filled, monochrome black.
- **Chevron/arrows**: Standard path-based chevrons (`M15 19l-7-7 7-7` pattern) used for navigation back button and accordion toggle.
- **Download arrow / circle-chevron**: Used in the pedal dropdown — filled with `#ba8e51` (gold).
- **CBA Logomark**: A small "K"-shaped chevron/arrow appears on the physical pedal face, used as a brand stamp. Appears in product photos in the pedal's accent color.
- **No icon font, no Lucide, no Heroicons, no emoji.**
- SVGs are always `currentColor` or hardcoded black/gold — never colored with CSS classes.
- Icon sizes: `w-7 h-7` to `w-8 h-8` (28–32px).

Assets:
- `assets/logo.svg` — CBA wordmark (full name, horizontal)
- `assets/binaryV2.svg` — decorative binary art SVG
- `assets/lossy.png` — product photo, Lossy pedal
- `assets/mood.png` — product photo, MOOD MKII pedal
- `assets/favicon.ico` — site favicon

---

## FILE INDEX

```
README.md                    ← this file
SKILL.md                     ← agent skill definition
colors_and_type.css          ← CSS custom properties: colors, typography, spacing
assets/
  logo.svg                   ← CBA wordmark SVG
  binaryV2.svg               ← decorative binary art
  lossy.png                  ← product photo: Lossy pedal
  mood.png                   ← product photo: MOOD MKII pedal
  favicon.ico                ← favicon
preview/
  colors-base.html           ← base color swatches
  colors-pedals.html         ← pedal-derived color palette
  colors-semantic.html       ← semantic color usage
  type-scale.html            ← typography scale specimen
  type-details.html          ← type details: weights, italic, tracking
  spacing-tokens.html        ← spacing & sizing tokens
  shadows-borders.html       ← shadow system & borders
  components-buttons.html    ← button states
  components-inputs.html     ← dropdowns & inputs
  components-accordion.html  ← accordion component
  components-badges.html     ← status badges & tags
  brand-logo.html            ← logo usage
  brand-pedals.html          ← product photography reference
ui_kits/
  bliss-programmer/
    README.md
    index.html               ← Bliss Programmer firmware app UI kit
    Components.jsx           ← shared components
```
