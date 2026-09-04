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
        {/* data-theme scopes the nightly palette to this page. The block in
            index.css rebinds semantic tokens only, so no component code
            branches on it. Another channel wanting its own look adds a
            data-theme value and a token block, nothing more. */}
        <Route
          path="/nightly"
          element={
            <div data-theme="nightly">
              <Programmer
                sources={NIGHTLY_SOURCES}
                title="Nightly Programmer."
                navProps={{ variant: "dark", rightLabel: "Nightly" }}
                intro={
                  // The "what am I looking at" explainer. Sits above the step
                  // stack because it's page-level orientation, not an
                  // annotation on any one control — the step 3 tick is what
                  // actually gates flashing.
                  <div className="cba-panel mb-8 border-2 border-border/15 bg-text/[0.03] px-5 py-4 text-left">
                    <h2 className="text-body font-bold">
                      What is nightly firmware?
                    </h2>
                    <p className="mt-2 text-body-sm leading-[1.65] text-text/60">
                      On this page you will find firmware that has not completed
                      our internal testing process yet. It will not harm your
                      pedals, but it could include bugs. Use this code if you
                      want access to the latest bug fixes as quickly as
                      possible.
                    </p>
                    <p className="mt-2.5 text-body-sm leading-[1.65] text-text/60">
                      You can find official production code{" "}
                      <a
                        href="/"
                        className="font-semibold text-text/80 underline underline-offset-2 hover:text-text"
                      >
                        here
                      </a>
                      .
                    </p>
                  </div>
                }
                disclaimer={
                  // Short on purpose: the intro above carries the explanation,
                  // so this only has to be the thing they affirm.
                  <>
                    <span className="font-bold uppercase tracking-[0.08em] text-accent">
                      I understand
                    </span>{" "}
                    this firmware has not completed internal testing and may
                    include bugs.
                  </>
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
