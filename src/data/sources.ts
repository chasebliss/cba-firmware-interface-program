// Where the firmware catalogue lives. Each source points to a `firmwares.json`
// file (data_url) plus the base URL its `filepath` entries resolve against
// (repo_url). Public production firmwares come from chasebliss/firmware. Beta
// will add a separate source pointing at an internal repo (TBD).

export interface FirmwareSource {
  name: string;
  data_url: string;
  repo_url: string;
}

// All production firmware lives in this repo under public/firmware/, managed
// via the /admin upload form. The older external chasebliss/firmware source
// was retired once everything consolidated here.
export const PRODUCTION_SOURCES: FirmwareSource[] = [
  {
    name: "Uploaded",
    data_url: "/firmware/firmwares.json",
    repo_url: "/firmware/",
  },
];

// Beta firmware ships with the app itself (public/beta/firmware/) — the /beta
// route is password-gated by middleware, so these assets sit behind that
// same gate without needing a separate private repo.
export const BETA_SOURCES: FirmwareSource[] = [
  {
    name: "Beta",
    data_url: "/beta/firmware/firmwares.json",
    repo_url: "/beta/firmware/",
  },
];
