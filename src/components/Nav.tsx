import { Logo } from "@/components/Logo";

interface NavBackLink {
  href: string;
  label: string;
}

export interface NavProps {
  variant?: "light" | "dark";
  rightLabel?: string;
  backLink?: NavBackLink;
}

const DEFAULT_BACK_LINK: NavBackLink = {
  href: "https://chasebliss.com",
  label: "To chasebliss.com",
};

export const Nav = ({
  variant = "light",
  rightLabel,
  backLink = DEFAULT_BACK_LINK,
}: NavProps) => {
  const isDark = variant === "dark";
  const textColor = isDark ? "text-cream" : "text-black";
  const dividerBg = isDark ? "bg-cream" : "bg-black";
  const wrapperBg = isDark ? "bg-black" : "";
  const wrapperBorder = isDark ? "" : "border-b-2 border-black";

  return (
    <nav className={`${wrapperBg} ${wrapperBorder} px-[7vw]`}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between py-[30px]">
        <a
          href={backLink.href}
          className={`group flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] no-underline ${textColor}`}
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
          {backLink.label}
        </a>
        <div className="flex items-center gap-3">
          <Logo width={160} className={textColor} />
          {rightLabel && (
            <>
              <span className={`block h-4 w-px ${dividerBg}`} />
              <span
                className={`font-mono text-[11px] bg-red text-black py-1 px-2 font-bold uppercase tracking-widest ${textColor}`}
              >
                {rightLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
