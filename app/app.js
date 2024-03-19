const root_url = "https://electro-smith.github.io/Programmer";

var data = {
  overlayVisible: false,
  platforms: [],
  firmwares: [],
  isAccordionHovered: false,
  no_device: true,
  sel_platform: null,
  sel_firmware: null,
  firmwareFile: null,
  hoveredSVG: null,
  blinkFirmwareFile: null,
  bootloaderFirmwareFile: null,
  displayImportedFile: false,
  displaySelectedFile: false,
  accordionOpen: false,
  showWinDriverInstructions: false,
  updateButtonDisabled: false,
  showHoverDiv: false,
};

var ex_buffer;

function getRootUrl() {
  var url = document.URL;
  return url;
}

async function readServerFirmwareFile(path, dispReadme = true) {
  return new Promise((resolve) => {
    var buffer;
    var raw = new XMLHttpRequest();
    var fname = path;

    raw.open("GET", fname, true);
    raw.responseType = "arraybuffer";
    raw.onreadystatechange = function () {
      if (this.readyState === 4 && this.status === 200) {
        resolve(this.response);
      }
    };
    raw.send(null);
  });
}

var app = new Vue({
  el: "#app",
  template: /* HTML */ `
    <div class="app_body">
      <nav
        class="py-6 relative z-50 flex mx-auto items-center justify-between border-b-2 border-black mb-12"
      >
        <div class="w-1/3 flex justify-start">
          <a href="#" @click="navigateBackOrRedirect" class="back-to-site">
            <div class="flex items-center">
              <svg
                class="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              <h2 class="text-lg font-bold">To main site</h2>
            </div>
          </a>
        </div>

        <div class="w-1/3 flex justify-center">
          <a href="https://chasebliss.com" target="_blank">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 2315 307"
              aria-label="Logo of CBA"
              class="w-52 h-8"
            >
              <path
                d="M56.5 23C26.3 35.1 1.1 45 .7 45.2c-.4.2 9.1 25.6 21.3 56.5 12.1 30.9 22 56.6 22 57 0 .4-5.7.6-12.7.5-7.1-.2-17-.1-22 .3l-9.3.7V307h105.1c99.6 0 105-.1 104.5-1.8-.2-.9-1.4-5.1-2.5-9.3-2.9-10.4-7.8-22.5-13.7-33.9l-4.9-9.5 9.5 9.5c12.1 12 25.2 21.4 40.5 28.9 19.2 9.4 37 14.2 57.9 15.7l9.6.7v-115l-4.7-.7c-11.2-1.4-23.6-10.3-28.6-20.3-7.5-14.7-5.3-31.2 5.8-43.1 5.7-6.1 13.2-10.5 20-11.7 2.2-.4 4.8-.9 5.8-1.2 1.6-.4 1.7-4 1.7-57.4V1h-7.2c-20.7.1-47 7.5-67.3 19.1-32.6 18.5-57 47.6-69.5 82.7l-3.7 10.3-21.9-55.8c-14.2-36.1-22.5-55.9-23.4-56-.8-.1-26.2 9.7-56.5 21.7zm99.9 100c-.8 3.6-1.9 12-2.6 18.7-2.5 26.2 3.7 58.3 15.8 81.4 1.6 3 3.1 5.8 3.3 6.3.2.4-3-2.9-7.1-7.5-14.9-16.7-37.9-34.1-58.3-43.9-13-6.3-34.2-13.4-46.5-15.6-5.2-.9-10.3-1.9-11.3-2.3-1.2-.4 17.2-8.1 53-22.2 30.1-11.9 54.9-21.6 54.9-21.5.1 0-.4 3-1.2 6.6zm534.6 2v122h38v-56.3c0-61.9 0-62.4 6.2-73.9 7.1-13.3 22.3-21.8 39.3-21.8 8.8.1 14.4 1.3 22.1 5.1 7.6 3.8 13.2 9.2 17.2 16.7 6.1 11.5 6.2 12.4 6.2 74.1V247h37v-54.9c0-44.6-.3-56.5-1.5-63.7-5-29.1-19.2-49.4-42-60.4-12-5.7-18.8-7.2-36.6-7.7-18-.6-26.2.7-39.6 6.1l-8.3 3.4V3h-38v122zm898 0v122h37.9l.3-8 .3-7.9 4.9 3c6.1 3.8 17.3 8.4 26.2 10.6 10.6 2.6 34.1 2.4 45.8-.5 32.5-8.1 56.4-30.8 66.2-62.7 2.6-8.5 2.8-10.1 2.9-28.5 0-16.1-.3-20.7-1.9-26.5-10.9-40.4-41.6-64.9-84.2-67.2-18.8-1-36 2.7-52.1 11.2l-8.3 4.4V3h-38v122zm105.5-31.5c20.4 5.2 34.9 20.3 39.9 41.5.9 3.8 1.6 11.2 1.6 17.6 0 19.1-4.9 32.9-16 44.7-10.3 11.1-23.9 16.7-40.1 16.7-20.2 0-36.5-10.2-45.4-28.4-5.3-10.8-6.6-17.3-6.6-31.6.1-20.4 5-34.8 15.8-46.1 12.4-13 33.2-18.9 50.8-14.4zm120.7 17.7.3 108.3 2.7 5.7c3.7 7.9 9.8 14.2 17.7 18.1l6.5 3.2 19.3.3 19.3.4V210h-9.2c-11 0-15.4-1.7-18-7-1.7-3.3-1.8-10.2-1.8-101.8V3h-37l.2 108.2zM1934.6 4.4c-7.7 2.9-13.5 11.1-13.6 19.2 0 2.7 1 6.1 2.8 9.5 4.9 9.4 16.2 13.3 25.7 9 11.7-5.3 15.8-19.9 8.5-30-5.5-7.5-15.2-10.7-23.4-7.7zM561.5 60.1c-7.6 1.1-21.5 5.4-28 8.6-21.8 11.1-36.2 29.7-43.2 55.8-2.3 9-2.6 11.8-2.7 27.5 0 19.5 1.5 28.1 7.5 42.5 10.2 24.6 30.9 42.5 57.4 49.6 11.2 3 35.5 3.3 46.5.5 17.4-4.5 30.6-12 41.7-24 9.1-9.8 15.1-20.3 18.8-32.3l.6-2.3h-40.6l-2.3 4.9c-3.6 7.9-11.3 15.5-19.8 19.7-6.4 3.2-8.5 3.7-16.6 4.2-11.2.5-18.5-.8-27-5.1-12.1-6-21.1-18.2-26-35.2-1.8-6.7-2.2-10.4-2.2-22 .1-15.7 1.4-22.2 6.9-34.3 10.9-23.5 37.5-33.7 63-24.1 7.2 2.7 17.2 11.9 21.1 19.4l2.9 5.5H660l-.6-2.8c-2.6-11.2-12.1-26.9-21.7-35.8-17.1-16.1-48.1-24.3-76.2-20.3zm399.8.4c-42.4 7.7-69.8 37.8-74.4 81.7-3.1 29.3 5.8 57.8 23.9 77 11.5 12.2 26.4 20.6 44 25 11.2 2.8 33.7 3 45.1.4 9-2 21.8-7.1 28.6-11.4l5-3.1.3 8.4.3 8.5h37.9V59h-38v7.5c0 4.1-.2 7.5-.4 7.5s-3.9-1.8-8.2-3.9c-4.4-2.2-10.7-4.9-14.1-6-14.5-4.9-34.9-6.3-50-3.6zm32.6 33.2c18.6 5.1 30.9 17.8 37.2 38.3 3 9.7 3.3 28 .6 38-4.3 15.7-15.5 31.3-26.7 37-22.3 11.4-46.7 8.5-62.6-7.4-11.5-11.6-16.3-23.5-17.1-42.2-1-21.6 4.1-37.8 15.7-49.8 13.7-14.3 33.3-19.4 52.9-13.9zm168.8-33.2c-23 4.4-40.1 16.4-48.4 34-2.6 5.6-2.8 6.9-2.8 18.5 0 12.1.1 12.8 3.3 19.2 4.3 8.8 12.7 16.5 23.5 21.7 7.4 3.6 15.8 6.4 47.7 16.1 12.4 3.8 22.5 8.2 25.9 11.3 5.2 4.8 6.4 12.2 3.2 19.3-6.2 13.6-32.6 18.6-50.9 9.6-8.4-4.1-16.2-13.8-16.2-20.2 0-1.9-.6-2-19.5-2H1109v3.7c.1 14.7 12 33.1 27.6 42.6 13.7 8.3 27.8 11.7 48.3 11.7 26.5 0 44-6.3 57.2-20.8 17-18.6 16.6-47-.9-64-10.4-10.1-21.1-14.8-58.2-25.7-16.4-4.8-22.8-7.7-27.9-12.9-7.3-7.4-7.4-15.9-.5-23.6 5.3-5.8 12.6-8.3 24.4-8.3 12.5 0 19.4 2.5 26.7 9.7 3.9 3.9 5.5 6.4 6.8 10.8l1.6 5.8h36.9v-4.4c0-7.4-4.4-19.5-10-27.4-7.5-10.7-18.5-18.1-34.5-23.2-9.1-2.9-32-3.7-43.8-1.5zm185.8-.1c-39.4 7.7-65 34.4-71 74.3-5.5 36.6 5.8 71.2 30.1 91.6 8.6 7.3 23.9 14.9 35.9 17.9 12.7 3.1 36.3 3.1 48-.1 25.3-6.8 46.1-24.1 56.1-46.8 1.3-2.9 2.4-5.8 2.4-6.3 0-.6-7.9-1-20.4-1h-20.4l-1.2 2.9c-1.7 4.2-11 13.2-16.8 16.4-13.9 7.6-31.9 7.7-47.7.2-13.5-6.4-25.5-22.7-27.1-36.8l-.7-5.7h139.1l.7-8.7c3-35.2-9.9-65.9-34.9-83.2-8.8-6.1-15.6-9.2-27.5-12.7-10.7-3.2-33.2-4.2-44.6-2zm32.5 32.3c12.7 3.4 25.4 13.2 30.6 23.4 2.8 5.6 5.9 18.4 4.8 20.1-.7 1.2-99 .6-100.1-.6-1-1 2.5-12.3 5.7-18.5 10.6-21.1 34.7-31.1 59-24.4zm541.7-33c-.4.3-.7 42.6-.7 94V247h38V59h-18.3c-10.1 0-18.7.3-19 .7zm129.6.7c-16.2 3.1-28.8 9.1-37.8 18.1-10.7 10.7-15.1 22.2-14.3 37.6.9 14.7 7.6 25.9 20.9 34.8 7.5 5 17.5 8.9 39.2 15.1 23.2 6.7 35.2 11.6 40.1 16.1 3.6 3.3 4 4.2 4.4 9.6.3 4.7 0 6.8-1.7 10.2-4.4 8.6-17.5 13.7-32.8 12.9-10.9-.6-18.4-3.3-24.8-9-4.6-4.1-9.5-12.3-9.5-16.1 0-1.6-1.6-1.7-19.5-1.7-22.2 0-20.5-.8-18.4 9.2 4.8 23.4 26.6 42.1 56.2 48.4 11.3 2.3 31.5 1.9 43.1-1 27-6.9 43.7-24.8 45.3-48.6 1.3-18-7.5-33.4-24.9-43.8-6-3.6-23.3-9.8-45.3-16.2-18.3-5.4-24.6-8.3-29.5-13.6-4.5-4.9-5.5-7.7-4.7-14 1.3-12.1 18-20.2 36.1-17.4 14.7 2.3 24.1 9.8 27.2 22l1.1 4.5 18.7.3 18.6.2v-3.3c0-5.6-3.8-18.6-7.2-24.6-5-8.8-14.9-18-24.8-22.8-4.7-2.3-11.2-4.9-14.5-5.8-8.2-2.3-31.7-2.9-41.2-1.1zm172.7.1c-17.1 2.7-30.6 9.2-40.3 19.4-10.5 11-15.3 26-12.9 40.3 3.6 20.6 17.4 32.7 48.2 42.2 6.3 1.9 16.9 5.1 23.5 7.1 27.2 8.3 33.5 12.8 33.5 24.1 0 13.4-14.2 22.2-34.4 21.2-11.2-.6-18.6-3.3-25.1-9-4.6-4.1-9.5-12.3-9.5-16.1 0-1.6-1.6-1.7-19.5-1.7H2169v3.1c0 4.5 2.8 14.5 5.5 19.8 7.6 15 23 26.7 43.2 32.7 6.8 2 11.7 2.7 22.1 3.1 26.6 1.1 46.3-5.1 60-18.8 10.5-10.5 14.7-21.4 14-36.9-.3-8.5-.8-10.5-3.7-16.6-7.2-14.6-20.9-24.1-46.1-31.8-6.3-1.9-17.6-5.3-25-7.6-15.3-4.7-20.1-7.2-25.3-12.9-6.5-7.2-5.9-16.3 1.4-23.3 8.9-8.5 29.5-10.5 43-4.1 8.5 3.9 13.8 10.7 15.4 19.6l.7 3.7h36.8v-4.3c0-10.7-5.8-24.2-14.6-33.7-15.7-16.9-42-24.1-71.4-19.5z"
              />
            </svg>
          </a>
        </div>

        <div class="w-1/3 flex justify-end ">
          <div class="flex  items-center  text-center relative gap-x-2">
            <p class="font-bold">Instructions:</p>
            <div class="flex justify-center items-end gap-x-2">
              <svg
                @mouseover="hoveredSVG = 'svg1'"
                @mouseleave="hoveredSVG = null"
                fill="#000000"
                viewBox="-3.5 -2 24 24"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMinYMin"
                class="w-8 h-8"
              >
                <path
                  d="M13.623 10.627c-.025-2.533 2.066-3.748 2.159-3.808-1.175-1.72-3.005-1.955-3.657-1.982-1.557-.158-3.039.917-3.83.917-.788 0-2.008-.894-3.3-.87C3.299 4.909 1.734 5.87.86 7.39c-1.764 3.06-.452 7.595 1.267 10.077.84 1.215 1.842 2.58 3.157 2.53 1.266-.05 1.745-.819 3.276-.819 1.531 0 1.962.82 3.302.795 1.363-.026 2.226-1.239 3.06-2.457.965-1.41 1.362-2.775 1.386-2.845-.03-.013-2.658-1.02-2.684-4.045zm-2.518-7.433c.698-.847 1.169-2.022 1.04-3.194C11.14.04 9.921.67 9.2 1.515c-.647.75-1.214 1.945-1.062 3.094 1.122.088 2.268-.57 2.967-1.415z"
                />
              </svg>
              <svg
                @mouseover="hoveredSVG = 'svg2'"
                @mouseleave="hoveredSVG = null"
                fill="#000000"
                viewBox="0 0 14 14"
                role="img"
                focusable="false"
                aria-hidden="true"
                class="w-7 h-7"
              >
                <path
                  d="M 7.251852,7.25185 13,7.25185 13,13 7.251852,13 Z m -6.251852,0 5.748148,0 0,5.74815 L 1,13 Z M 7.251852,1 13,1 l 0,5.74815 -5.748148,0 z M 1,1 l 5.748148,0 0,5.74815 -5.748148,0 z"
                />
              </svg>
            </div>
            <transition name="fade">
              <div
                v-if="hoveredSVG === 'svg1'"
                @mouseover="hoveredSVG = 'svg1'"
                @mouseleave="hoveredSVG = null"
                class="transition-opacity duration-500 absolute top-10 right-10  mac-instructions instructions shadow-2xl text-left"
              >
                <p class="font-bold pb-2 text-xl">Mac:</p>
                <p class="italic font-bold text-sm">
                  <span class="bg-red-400 text-white px-2">Note:</span> Your
                  pedal may be damaged by uploading incorrect firmware.
                </p>
                <ol class="list-inside space-y-3 pt-4 text-sm">
                  <li>Select your pedal from the dropdown menu.</li>
                  <li>
                    <strong>*</strong>Connect your pedal using the provided USB
                    cable.
                  </li>
                  <li>
                    <strong>*</strong>Connect appropriate pedal power supply
                    (refer to manual for current requirements).
                  </li>
                  <li>
                    Click the Connect button. A pop-up will appear in your
                    browser – select “DFU in FS mode” and click Connect.
                  </li>
                  <li>Click the Update button.</li>
                </ol>
                <p class="block pt-4 italic font-bold text-sm">
                  <strong>*</strong>Steps 2 and 3 must be performed in this
                  order.
                </p>
              </div>
              <div
                v-if="hoveredSVG === 'svg2'"
                @mouseover="hoveredSVG = 'svg2'"
                @mouseleave="hoveredSVG = null"
                class="transition-opacity duration-500 absolute top-10 right-1 instructions shadow-2xl text-left"
              >
                <p class="font-bold pb-2 text-xl">Windows:</p>
                <p class="italic font-bold text-sm">
                  <span class="bg-red-400 text-white px-2">Note:</span> Your
                  pedal may be damaged by uploading incorrect firmware.
                </p>
                <ol class="list-inside space-y-3 pt-4 text-sm">
                  <li>
                    Install the Windows driver (first time only, see below).
                  </li>
                  <li>Select your pedal from the dropdown menu.</li>
                  <li>
                    <strong>*</strong>Connect your pedal using the provided USB
                    cable.
                  </li>
                  <li>
                    <strong>*</strong>Connect appropriate pedal power supply
                    (refer to manual for current requirements).
                  </li>
                  <li>
                    Click the Connect button. A pop-up will appear in your
                    browser – select “DFU in FS mode” and click Connect.
                  </li>
                  <li>Click the Update button.</li>
                </ol>
                <p class="block pt-4 italic font-bold text-sm">
                  <strong>*</strong>Steps 3 and 4 must be performed in this
                  order.
                </p>
                <div>
                  <button
                    @click="toggleWinDriverInstructions"
                    class="font-bold p-0 mt-6 cursor-pointer border-none flex justify-between"
                  >
                    Windows Driver Install
                    <svg
                      :class="{'rotate-180': showWinDriverInstructions}"
                      class="fill-current h-6 w-6 transform transition-transform duration-150 ml-1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      />
                    </svg>
                  </button>

                  <transition name="fade">
                    <ol
                      v-if="showWinDriverInstructions"
                      class="space-y-3 text-sm win-driver mt-2"
                    >
                      <video src="assets/zadig-install.mp4" controls />
                      <li>
                        Download
                        <a
                          href="https://zadig.akeo.ie/"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-blue-500 hover:underline"
                        >
                          Zadig
                        </a>
                        and open the program.
                      </li>
                      <li>
                        Connect your pedal using steps 2 and 3 above (in order).
                      </li>
                      <li>
                        Click Options > List All Devices > select “DFU in FS
                        Mode”.
                      </li>
                      <li>Click “Upgrade Driver”.</li>
                    </ol>
                  </transition>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </nav>

      <div
        v-if="!isChromiumBasedBrowser"
        class="warning absolute top-2 right-0 left-0 w-96 z-100 mx-auto p-4 bg-red-500 text-white text-left shadow-2xl  space-y-4"
      >
        <h3 class="text-2xl font-semibold text-center">Browser Warning</h3>
        <p>This interface only works on Google Chrome or Microsoft Edge.</p>
        <p>Please use one of these browsers for the best experience.</p>
      </div>
      <div
        class="mt-8 text-red-500 font-semibold border-black border-2 w-72 p-4 mx-auto shadow-xl text-left"
        id="mobileWarning"
      >
        <h2 class="text-2xl font-semibold bg-red-500 text-white px-2 mb-4">
          Browser Warning:
        </h2>
        <p class="pb-2">This app is not optimized for mobile devices.</p>
        <p>Please use a Chrome or Edge browser on a desktop computer.</p>
      </div>

      <div class="flex flex-col items-center">
        <div>
          <h1 class="h1 shadow">Bliss Programmer.</h1>
        </div>
        <div class="relative flex justify-center">
          <img
            src="assets/binaryV2.svg"
            alt="Binary Image"
            style="width: 650px"
            class="py-2 z-20 transition-opacity duration-300"
            :style="{ opacity: overlayVisible ? '2' : '1' }"
          />
          <transition name="fade">
            <div
              v-show="overlayVisible"
              class="info flex-col absolute left-1/2 transform -translate-x-1/2  h-full flex justify-center items-center"
              id="downloadLog"
            />
          </transition>
          <!--          <div-->
          <!--            id="downloadLog"-->
          <!--            class="info flex-col absolute  left-1/2 transform -translate-x-1/2  h-full flex justify-center items-center"-->
          <!--          >-->
          <!--            <p>Installing firmware...</p>-->
          <!--            <progress id="progress" value="71680" max="129112"></progress>-->
          <!--          </div>-->
        </div>
        <div class="flex pb-2 items-center justify-center w-96 relative ">
          <div
            class="accordion-parent w-96 py-3 px-3 border-black border-2 cursor-pointer flex justify-between items-center"
            @click="toggleAccordion"
            @mouseenter="handleAccordionMouseEnter"
            @mouseleave="handleAccordionMouseLeave"
            :class="{'shadow-xl': isAccordionHovered || sel_firmware}"
          >
            {{ sel_firmware ? sel_firmware.name : 'Select Pedal...' }}
            <svg
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              class="w-8 h-8"
            >
              <path
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-4.293-1.707a1 1 0 00-1.414 0L10 10.586 7.707 8.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 000-1.414z"
                fill="#ba8e51"
              />
            </svg>
          </div>

          <!-- Accordion Dropdown -->
          <transition name="accordion">
            <div
              v-if="accordionOpen"
              key="content"
              class="absolute z-10 w-96 accordion-dropdown"
              style="background-color: #fefbf6; top: 100%; box-sizing: border-box; border: 2px solid black; "
            >
              <div
                class="flex flex-col text-left divide-y divide-black shadow "
              >
                <div
                  v-for="(firmware, index) in platformFirmwares"
                  :key="index"
                  class="py-3 px-4 a-file cursor-pointer font-bold"
                  @click="selectfirmware(firmware)"
                  @mouseenter="hoverEnter($event, firmware.bgColor)"
                  @mouseleave="hoverLeave($event)"
                >
                  <p>{{ firmware.name }}</p>
                </div>
              </div>
            </div>
          </transition>
          <!--          <div class="relative">-->
          <!--            <svg-->
          <!--              viewBox="0 0 32 32"-->
          <!--              class="ml-2 w-8 h-8"-->
          <!--              @mouseover="showHoverDiv = true"-->
          <!--              @mouseleave="showHoverDiv = false"-->
          <!--            >-->
          <!--              <rect x="15" y="14" width="2" height="8" />-->
          <!--              <rect x="15" y="10" width="2" height="2" />-->
          <!--              <circle-->
          <!--                fill="none"-->
          <!--                stroke="#000000"-->
          <!--                stroke-width="2"-->
          <!--                stroke-miterlimit="10"-->
          <!--                cx="16"-->
          <!--                cy="16"-->
          <!--                r="12"-->
          <!--              />-->
          <!--            </svg>-->

          <!--            &lt;!&ndash; Conditional div &ndash;&gt;-->
          <!--            <div-->
          <!--              v-show="showHoverDiv"-->
          <!--              class="changelog absolute z-10 bg-white shadow-md p-4 bottom-10 z-50 -left-40 w-96 border-2 border-black"-->
          <!--            >-->
          <!--              <p>-->
          <!--                * Includes three new amp models built from the ground up using a-->
          <!--                detailed physical modelling based simulation of the original-->
          <!--                circuity.-->
          <!--              </p>-->
          <!--              <p>-->
          <!--                * Includes six new IRs meticulously designed by Tone Factor that-->
          <!--                were captured with vintage and era specific amps, matching the-->
          <!--                ACS1's amp models.-->
          <!--              </p>-->
          <!--            </div>-->
          <!--          </div>-->
        </div>
        <p>
          <button
            variant="es"
            id="connect"
            class="mt-4"
            :class="{'button-shadow': sel_firmware, 'button-no-shadow': !sel_firmware, 'opacity-40': !sel_firmware}"
            :disabled="!sel_firmware"
          >
            Connect
          </button>
        </p>
        <button
          id="download"
          variant="es"
          :class="['mt-4 paper', {'text-green-500 border-green-500 button-shadow': !no_device && sel_firmware, 'button-no-shadow opacity-40 cursor-not-allowed text-black border-black': no_device || !sel_firmware}]"
          :disabled="no_device || !sel_firmware || updateButtonDisabled"
          @click="showOverlay"
        >
          Update
        </button>
      </div>

      <div v-if="sel_firmware||firmwareFile">
        <div v-if="displaySelectedFile">
          <!--            <h3 class="info">Name: {{sel_firmware.name}}</h3>-->
          <!--            <li>Description: {{sel_firmware.description}}</li>-->
          <!--            <h3 class="info">File Location: {{sel_firmware.filepath}}</h3>-->
        </div>
      </div>
      <!-- HIDDEN -->
      <div hidden>
        <button id="detach" disabled hidden>Detach DFU</button>
        <button id="upload" disabled hidden>Upload</button>
        <b-form-select
          placeholder="Platform"
          v-model="sel_platform"
          textContent="Select a platform"
          id="platformSelector"
          hidden
        >
          <template v-slot:first>
            <b-form-select-option :value="null" disabled
              >-- Platform --</b-form-select-option
            >
          </template>
          <option v-for="platform in platforms" :value="platform">
            {{platform}}
          </option>
        </b-form-select>
        <form id="configForm" hidden>
          <p>
            <label for="transferSize" hidden="true">Transfer Size:</label>
            <input
              type="number"
              name="transferSize"
              hidden="true"
              id="transferSize"
              value="1024"
            />
          </p>
          <p><span id="status"></span></p>

          <p>
            <label hidden="true" for="vid">Vendor ID (hex):</label>
            <input
              hidden="true"
              list="vendor_ids"
              type="text"
              name="vid"
              id="vid"
              maxlength="6"
              size="8"
              pattern="0x[A-Fa-f0-9]{1,4}"
            />
            <datalist id="vendor_ids"> </datalist>
          </p>

          <div id="dfuseFields" hidden="true">
            <label for="dfuseStartAddress" hidden="true"
              >DfuSe Start Address:</label
            >
            <input
              type="text"
              name="dfuseStartAddress"
              id="dfuseStartAddress"
              hidden="true"
              title="Initial memory address to read/write from (hex)"
              size="10"
              pattern="0x[A-Fa-f0-9]+"
            />
            <label for="dfuseUploadSize" hidden="true"
              >DfuSe Upload Size:</label
            >
            <input
              type="number"
              name="dfuseUploadSize"
              id="dfuseUploadSize"
              min="1"
              max="2097152"
              hidden="true"
            />
          </div>
        </form>
        <div hidden>
          <legend>Getting Started? Flash the Blink firmware!</legend>
          <button variant="es" id="blink" :disabled="no_device">
            Flash Blink!
          </button>
          <legend>Or select a file from your computer</legend>
          <b-form-file
            id="firmwareFile"
            v-model="firmwareFile"
            :state="Boolean(firmwareFile)"
            placeholder="Choose or drop a file..."
            drop-placeholder="Drop file here..."
          ></b-form-file>
        </div>
        <div id="usbInfo" hidden="true" style="white-space: pre"></div>
        <div id="dfuInfo" hidden="true" style="white-space: pre"></div>
        <button hidden variant="es" v-b-toggle.collapseAdvanced>
          Advanced...
        </button>

        <button hidden variant="es" id="bootloader" :disabled="no_device">
          Flash Bootloader Image
        </button>
        <div id="readme"></div>
        {{console.log(this.configFormValid)}}
      </div>
    </div>
  `,
  data: data,
  computed: {
    isChromiumBasedBrowser() {
      return (
        /Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent)
      );
    },
    platformFirmwares: function () {
      return this.firmwares.filter(
        (firmware) =>
          firmware.platform === this.sel_platform && firmware.active,
      );
    },
  },
  beforeDestroy() {
    document.removeEventListener("click", this.handleClickOutside, true);
  },
  mounted() {
    document.addEventListener("click", this.handleClickOutside, true);
    this.sel_platform = "models";
    var self = this;
    this.importfirmwares();
  },
  methods: {
    toggleWinDriverInstructions() {
      this.showWinDriverInstructions = !this.showWinDriverInstructions;
    },
    updateProgressColor(bgColor) {
      const styleElement = document.createElement("style");
      styleElement.type = "text/css";
      const cssRules = /* HTML */ `
        progress::-webkit-progress-value { background-color: ${bgColor} }
      `;

      if (styleElement.styleSheet) {
        styleElement.styleSheet.cssText = cssRules; // Support for IE
      } else {
        styleElement.appendChild(document.createTextNode(cssRules));
      }

      // Remove the existing custom style for progress if it exists to prevent duplicates
      const existingStyle = document.getElementById("dynamic-progress-style");
      if (existingStyle) {
        existingStyle.parentNode.removeChild(existingStyle);
      }

      // Add an ID to the style element to make it easier to find and remove later if needed
      styleElement.id = "dynamic-progress-style";

      // Append the new style element to the <head> of the document
      document.head.appendChild(styleElement);
    },
    hoverEnter(event, bgColor) {
      event.target.style.backgroundColor = bgColor;
    },

    hoverLeave(event) {
      event.target.style.backgroundColor = ""; // Reset to default or you can set it to another color
    },
    showOverlay() {
      this.updateButtonDisabled = true;
      this.overlayVisible = true;

      setTimeout(() => {
        this.updateButtonDisabled = false;
      }, 18000);
    },
    handleAccordionMouseEnter() {
      this.isAccordionHovered = true;
    },
    handleAccordionMouseLeave() {
      this.isAccordionHovered = false;
    },
    handleClickOutside(event) {
      const accordion = this.$el.querySelector(".accordion-parent");
      if (
        accordion &&
        !accordion.contains(event.target) &&
        this.accordionOpen
      ) {
        this.closeAccordion();
      }
    },
    selectfirmware(firmware) {
      this.sel_firmware = firmware;
      this.closeAccordion();
      this.programChanged();
    },
    toggleAccordion() {
      this.accordionOpen = !this.accordionOpen;
    },
    closeAccordion() {
      this.accordionOpen = false;
    },
    navigateBackOrRedirect() {
      if (document.referrer.includes("https://chasebliss.com")) {
        window.history.back();
      } else {
        window.location.href = "https://chasebliss.com";
      }
    },
    importfirmwares() {
      var self = this;
      var src_url = getRootUrl().split("?")[0].concat("data/sources.json"); //need to strip out query string
      var raw = new XMLHttpRequest();
      raw.open("GET", src_url, true);
      raw.responseType = "text";
      raw.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
          var obj = this.response;
          buffer = JSON.parse(obj);
          buffer.forEach(function (ex_src) {
            var ext_raw = new XMLHttpRequest();
            ext_raw.open("GET", ex_src.data_url, true);
            ext_raw.responseType = "text";
            ext_raw.onreadystatechange = function () {
              if (this.readyState === 4 && this.status === 200) {
                var ext_obj = this.response;
                ex_buffer = JSON.parse(ext_obj);
                const unique_platforms = [
                  ...new Set(ex_buffer.map((obj) => obj.platform)),
                ];
                ex_buffer.forEach(function (ex_dat) {
                  ex_dat.source = ex_src;

                  self.firmwares.sort(function (i1, i2) {
                    return i1.name.toLowerCase() < i2.name.toLowerCase()
                      ? -1
                      : 1;
                  });
                  self.firmwares.push(ex_dat);
                });
                unique_platforms.forEach(function (u_plat) {
                  if (!self.platforms.includes(u_plat)) {
                    self.platforms.push(u_plat);
                  }
                });
              }
            };
            ext_raw.send(null);
          });
        }
      };
      raw.send(null);
    },
    programChanged() {
      var self = this;
      self.firmwareFileName = self.sel_firmware.name;
      this.displaySelectedFile = true;
      var srcurl = self.sel_firmware.source.repo_url;
      var expath = srcurl.concat(self.sel_firmware.filepath);
      readServerFirmwareFile(expath).then((buffer) => {
        firmwareFile = buffer;
      });
    },
  },
  watch: {
    "sel_firmware.bgColor"(newColor, oldColor) {
      if (this.overlayVisible && newColor) {
        this.updateProgressColor(newColor);
      }
    },
    overlayVisible(newVal) {
      // When the overlay becomes visible, update the progress bar color if sel_firmware.bgColor is available
      if (newVal && this.sel_firmware && this.sel_firmware.bgColor) {
        this.updateProgressColor(this.sel_firmware.bgColor);
      }
    },
    firmwareFile(newfile) {
      firmwareFile = null;
      this.displaySelectedFile = true;
      var new_firmware = {
        name: newfile.name,
        description: "Imported File",
        filepath: null,
        platform: null,
      };
      this.sel_firmware = new_firmware;
      let reader = new FileReader();
      reader.onload = function () {
        this.firmwareFile = reader.result;
        firmwareFile = reader.result;
      };
      reader.readAsArrayBuffer(newfile);
    },
    firmwares() {
      var self = this;

      var searchParams = new URLSearchParams(getRootUrl().split("?")[1]);
      var platform = searchParams.get("platform");
      var name = searchParams.get("name");
      if (
        platform != null &&
        self.firmwares.filter((ex) => ex.platform === platform)
      ) {
        self.sel_platform = platform;

        if (name != null) {
          var ex = self.firmwares.filter(
            (ex) => ex.name === name && ex.platform === platform,
          )[0];
          if (ex != null) {
            self.sel_firmware = ex;
            this.programChanged();
          }
        }
      }
    },
  },
});
