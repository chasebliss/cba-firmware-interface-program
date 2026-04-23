import { useState } from "react";

export const Nav = () => {
  const [macOpen, setMacOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [winDriverOpen, setWinDriverOpen] = useState(false);

  return (
    <nav className="mx-auto flex w-full max-w-[1200px] items-center justify-between border-b-2 border-black py-6">
      <div className="flex w-1/3 justify-start">
        <a
          href="https://chasebliss.com"
          className="group flex items-center gap-1 text-sm font-bold text-black no-underline"
        >
          <svg
            className="h-6 w-6 transition-transform duration-150 ease-out group-hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          To main site
        </a>
      </div>
      <div className="flex w-1/3 justify-center">
        <a
          href="https://chasebliss.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Chase Bliss Audio"
        >
          <img src="/logo.svg" alt="Chase Bliss Audio" className="h-8 w-52" />
        </a>
      </div>
      <div className="flex w-1/3 items-center justify-end gap-2 text-sm font-bold">
        <span>Instructions:</span>

        <div
          className="relative"
          onMouseEnter={() => setMacOpen(true)}
          onMouseLeave={() => setMacOpen(false)}
        >
          <button
            type="button"
            aria-label="Mac instructions"
            aria-expanded={macOpen}
            className="cursor-pointer"
          >
            <svg
              fill="#000"
              viewBox="-3.5 -2 24 24"
              width="28"
              height="28"
              aria-hidden="true"
            >
              <path d="M13.623 10.627c-.025-2.533 2.066-3.748 2.159-3.808-1.175-1.72-3.005-1.955-3.657-1.982-1.557-.158-3.039.917-3.83.917-.788 0-2.008-.894-3.3-.87C3.299 4.909 1.734 5.87.86 7.39c-1.764 3.06-.452 7.595 1.267 10.077.84 1.215 1.842 2.58 3.157 2.53 1.266-.05 1.745-.819 3.276-.819 1.531 0 1.962.82 3.302.795 1.363-.026 2.226-1.239 3.06-2.457.965-1.41 1.362-2.775 1.386-2.845-.03-.013-2.658-1.02-2.684-4.045zm-2.518-7.433c.698-.847 1.169-2.022 1.04-3.194C11.14.04 9.921.67 9.2 1.515c-.647.75-1.214 1.945-1.062 3.094 1.122.088 2.268-.57 2.967-1.415z" />
            </svg>
          </button>
          <div
            className={`absolute top-full right-0 z-50 pt-3 transition-all duration-200 ease-out ${
              macOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0"
            }`}
          >
            <div
              role="dialog"
              aria-label="Mac instructions"
              aria-hidden={!macOpen}
              className="w-[380px] max-w-[calc(100vw-2rem)] border-2 border-black bg-cream p-5 text-left shadow-cba-xl"
            >
              <p className="pb-2 text-xl font-bold">Mac:</p>
              <p className="text-sm font-bold italic">
                <span className="bg-red px-2 text-cream">Note:</span> Your
                pedal may be damaged by uploading incorrect firmware.
              </p>
              <ol className="list-inside list-decimal space-y-3 pt-4 text-sm">
                <li>Select your pedal and version from the dropdown menu.</li>
                <li>
                  <strong>*</strong>Connect your pedal using a data transfer
                  micro USB cable.
                </li>
                <li>
                  <strong>*</strong>Connect appropriate pedal power supply
                  (refer to manual for current requirements).
                </li>
                <li>
                  Click the Connect button. A pop-up will appear in your
                  browser — select "DFU in FS mode" and click Connect.
                </li>
                <li>Click the Update button.</li>
              </ol>
              <p className="block pt-4 text-sm font-bold italic">
                <strong>*</strong>Steps 2 and 3 must be performed in this order.
              </p>
            </div>
          </div>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setWinOpen(true)}
          onMouseLeave={() => {
            setWinOpen(false);
            setWinDriverOpen(false);
          }}
        >
          <button
            type="button"
            aria-label="Windows instructions"
            aria-expanded={winOpen}
            className="cursor-pointer"
          >
            <svg
              fill="#000"
              viewBox="0 0 14 14"
              width="26"
              height="26"
              aria-hidden="true"
            >
              <path d="M 7.251852,7.25185 13,7.25185 13,13 7.251852,13 Z m -6.251852,0 5.748148,0 0,5.74815 L 1,13 Z M 7.251852,1 13,1 l 0,5.74815 -5.748148,0 z M 1,1 l 5.748148,0 0,5.74815 -5.748148,0 z" />
            </svg>
          </button>
          <div
            className={`absolute top-full right-0 z-50 pt-3 transition-all duration-200 ease-out ${
              winOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0"
            }`}
          >
            <div
              role="dialog"
              aria-label="Windows instructions"
              aria-hidden={!winOpen}
              className="w-[380px] max-w-[calc(100vw-2rem)] border-2 border-black bg-cream p-5 text-left shadow-cba-xl"
            >
              <p className="pb-2 text-xl font-bold">Windows:</p>
              <p className="text-sm font-bold italic">
                <span className="bg-red px-2 text-cream">Note:</span> Your
                pedal may be damaged by uploading incorrect firmware.
              </p>
              <ol className="list-inside list-decimal space-y-3 pt-4 text-sm">
                <li>
                  Install the Windows driver (first time only, see below).
                </li>
                <li>Select your pedal and version from the dropdown menu.</li>
                <li>
                  <strong>*</strong>Connect your pedal using a data transfer
                  micro USB cable.
                </li>
                <li>
                  <strong>*</strong>Connect appropriate pedal power supply
                  (refer to manual for current requirements).
                </li>
                <li>
                  Click the Connect button. A pop-up will appear in your
                  browser — select "DFU in FS mode" and click Connect.
                </li>
                <li>Click the Update button.</li>
              </ol>
              <p className="block pt-4 text-sm font-bold italic">
                <strong>*</strong>Steps 3 and 4 must be performed in this order.
              </p>
              <button
                type="button"
                onClick={() => setWinDriverOpen((v) => !v)}
                aria-expanded={winDriverOpen}
                className="mt-6 flex w-full cursor-pointer items-center justify-start border-none bg-transparent p-0 font-bold"
              >
                Windows Driver Install
                <svg
                  className={`ml-1 h-6 w-6 fill-current transition-transform duration-150 ${
                    winDriverOpen ? "rotate-180" : ""
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
              {winDriverOpen && (
                <ol className="mt-2 space-y-3 text-sm">
                  <video
                    src="/zadig-install.mp4"
                    controls
                    className="w-full border-2 border-black"
                  />
                  <li>
                    Download{" "}
                    <a
                      href="https://zadig.akeo.ie/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline"
                    >
                      Zadig
                    </a>{" "}
                    and open the program.
                  </li>
                  <li>
                    Connect your pedal using steps 2 and 3 above (in order).
                  </li>
                  <li>
                    Click Options &gt; List All Devices &gt; select "DFU in FS
                    Mode".
                  </li>
                  <li>Click "Upgrade Driver".</li>
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
