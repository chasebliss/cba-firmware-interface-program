import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export const SectionLabel = ({
  children,
  className = "",
}: SectionLabelProps) => {
  return (
    <p
      className={`mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black/[0.38] ${className}`}
    >
      {children}
    </p>
  );
};
