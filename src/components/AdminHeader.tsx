import { BinaryHero } from "@/components/BinaryHero";
import { Nav } from "@/components/Nav";
import type { StoreInfo } from "@/lib/admin-firmware";

interface AdminHeaderProps {
  flashing?: boolean;
  // Where a save lands. Null until the first catalogue load answers.
  store?: StoreInfo | null;
}

export const AdminHeader = ({
  flashing = false,
  store = null,
}: AdminHeaderProps) => {
  return (
    <>
      <Nav
        variant="dark"
        rightLabel="Admin"
        backLink={{ href: "/beta", label: "To Beta" }}
      />
      <div className="border-b border-border/10 bg-surface px-[7vw]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:py-[22px]">
          <div className="text-center md:text-left">
            <h1
              className="font-bold tracking-[-0.02em]"
              style={{ fontSize: "clamp(1.6rem, 2.2vw, 2.15rem)" }}
            >
              Admin Programmer.
            </h1>
            {/* Production writes to main and reads quietly. Anything else is
                a testing environment, and the accent colour is there so you
                never wonder which site you are editing. */}
            {store && (
              <p
                className={`mt-1 text-micro font-semibold uppercase tracking-[0.06em] ${
                  store.kind === "github" && store.branch === "main"
                    ? "text-text/38"
                    : "text-accent"
                }`}
              >
                {store.kind === "local"
                  ? "Saving to local files"
                  : `Saving to ${store.branch} on GitHub`}
              </p>
            )}
          </div>
          <BinaryHero width={300} flashing={flashing} className="max-w-full" />
        </div>
      </div>
    </>
  );
};
