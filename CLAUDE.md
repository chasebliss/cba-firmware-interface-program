# Bliss Programmer

Rewrite of [`cba-firmware-interface-program`](../../firmware/cba-firmware-interface-program/) (live at [firmware.chasebliss.com](https://firmware.chasebliss.com)). Web-based DFU firmware flasher for Chase Bliss Audio pedals, powered by WebUSB. Chromium-only by hard constraint (Firefox/Safari don't implement WebUSB).

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

## Current shape

The port is done. What exists now:

**Routes** ([`src/App.tsx`](src/App.tsx)) — `/` (production), `/beta` (password-gated), `/nightly` (public), `/admin` (password-gated dashboard). `/` and `/beta` and `/nightly` all render the same [`Programmer`](src/routes/Programmer.tsx) with different `sources`.

**Channels.** Firmware lives in one of three channels, defined by a registry that exists in two copies:

- [`src/lib/admin-firmware.ts`](src/lib/admin-firmware.ts) — browser bundle. Carries URL and presentation fields (`publicBase`, `route`, `color`).
- [`api/admin/channels.js`](api/admin/channels.js) — serverless functions. Carries repo paths (`dir`, `archiveDir`).

They are duplicated because Vercel's Node runtime has no TypeScript transpile step and cannot import from `src/`. **[`api/admin/channels.test.mjs`](api/admin/channels.test.mjs) asserts they stay in sync** — run `node api/admin/channels.test.mjs` after touching either.

**Two manifests per channel.** `<dir>/firmwares.json` is public and lists only listed firmware. `<archiveDir>/firmwares.admin.json` is the full record and is **not served**. Unlisting removes the entry from the public manifest *and* moves the binary from `dir` (built into `dist/`) to `archiveDir` (outside `public/`, so no URL), which is what makes "unlisted" mean "not downloadable". Listing reverses it. Delete removes both copies.

**Ordering rules that must hold** — there is no transaction across GitHub commits, so the invariant is *if the manifest lists it, the file is there*:

- Unlist: write manifests, **then** archive the binary.
- List: restore the binary, **then** write manifests.
- Within `writeManifests`: public copy first, admin copy second.

**Admin API** ([`api/admin/`](api/admin/)) commits to GitHub via the Contents API; Vercel auto-deploys the commit. Uploads therefore do **not** touch the local working tree — after uploading through the admin, `git pull` before working locally.

## Styling: the jsf token standard

This repo conforms to the shared token standard in [`../docs/token-standard.md`](../docs/token-standard.md). It is the only Tailwind repo in that set, and the only one that is client work rather than a personal project.

**Everything lives in [`src/index.css`](src/index.css), in three blocks:**

- `:root` — standard-named tokens (`--bg`, `--text`, `--accent`, `--text-body`). The source of truth.
- `@theme inline` — the Tailwind bridge: `--color-text: var(--text)` and friends, so utilities like `bg-accent` exist. **`inline` is required**, not cosmetic: it makes Tailwind emit `var(--text)` at the use site rather than resolving once at the token block, which is what lets the `[data-theme]` rebind reach the utility.
- `@theme` — fonts, shadows, keyframes. Per-repo vocabulary the standard does not name.

**Adding a colour means adding it in both `:root` and `@theme inline`.** That is the cost of the bridge and the only duplication in the file.

**Never write a raw value in a component.** No `text-[13px]`, no `#ba8e51`, no `text-black`. Use a role: `text-body-sm`, `text-accent`, `text-text/60`. Nine ad-hoc px sizes were collapsed onto seven named roles; adding a tenth undoes that.

**Theming is semantic-layer rebind only.** `/nightly` sets `data-theme="nightly"` on a route wrapper and reassigns tokens. **No rule in a theme block may name a component, a utility class, or an element.** The previous version broke this by redefining `--color-black` to mean light ink, which inverted every consumer and then needed four hand-patches to un-invert the ones that meant literal black. If a theme needs a component override, the fix is a new token, not a new selector.

Two deliberate exceptions, both commented in the file: border-radius rules (geometry, not colour) and `[data-theme] object { color-scheme: normal }`, which stops the inherited dark scheme from giving the embedded `binary.svg` a browser-painted white backdrop.

**Ink that must not follow the theme has its own token.** `--text-fixed` is ink on a `--bad` ground (the red badges) — that red is the same in every theme, so its ink must be too. `--nav-dark-bg` / `--nav-dark-text` are the dark nav, fixed contrast by design.

**Run the checker after touching tokens:**

```bash
node ../check-tokens.mjs .
```

The argument is a path, resolved against your current directory, and the repo's config is keyed off its basename. So `.` from here, or `jsf-bliss-programmer` from `~/Code/jsf/`.

It enforces the naming rules and ratchets raw-hex/raw-px leakage against a recorded baseline. Growth fails. Canvas code (`MouseTrail`, `SuccessBurst`) and palette data (`admin-firmware.ts`) are declared exempt, since canvas `fillStyle` cannot resolve `var()`.

## DFU gotchas to preserve (do not break these)

- **STM32H7 bank-2 nudge** in [`app/dfu-util.js`](../../firmware/cba-firmware-interface-program/app/dfu-util.js) around the `getFirstWritableSegment()` call: `if (segment.start === 0x90000000) segment.start += 0x40000;`. Project-specific fix — keep it.
- **`do_download_multi`** on `dfuse.Device` (added to [`dfu/dfuse.js`](../../firmware/cba-firmware-interface-program/dfu/dfuse.js)): flashes an array of `{ address, buffer }` segments with one manifest at the end, erasing only unique sector ranges (so overlapping STM32H7 dual-bank segments don't double-erase, which costs 1-2s per sector). Not in upstream [`devanlai/webdfu`](https://github.com/devanlai/webdfu) or [`@flipperdevices/webdfu`](https://github.com/flipperdevices/webdfu).
- **Intel HEX parser** splits records into new segments at address gaps (dfu-util parity). Avoids writing massive 0xFF padding across disjoint flash regions.
- **Interface selection on multi-interface devices**: the connect flow filters to the interface whose name includes `0x08000000` (STM32 main flash). See `connectToSelectedInterface()` in [`app/dfu-util.js`](../../firmware/cba-firmware-interface-program/app/dfu-util.js).
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
- [`vercel.json`](vercel.json) exists and holds SPA rewrites for `/beta`, `/nightly`, and `/admin`. Each non-root route needs a pair: one for the bare path, one with a `((?!firmware/).*)` negative lookahead so the channel's firmware assets are served as files instead of being swallowed by the SPA fallback. **Adding a channel means adding its rewrite pair here** or the page 404s on refresh and its manifest fetch breaks.
- `archive/` is a top-level directory holding unlisted firmware and the admin manifests. It is deliberately **outside `public/`** so Vite never copies it into `dist/`. Do not move it under `public/` — that would republish everything unlisting is meant to withdraw.

## Jake's conventions (from `~/.claude/CLAUDE.md`)

- Never commit without explicit approval.
- Never add AI attribution (no "Generated with Claude Code" footers, no `Co-Authored-By: Claude`).
- No emojis, no emdashes, no AI-sounding filler in drafted text (PRs, commits, comments).
- Prefer editing existing files over creating new.
- Don't extend scope beyond what was asked.
- Use Context7 MCP for library docs (`resolve-library-id` then `query-docs`), not web search.

## Relevant external refs

- Old repo: [`../../firmware/cba-firmware-interface-program/`](../../firmware/cba-firmware-interface-program/)
- Firmware source: https://github.com/chasebliss/firmware
- WebUSB spec / API: https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API
- DFU origin: https://github.com/devanlai/webdfu (unmaintained reference)
