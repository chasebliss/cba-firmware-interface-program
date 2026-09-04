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
  // The dark variant uses --nav-dark-*, not --text/--surface. Those two swap
  // under a theme, which would flip this bar to light on the very page that
  // asks for it to be dark. The nav-dark pair is fixed by design.
  const isDark = variant === "dark";
  const textColor = isDark ? "text-nav-dark-text" : "text-text";
  const dividerBg = isDark ? "bg-nav-dark-text" : "bg-text";
  const wrapperBg = isDark ? "bg-nav-dark-bg" : "";
  const wrapperBorder = isDark ? "" : "border-b-2 border-border";

  return (
    <nav className={`${wrapperBg} ${wrapperBorder} px-[7vw]`}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between py-[30px]">
        <a
          href={backLink.href}
          className={`group flex items-center gap-1.5 text-caption font-bold uppercase tracking-[0.1em] no-underline ${textColor}`}
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
              {/* Ink here is --text-fixed, not --text: the ground is --bad,
                  which is the same red in every theme, so the ink on it must
                  not follow the theme either. It also drops the trailing
                  ${textColor}, which silently overrode the colour set earlier
                  in the same class list. */}
              <span
                className="bg-bad text-text-fixed px-2 py-1 font-mono text-caption font-bold uppercase tracking-widest"
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
