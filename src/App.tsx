import { Route, Routes, useLocation } from "react-router";
import { BetaBanner } from "@/components/BetaBanner";
import { MouseTrail } from "@/components/MouseTrail";
import { UnsupportedNotice } from "@/components/UnsupportedNotice";
import { BETA_SOURCES, PRODUCTION_SOURCES } from "@/data/sources";
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
  if (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document) {
    return true;
  }
  return false;
})();

const BetaRightSlot = () => (
  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-cream/35">
    internal · not for customers
  </span>
);

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
          <Route
            path="/"
            element={<Programmer sources={PRODUCTION_SOURCES} />}
          />
          <Route
            path="/beta"
            element={
              <Programmer
                sources={BETA_SOURCES}
                title="Beta Programmer."
                banner={<BetaBanner />}
                navVariant="dark"
                navBgClass="bg-black"
                showNavInstructions={false}
                navRightSlot={<BetaRightSlot />}
                heroWidth={500}
                heroOpacity={1}
              />
            }
          />
          <Route path="/admin" element={<LocalFlasher />} />
          <Route path="/logo-demo" element={<LogoDemo />} />
        </Routes>
    </>
  );
};

export default App;
