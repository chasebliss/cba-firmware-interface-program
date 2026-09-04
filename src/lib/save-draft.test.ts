// Tests for the pure core of the save-form draft: field defaults, the
// entry-to-fields mapping, dirty-checking and validity. useSaveDraft is a
// thin useState wrapper over these, so this covers the logic that used to
// drift when it was hand-spread through LocalFlasher.

import { describe, expect, test } from "vitest";
import { GOLD, type SavedFirmware } from "./admin-firmware";
import {
  DEFAULT_SAVE_TARGET,
  draftComplete,
  emptyFields,
  fieldsFrom,
  isDraftDirty,
  type DraftFields,
} from "./save-draft";

const entry = (overrides: Partial<SavedFirmware> = {}): SavedFirmware => ({
  name: "MOOD MKII 1.1",
  pedal: "MOOD MKII",
  filename: "MOOD_MKII_1.1.bin",
  target: "production",
  bgColor: GOLD,
  description: "Fixed the thing",
  internalNotes: "Needs vetting before 1.1",
  uploadedAt: "2026-04-23T23:00:00.000Z",
  updatedAt: null,
  active: true,
  ...overrides,
});

describe("fieldsFrom", () => {
  test("carries exactly the draft-shaped fields off an entry", () => {
    expect(fieldsFrom(entry())).toEqual({
      name: "MOOD MKII 1.1",
      pedal: "MOOD MKII",
      description: "Fixed the thing",
      internalNotes: "Needs vetting before 1.1",
      bgColor: GOLD,
      target: "production",
    });
  });
});

describe("isDraftDirty", () => {
  test("a fresh draft is clean against the empty baseline", () => {
    expect(isDraftDirty(emptyFields(), emptyFields())).toBe(false);
  });

  test("any single field change is dirty", () => {
    const baseline = fieldsFrom(entry());
    for (const key of Object.keys(baseline) as Array<keyof DraftFields>) {
      const changed = { ...baseline, [key]: key === "target" ? "beta" : "x" };
      expect(isDraftDirty(changed, baseline), key).toBe(true);
    }
  });

  test("whitespace-only differences are not dirty", () => {
    // The save path trims before sending, so trailing whitespace could never
    // produce a different saved result and should not trip the unsaved-changes
    // confirm dialogs.
    const baseline = fieldsFrom(entry());
    const padded = { ...baseline, name: `  ${baseline.name} ` };
    expect(isDraftDirty(padded, baseline)).toBe(false);
    expect(isDraftDirty({ ...emptyFields(), pedal: "   " }, emptyFields())).toBe(
      false,
    );
  });

  test("editing baseline round-trips: fieldsFrom(entry) is clean against itself", () => {
    const e = entry();
    expect(isDraftDirty(fieldsFrom(e), fieldsFrom(e))).toBe(false);
  });
});

describe("draftComplete", () => {
  test("requires name and pedal, nothing else", () => {
    expect(draftComplete(emptyFields())).toBe(false);
    expect(draftComplete({ ...emptyFields(), name: "FW 1.0" })).toBe(false);
    expect(draftComplete({ ...emptyFields(), pedal: "MOOD" })).toBe(false);
    expect(
      draftComplete({ ...emptyFields(), name: "FW 1.0", pedal: "MOOD" }),
    ).toBe(true);
  });

  test("whitespace-only values do not count", () => {
    expect(
      draftComplete({ ...emptyFields(), name: "  ", pedal: "MOOD" }),
    ).toBe(false);
  });
});

describe("emptyFields", () => {
  test("defaults to gold and the harmless save target", () => {
    const f = emptyFields();
    expect(f.bgColor).toBe(GOLD);
    expect(f.target).toBe(DEFAULT_SAVE_TARGET);
    expect(DEFAULT_SAVE_TARGET).not.toBe("production");
  });
});
