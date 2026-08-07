import { Route, Routes, useLocation } from "react-router";
import { MouseTrail } from "@/components/MouseTrail";
import { UnsupportedNotice } from "@/components/UnsupportedNotice";
import {
  BETA_SOURCES,
  NIGHTLY_SOURCES,
  PRODUCTION_SOURCES,
} from "@/data/sources";
import { LocalFlasher } from "@/routes/LocalFlasher";
import { LogoDemo } from "@/routes/LogoDemo";
import { Programmer } from "@/routes/Programmer";

const HAS_WEB_USB = typeof navigator !== "undefined" && "usb" in navigator;

// User-agent based mobile check. Viewport-size alone is too sloppy — a
// resized desktop window would falsely trigger the mobile notice. iPadOS 13+
// reports as Mac, so we also check for touch support on a Mac UA as a tell.
const IS_MOBILE_DEVICE = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|BlackBerry|webOS|Windows Phone/i.test(ua)) {
    return true;
  }
  if (
    ua.includes("Mac") &&
    typeof document !== "undefined" &&
    "ontouchend" in document
  ) {
    return true;
  }
  return false;
})();

// The trail is atmosphere for the public pages. /admin is a work tool where
// someone is reading dense rows and clicking small destructive buttons, and
// gold digits drifting across the catalogue read as rendering artefacts there.
const TRAIL_FREE_ROUTES = ["/logo-demo", "/admin"];

const TrailOnNonDemoRoutes = () => {
  const { pathname } = useLocation();
  if (TRAIL_FREE_ROUTES.some((r) => pathname.startsWith(r))) return null;
  return <MouseTrail />;
};

const App = () => {
  if (!HAS_WEB_USB) {
    return <UnsupportedNotice reason="browser" />;
  }
  if (IS_MOBILE_DEVICE) {
    return <UnsupportedNotice reason="mobile" />;
  }

  return (
    <>
      <TrailOnNonDemoRoutes />
      <Routes>
        <Route path="/" element={<Programmer sources={PRODUCTION_SOURCES} />} />
        <Route
          path="/beta"
          element={
            <Programmer
              sources={BETA_SOURCES}
              title="Beta Programmer."
              navProps={{ variant: "dark", rightLabel: "Beta" }}
            />
          }
        />
        {/* data-nightly scopes the restyle — cold slate palette and rounded
            corners — to this page only. See the [data-nightly] block in
            index.css; no component code branches on it. */}
        <Route
          path="/nightly"
          element={
            <div data-nightly="">
              <Programmer
                sources={NIGHTLY_SOURCES}
                title="Nightly Programmer."
                navProps={{ variant: "dark", rightLabel: "Nightly" }}
                channelNotice={
                  // Compact by design: this sits inside the active step card,
                  // so a paragraph of body text competes with the picker it's
                  // meant to annotate. One line, muted, with the escape hatch
                  // as the only emphasis.
                  // w-96 + mx-auto matches PedalDropdown, so the notice lines
                  // up under the picker rather than spanning the whole card.
                  <p className="mx-auto mt-2.5 flex w-96 max-w-full flex-wrap items-baseline gap-x-1.5 text-[11px] leading-[1.5] text-black/45">
                    <span className="font-bold uppercase tracking-[0.08em] text-gold">
                      Unreleased
                    </span>
                    <span>
                      Less tested than production.{" "}
                      <a
                        href="/"
                        className="font-semibold text-black/70 underline underline-offset-2 hover:text-black"
                      >
                        Use stable instead
                      </a>
                      .
                    </span>
                  </p>
                }
              />
            </div>
          }
        />
        <Route path="/admin" element={<LocalFlasher />} />
        <Route path="/logo-demo" element={<LogoDemo />} />
      </Routes>
    </>
  );
};

export default App;
