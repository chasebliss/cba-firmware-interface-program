import { BinaryHero } from "@/components/BinaryHero";
import { Logo } from "@/components/Logo";

interface AdminHeaderProps {
  flashing?: boolean;
}

export const AdminHeader = ({ flashing = false }: AdminHeaderProps) => {
  return (
    <>
      <div className="bg-black px-[7vw]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Logo width={160} className="text-cream opacity-70" />
            <span className="block h-4 w-px bg-white/20" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              Admin
            </span>
          </div>
          <a
            href="/beta"
            className="group flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-cream/45 no-underline"
          >
            <svg
              className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-x-[3px]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            To Beta
          </a>
        </div>
      </div>
      <div className="border-b-2 border-black bg-cream px-[7vw]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between py-[22px]">
          <h1
            className="font-bold tracking-[-0.02em]"
            style={{ fontSize: "clamp(1.6rem, 2.2vw, 2.15rem)" }}
          >
            Admin Programmer.
          </h1>
          <BinaryHero width={300} flashing={flashing} />
        </div>
      </div>
    </>
  );
};
