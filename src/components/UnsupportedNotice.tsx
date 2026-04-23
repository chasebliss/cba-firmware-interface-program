interface UnsupportedNoticeProps {
  reason: "mobile" | "browser";
}

export const UnsupportedNotice = ({ reason }: UnsupportedNoticeProps) => {
  const heading =
    reason === "mobile" ? "Open on a desktop." : "Use a Chromium browser.";
  const body =
    reason === "mobile"
      ? "Bliss Programmer flashes firmware over USB, which only works on a desktop or laptop running Chrome, Edge, or another Chromium-based browser."
      : "Your browser does not support WebUSB. Open this page in Chrome, Edge, or another Chromium-based browser on a desktop or laptop.";

  return (
    <div className="flex min-h-screen items-start justify-center px-6 py-10">
      <div className="w-full max-w-md border-2 border-red bg-cream p-8 shadow-cba">
        <h1 className="mb-4 text-2xl font-bold text-red">{heading}</h1>
        <p className="text-sm leading-relaxed text-red">{body}</p>
      </div>
    </div>
  );
};
