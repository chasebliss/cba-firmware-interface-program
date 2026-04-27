import { CbaButton } from "@/components/CbaButton";
import { SectionLabel } from "@/components/SectionLabel";
import {
  GOLD,
  type ConnectStatus,
  type FlashStatus,
} from "@/lib/admin-firmware";

interface AdminFlashSectionProps {
  hasFile: boolean;
  connectStatus: ConnectStatus;
  connectError: string | null;
  flashStatus: FlashStatus;
  flashMessage: string | null;
  flashError: string | null;
  flashProgress: { done: number; total: number };
  canConnect: boolean;
  canUpdate: boolean;
  onConnect: () => void;
  onUpdate: () => void;
  onFlashAgain: () => void;
}

export const AdminFlashSection = ({
  hasFile,
  connectStatus,
  connectError,
  flashStatus,
  flashMessage,
  flashError,
  flashProgress,
  canConnect,
  canUpdate,
  onConnect,
  onUpdate,
  onFlashAgain,
}: AdminFlashSectionProps) => {
  const flashing = flashStatus === "preparing" || flashStatus === "installing";
  const flashActive = flashStatus !== "idle";
  const errored = flashStatus === "error";
  const flashDone = flashStatus === "complete";

  const progressRatio =
    flashProgress.total > 0
      ? Math.min(1, flashProgress.done / flashProgress.total)
      : 0;
  const progressPct = Math.round(progressRatio * 100);

  return (
    <div
      className="mb-7 border-b border-black/10 pb-7 transition-opacity duration-300"
      style={{ opacity: hasFile ? 1 : 0.4 }}
    >
      <SectionLabel>2. Connect &amp; flash</SectionLabel>
      <div
        key={
          flashing
            ? "flashing"
            : errored
              ? "error"
              : flashDone
                ? "complete"
                : "idle"
        }
        className="animate-tab-fade"
      >
        {!flashActive && (
          <>
            <div className="flex gap-2.5">
              <CbaButton
                disabled={!canConnect}
                variant={connectStatus === "connected" ? "success" : "default"}
                onClick={onConnect}
                fullWidth
                className="flex-1"
                style={{
                  opacity: connectStatus === "connected" ? 1 : undefined,
                }}
              >
                {connectStatus === "connecting"
                  ? "Connecting…"
                  : connectStatus === "connected"
                    ? "Connected ✓"
                    : "Connect"}
              </CbaButton>
              <CbaButton
                disabled={!canUpdate}
                variant={canUpdate ? "success" : "default"}
                onClick={onUpdate}
                fullWidth
                className="flex-1"
              >
                Update
              </CbaButton>
            </div>
            {connectError && (
              <p className="mt-2.5 text-sm font-semibold text-red">
                {connectError}
              </p>
            )}
          </>
        )}
        {flashing && (
          <div className="flex flex-col items-center gap-2.5">
            <progress
              value={progressPct}
              max={100}
              className="block h-[6px] w-full appearance-none border-none [&::-webkit-progress-bar]:bg-black/10"
            />
            <style>{`progress::-webkit-progress-value{background:${GOLD};transition:width .4s ease;}progress::-moz-progress-bar{background:${GOLD};}`}</style>
            <div className="animate-cba-pulse text-[14px] font-bold text-green">
              {flashStatus === "preparing"
                ? (flashMessage ?? "Preparing…")
                : `Uploading… ${progressPct}%`}
            </div>
          </div>
        )}
        {errored && (
          <div className="flex flex-col items-center gap-2.5">
            <progress
              value={progressPct}
              max={100}
              className="block h-[6px] w-full appearance-none border-none [&::-webkit-progress-bar]:bg-black/10"
            />
            <style>{`progress::-webkit-progress-value{background:var(--color-red);transition:width .4s ease;}progress::-moz-progress-bar{background:var(--color-red);}`}</style>
            <p className="text-[14px] font-bold text-red">
              {flashError ?? "Flash failed"}
            </p>
            <CbaButton size="sm" onClick={onFlashAgain} style={{ width: 160 }}>
              Try again
            </CbaButton>
          </div>
        )}
        {flashDone && (
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-[14px] font-bold text-green">Flash complete.</p>
            <CbaButton size="sm" onClick={onFlashAgain} style={{ width: 160 }}>
              Flash again
            </CbaButton>
          </div>
        )}
      </div>
    </div>
  );
};
