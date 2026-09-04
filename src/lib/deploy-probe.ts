// The deploy probe: owns per-row CDN deploy state for the admin dashboard.
// A row is "live" once its binary is served, "pending" after a 404 (uploaded,
// but Vercel hasn't finished redeploying), "checking" while the first HEAD
// probe is in flight.
//
// This used to live inline in LocalFlasher with two real bugs the extraction
// fixes:
//
//   - Staleness: a probe kicked off by an older catalogue load could resolve
//     AFTER a newer load's probe and overwrite fresh statuses with stale
//     ones. Probes now carry a generation number, and a result only lands if
//     no newer probe has started since.
//   - Interval churn: the re-poll effect depended on the status record it was
//     itself writing, so every poll tore down and rebuilt the interval. It
//     now keys on the SET of pending rows, and background re-polls write
//     nothing unless a status actually changed — the interval survives quiet
//     polls. (Re-polls also no longer flick rows to "checking" every 10s;
//     "checking" is the first probe's state, not a recurring flicker.)
//
// rowKey is exported because the same `target:filename` identity keys the
// toggling/deleting spinners and the overwrite confirmation, not just this
// probe — one spelling, defined once.

import { useEffect, useRef, useState } from "react";
import {
  isRealFirmware,
  publicBaseFor,
  type AdminFirmware,
  type DeployStatus,
  type SavedFirmware,
} from "@/lib/admin-firmware";

// The stable identity of a catalogue row. Filenames are only unique within a
// channel — the same binary can sit in beta and nightly at once — so the key
// needs both halves.
export const rowKey = (e: { target: string; filename: string }): string =>
  `${e.target}:${e.filename}`;

const REPOLL_MS = 10_000;

export const useDeployProbe = () => {
  const [status, setStatus] = useState<Record<string, DeployStatus>>({});
  // Bumped by every probe(); in-flight HEAD results from older generations
  // are discarded instead of landing late over newer ones.
  const genRef = useRef(0);
  // The rows the latest probe() covered — what background re-polls draw from.
  const probedRef = useRef<SavedFirmware[]>([]);

  const headProbe = async (entry: SavedFirmware, gen: number) => {
    const url = `${publicBaseFor(entry.target)}${entry.filename}?t=${gen}`;
    let result: DeployStatus;
    try {
      const resp = await fetch(url, { method: "HEAD", cache: "no-store" });
      result = resp.ok ? "live" : "pending";
    } catch {
      result = "pending";
    }
    if (gen !== genRef.current) return;
    setStatus((prev) =>
      prev[rowKey(entry)] === result
        ? prev
        : { ...prev, [rowKey(entry)]: result },
    );
  };

  // Probe every served row in `entries`. Called after each catalogue load.
  // Skips rows with no served URL: the mock has no CDN presence, and unlisted
  // firmware has been moved out of public/ on purpose — a 404 there is the
  // correct state, not a deploy still in flight.
  const probe = (entries: AdminFirmware[]) => {
    const gen = ++genRef.current;
    const real = entries.filter(isRealFirmware).filter((e) => e.active);
    probedRef.current = real;
    setStatus((prev) => {
      const next = { ...prev };
      for (const e of real) next[rowKey(e)] = "checking";
      return next;
    });
    for (const e of real) void headProbe(e, gen);
  };

  // Re-poll pending rows every 10s — so when Vercel finishes a redeploy the
  // red dots flip green without the admin having to click Refresh. Keyed on
  // the set of pending rows: quiet polls don't disturb the interval, and it
  // stops itself the moment nothing is pending.
  const pendingKeys = Object.keys(status)
    .filter((k) => status[k] === "pending")
    .sort()
    .join("|");
  useEffect(() => {
    if (!pendingKeys) return;
    const keys = new Set(pendingKeys.split("|"));
    const id = window.setInterval(() => {
      const gen = genRef.current;
      for (const e of probedRef.current) {
        if (keys.has(rowKey(e))) void headProbe(e, gen);
      }
    }, REPOLL_MS);
    return () => window.clearInterval(id);
  }, [pendingKeys]);

  return { status, probe };
};
