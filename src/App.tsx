import { Route, Routes } from "react-router";
import { BetaBanner } from "@/components/BetaBanner";
import { MouseTrail } from "@/components/MouseTrail";
import { UnsupportedNotice } from "@/components/UnsupportedNotice";
import { BETA_SOURCES, PRODUCTION_SOURCES } from "@/data/sources";
import { LocalFlasher } from "@/routes/LocalFlasher";
import { Programmer } from "@/routes/Programmer";

const HAS_WEB_USB =
  typeof navigator !== "undefined" && "usb" in navigator;

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
        <MouseTrail />
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
                showInactive
                banner={<BetaBanner />}
              />
            }
          />
          <Route path="/admin" element={<LocalFlasher />} />
        </Routes>
      </div>
    </>
  );
};

export default App;
