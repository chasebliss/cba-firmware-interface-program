// Where the firmware catalogue lives. Each source points to a `firmwares.json`
// file (data_url) plus the base URL its `filepath` entries resolve against
// (repo_url). Public production firmwares come from chasebliss/firmware. Beta
// will add a separate source pointing at an internal repo (TBD).

export interface FirmwareSource {
  name: string;
  data_url: string;
  repo_url: string;
}

export const PRODUCTION_SOURCES: FirmwareSource[] = [
  {
    name: "DaisyExamples",
    data_url:
      "https://raw.githubusercontent.com/chasebliss/firmware/main/firmwares.json",
    repo_url: "https://raw.githubusercontent.com/chasebliss/firmware/main/",
  },
];

// TODO: swap to the internal/private beta firmware repo when one exists.
// For now this reuses the public source; the /beta route surfaces inactive
// entries (active: false) that the public route filters out.
export const BETA_SOURCES: FirmwareSource[] = PRODUCTION_SOURCES;
