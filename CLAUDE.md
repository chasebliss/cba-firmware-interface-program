# Bliss Programmer

Rewrite of [`cba-firmware-interface-program`](../cba-firmware-interface-program/) (live at [firmware.chasebliss.com](https://firmware.chasebliss.com)). Web-based DFU firmware flasher for Chase Bliss Audio pedals, powered by WebUSB. Chromium-only by hard constraint (Firefox/Safari don't implement WebUSB).

## What the old app does (functionally, to preserve)

- Fetches a firmware catalogue at runtime from [`chasebliss/firmware`](https://github.com/chasebliss/firmware) on GitHub via `data/sources.json`.
- Lets the user pick a pedal+version OR upload their own `.bin` / `.hex` file.
- Connects to the pedal in DFU mode over WebUSB and flashes it.
- Has a password-gated `/beta` route pulling from a different source list (internal firmware).
- Mac/Windows hover instructions (Windows also has a Zadig driver install video).
- Mobile: just shows "use desktop Chrome" and hides everything else.

## Stack decision

**Vite 8 + React 19 + TypeScript 6 + Tailwind v4.**

Evaluated Next.js and Astro, rejected both:

- **Next.js**: every WebUSB-touching component needs `"use client"` + `dynamic(() => import(...), { ssr: false })`. You're spending effort opting out of a framework's main feature. The previous Next.js attempt in the old repo stalled for this reason (see leftover `.next/` + `vite-version/` directories).
- **Astro**: value prop is "ship less JS via islands". This app is one big interactive island. Zero payoff for the added mental model.
- **Vite**: no SSR to turn off, `navigator.usb` just works. Vercel serves `dist/` statically. Framework gets out of the way.

## Current scaffold state

Built from `npm create vite@latest bliss-programmer -- --template react-ts`, then:

- Added `tailwindcss` + `@tailwindcss/vite`. Imported via `@import "tailwindcss";` in [`src/index.css`](src/index.css). No `tailwind.config.js` needed (v4 idiom).
- Path alias `@/*` → `src/*` in [`tsconfig.app.json`](tsconfig.app.json) and [`vite.config.ts`](vite.config.ts).
- Stripped Vite demo assets, blank placeholder [`src/App.tsx`](src/App.tsx).
- `.prettierrc` matches old project (`{"embeddedLanguageFormatting": "auto"}`).
- `.gitignore` extended with `.vercel` and `.env*.local`.
- `git init` run locally. No commits, no remote.
- `npm run build` passes clean.

## Next up (port plan)

Jake is providing design files (he uses "Claude Design" — format TBD, could be HTML/CSS, React, Figma export, or screenshots). Don't port UI until those land.

Port order, rough:

1. **DFU library → TypeScript**. Files to port: [`dfu/dfu.js`](../cba-firmware-interface-program/dfu/dfu.js), [`dfu/dfuse.js`](../cba-firmware-interface-program/dfu/dfuse.js), [`dfu/FileSaver.js`](../cba-firmware-interface-program/dfu/FileSaver.js) (only if upload/save is needed — the current UI hides upload). Target: `src/lib/dfu/` as a pure, no-DOM module. **Keep the byte flow identical** — it works on real pedals.
2. **Intel HEX parser** from [`app/app.js`](../cba-firmware-interface-program/app/app.js) (`parseIntelHex`). Already clean, just move it to `src/lib/dfu/intel-hex.ts`.
3. **Firmware catalogue fetcher**. Replicate `importfirmwares()` in [`app/app.js`](../cba-firmware-interface-program/app/app.js). Type the firmware record shape.
4. **UI shell**. Once design files are in, wire up the pedal picker, connect button, update button, progress bar, instruction popovers, browser warning.
5. **Beta route**. Use `react-router` for `/` and `/beta`. The beta route uses a different `sources.json` and shows a beta banner.
6. **Auth middleware + API**. Port [`middleware.js`](../cba-firmware-interface-program/middleware.js) and [`api/beta-login.js`](../cba-firmware-interface-program/api/beta-login.js) as-is to repo root — Vercel detects them independent of the Vite build. See cleanups below.

## DFU gotchas to preserve (do not break these)

- **STM32H7 bank-2 nudge** in [`app/dfu-util.js`](../cba-firmware-interface-program/app/dfu-util.js) around the `getFirstWritableSegment()` call: `if (segment.start === 0x90000000) segment.start += 0x40000;`. Project-specific fix — keep it.
- **`do_download_multi`** on `dfuse.Device` (added to [`dfu/dfuse.js`](../cba-firmware-interface-program/dfu/dfuse.js)): flashes an array of `{ address, buffer }` segments with one manifest at the end, erasing only unique sector ranges (so overlapping STM32H7 dual-bank segments don't double-erase, which costs 1-2s per sector). Not in upstream [`devanlai/webdfu`](https://github.com/devanlai/webdfu) or [`@flipperdevices/webdfu`](https://github.com/flipperdevices/webdfu).
- **Intel HEX parser** splits records into new segments at address gaps (dfu-util parity). Avoids writing massive 0xFF padding across disjoint flash regions.
- **Interface selection on multi-interface devices**: the connect flow filters to the interface whose name includes `0x08000000` (STM32 main flash). See `connectToSelectedInterface()` in [`app/dfu-util.js`](../cba-firmware-interface-program/app/dfu-util.js).
- **Vendor ID filter**: `const vid = 1155` (STMicroelectronics `0x0483`). Hardcoded in the connect click handler.

## DFU library choice (decided, do not re-litigate)

Keep the existing DFU code, port to TypeScript. Do **not** swap for `@flipperdevices/webdfu` or any other library. Reasons:

- `@flipperdevices/webdfu` last released 2021-09-01. The original `devanlai/webdfu` last released ~6 years ago. Both stale.
- The existing code has Jake's project-specific fixes listed above. Porting those into a stranger's library is risk for no user-visible gain.

## Auth port notes

Two cleanups to make while porting `middleware.js` + `api/beta-login.js`:

1. **Don't store the plain password in the cookie.** Current: `beta_auth=<password>`. Even with HttpOnly + Secure, a cookie leak equals a password leak. Swap to a signed token: `HMAC(BETA_SECRET, "ok")`. Same UX, opaque cookie.
2. **Remove `TEST_FALLBACK_PASSWORD = "cba"`** from both files. It's in git history already (not a catastrophe, rotate when convenient). Require `BETA_PASSWORD` env var to be set, fail closed if missing.

The middleware.js / `api/*.js` file convention works on Vercel regardless of framework — no special config needed.

## Deploy

- Hosted on Vercel. Current domain: firmware.chasebliss.com.
- **Never run `vercel`, `vercel deploy`, or `git push` to a branch wired to auto-deploy without explicit per-push approval.** Jake handles all deploys himself. Build and test locally only.
- `vercel.json` not yet created. Add one only if we need rewrites/headers (likely not — `public/` serves static fine).

## Jake's conventions (from `~/.claude/CLAUDE.md`)

- Never commit without explicit approval.
- Never add AI attribution (no "Generated with Claude Code" footers, no `Co-Authored-By: Claude`).
- No emojis, no emdashes, no AI-sounding filler in drafted text (PRs, commits, comments).
- Prefer editing existing files over creating new.
- Don't extend scope beyond what was asked.
- Use Context7 MCP for library docs (`resolve-library-id` then `query-docs`), not web search.

## Relevant external refs

- Old repo: [`../cba-firmware-interface-program/`](../cba-firmware-interface-program/)
- Firmware source: https://github.com/chasebliss/firmware
- WebUSB spec / API: https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API
- DFU origin: https://github.com/devanlai/webdfu (unmaintained reference)
