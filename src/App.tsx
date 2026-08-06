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

const TrailOnNonDemoRoutes = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/logo-demo")) return null;
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
