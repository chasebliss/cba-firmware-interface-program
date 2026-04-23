# Bliss Programmer — UI Kit

Recreates the firmware update web app at [https://firmware.chasebliss.com](https://firmware.chasebliss.com).

## Screens
1. **Default** — empty state, no pedal selected
2. **Pedal Selected** — dropdown open, pedal chosen
3. **Updating** — progress / overlay state
4. **Beta Banner** — internal beta variant

## Components
- `Nav` — top navigation with logo, back link, instructions icons
- `DropdownSelect` — pedal selector accordion  
- `InstructionPanel` — Mac / Windows instruction overlays
- `UpdateButton` — connect + update CTAs
- `BinaryHero` — decorative SVG hero
- `ProgressOverlay` — firmware update progress
- `BetaBanner` — black announcement bar
- `WarningBadge` — red note tag + text

## Usage
Open `index.html` in a browser. Click through states using the screen tabs at top.
