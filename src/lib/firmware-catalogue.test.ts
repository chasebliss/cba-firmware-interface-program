// Tests for the catalogue module's pure core: the manifest rules that used
// to exist as inline copies (the "./" filename strip, the name comparator,
// pedal grouping) plus the admin mapper that applies the same defaults the
// public loader does.

import { describe, expect, test } from "vitest";
import { GOLD, adminCatalogueFrom } from "./admin-firmware";
import {
  byName,
  filenameOf,
  noteItems,
  pedalsIn,
  versionsOf,
} from "./firmware-catalogue";

describe("filenameOf", () => {
  test("strips the manifest's leading ./", () => {
    expect(filenameOf("./MOOD_MKII_1.1.bin")).toBe("MOOD_MKII_1.1.bin");
  });

  test("leaves a bare basename alone", () => {
    expect(filenameOf("fw.hex")).toBe("fw.hex");
  });
});

describe("byName", () => {
  test("orders case-insensitively", () => {
    expect(byName({ name: "alpha" }, { name: "BETA" })).toBeLessThan(0);
    expect(byName({ name: "Zeta" }, { name: "alpha" })).toBeGreaterThan(0);
  });

  test("returns 0 on equal names so the sort is stable", () => {
    // The inline copies this replaced returned 1 here, letting equal-named
    // rows swap order between loads.
    expect(byName({ name: "MOOD" }, { name: "mood" })).toBe(0);
  });
});

describe("noteItems", () => {
  test("one change per line, blank lines dropped", () => {
    expect(
      noteItems("Sliders sometimes fully unresponsive\n\nBypass mute quicker "),
    ).toEqual([
      { text: "Sliders sometimes fully unresponsive", depth: 0 },
      { text: "Bypass mute quicker", depth: 0 },
    ]);
  });

  test("an indent nests the line one level", () => {
    expect(
      noteItems("LOOP starts in play from LONG\n  Still cleared from SHORT"),
    ).toEqual([
      { text: "LOOP starts in play from LONG", depth: 0 },
      { text: "Still cleared from SHORT", depth: 1 },
    ]);
  });

  test("bullet markers are optional and stripped", () => {
    expect(noteItems("- foo\n  * bar\n+ baz")).toEqual([
      { text: "foo", depth: 0 },
      { text: "bar", depth: 1 },
      { text: "baz", depth: 0 },
    ]);
  });

  test("deeper indents clamp to one level", () => {
    // A sidebar column has no room for a third level.
    expect(noteItems("a\n        b")).toEqual([
      { text: "a", depth: 0 },
      { text: "b", depth: 1 },
    ]);
  });

  test("a tab counts as an indent", () => {
    expect(noteItems("a\n\tb")[1]).toEqual({ text: "b", depth: 1 });
  });

  test("empty and undefined give no items", () => {
    expect(noteItems("")).toEqual([]);
    expect(noteItems(undefined)).toEqual([]);
    expect(noteItems("   \n  ")).toEqual([]);
  });
});

describe("pedalsIn", () => {
  test("dedupes, trims, drops empties, sorts", () => {
    const pedals = pedalsIn([
      { pedal: "MOOD MKII " },
      { pedal: "BIGTIME" },
      { pedal: "" },
      { pedal: "MOOD MKII" },
    ]);
    expect(pedals).toEqual(["BIGTIME", "MOOD MKII"]);
  });
});

describe("versionsOf", () => {
  const v = (pedal: string, uploadedAt: string | null) => ({
    pedal,
    uploadedAt,
  });

  test("filters to one pedal, newest release first", () => {
    const all = [
      v("BIGTIME", "2026-08-01T00:00:00Z"),
      v("MOOD MKII", "2026-04-23T23:00:00Z"),
      v("BIGTIME", "2026-08-12T00:00:00Z"),
    ];
    expect(versionsOf(all, "BIGTIME").map((e) => e.uploadedAt)).toEqual([
      "2026-08-12T00:00:00Z",
      "2026-08-01T00:00:00Z",
    ]);
  });

  test("entries with no date sink to the bottom", () => {
    const all = [v("BIGTIME", null), v("BIGTIME", "2026-08-01T00:00:00Z")];
    expect(versionsOf(all, "BIGTIME").map((e) => e.uploadedAt)).toEqual([
      "2026-08-01T00:00:00Z",
      null,
    ]);
  });
});

describe("adminCatalogueFrom", () => {
  test("maps entries with the shared defaults and strips ./ filenames", () => {
    const [fw] = adminCatalogueFrom({
      nightly: [{ name: "BIGTIME 1.0.2", filepath: "./BIGTIME_1.0.2.hex" }],
    });
    expect(fw).toEqual({
      name: "BIGTIME 1.0.2",
      pedal: "",
      filename: "BIGTIME_1.0.2.hex",
      target: "nightly",
      bgColor: GOLD,
      description: "",
      internalNotes: "",
      uploadedAt: null,
      updatedAt: null,
      active: true,
    });
  });

  test("entries predating the active field count as listed", () => {
    const [fw] = adminCatalogueFrom({
      beta: [{ name: "FW", filepath: "./fw.bin" }],
    });
    expect(fw.active).toBe(true);
    const [unlisted] = adminCatalogueFrom({
      beta: [{ name: "FW", filepath: "./fw.bin", active: false }],
    });
    expect(unlisted.active).toBe(false);
  });

  test("flattens all channels and sorts by name", () => {
    const merged = adminCatalogueFrom({
      production: [{ name: "zeta", filepath: "./z.bin" }],
      nightly: [{ name: "Alpha", filepath: "./a.bin" }],
    });
    expect(merged.map((e) => e.name)).toEqual(["Alpha", "zeta"]);
  });
});
