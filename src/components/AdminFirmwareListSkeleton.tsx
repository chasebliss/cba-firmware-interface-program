import { CHANNELS, type SaveTarget } from "@/lib/admin-firmware";

interface AdminFirmwareListSkeletonProps {
  cachedCounts: Partial<Record<SaveTarget, number>>;
}

export const AdminFirmwareListSkeleton = ({
  cachedCounts,
}: AdminFirmwareListSkeletonProps) => {
  const sections = CHANNELS.map((channel) => ({
    id: channel.id,
    label: channel.label,
    color: channel.color,
    count: cachedCounts[channel.id] ?? 0,
  }));

  return (
    <>
      {sections
        .filter((s) => s.count > 0)
        .map((section) => (
          <section key={`skel-${section.id}`}>
            <div className="mb-2 flex items-baseline gap-2">
              <span
                className="text-micro font-bold uppercase tracking-widest"
                style={{ color: section.color }}
              >
                {section.label}
              </span>
              <span className="text-micro font-bold tracking-widest text-text/35">
                {section.count}
              </span>
            </div>
            <ul className="flex flex-col">
              {Array.from({ length: section.count }).map((_, i) => (
                <li
                  key={i}
                  className="animate-cba-pulse relative flex items-center gap-3 bg-surface px-3.5 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-px -top-px left-0 z-1 w-[4px] bg-text/10"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-text/10" />
                      <div className="h-[17px] w-36 bg-text/10" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="h-[13px] w-40 bg-text/10" />
                      <div className="h-[12px] w-12 shrink-0 bg-text/10" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="h-[24px] w-[52px] border border-border/10" />
                    <div className="h-[24px] w-[66px] border border-border/10" />
                    <div className="h-[24px] w-[62px] border border-border/10" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  );
};
