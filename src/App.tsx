import { Route, Routes, useLocation } from "react-router";
import { BetaBanner } from "@/components/BetaBanner";
import { MouseTrail } from "@/components/MouseTrail";
import { UnsupportedNotice } from "@/components/UnsupportedNotice";
import { BETA_SOURCES, PRODUCTION_SOURCES } from "@/data/sources";
import { LocalFlasher } from "@/routes/LocalFlasher";
import { LogoDemo } from "@/routes/LogoDemo";
import { Programmer } from "@/routes/Programmer";

const HAS_WEB_USB = typeof navigator !== "undefined" && "usb" in navigator;

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

  return (
    <>
      <div className="md:hidden">
        <UnsupportedNotice reason="mobile" />
      </div>
      <div className="hidden md:block">
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
      </div>
    </>
  );
};

export default App;
