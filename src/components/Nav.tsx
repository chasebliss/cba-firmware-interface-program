import { type ReactNode } from "react";
import { Logo } from "@/components/Logo";

interface NavProps {
  variant?: "light" | "dark";
  showInstructions?: boolean;
  rightSlot?: ReactNode;
}

export const Nav = ({ variant = "light" }: NavProps) => {
  const isDark = variant === "dark";
  const linkColor = isDark ? "text-cream" : "text-black";
  const borderClass = isDark ? "" : "border-b-2 border-black";

  return (
    <nav
      className={`relative mx-auto flex w-full max-w-[1200px] items-center py-[30px] ${borderClass}`}
    >
      <div className="flex whitespace-nowrap">
        <a
          href="https://chasebliss.com"
          className={`group flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] no-underline ${linkColor}`}
        >
          <svg
            className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-x-[3px]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          To chasebliss.com
        </a>
      </div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        aria-label="Chase Bliss Audio"
        className="absolute left-1/2 -translate-x-1/2"
      >
        <Logo width={200} className={isDark ? "text-cream" : "text-black"} />
      </a>
    </nav>
  );
};
