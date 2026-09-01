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
      className={`mb-2.5 text-meta font-bold uppercase tracking-widest text-text/38 ${className}`}
    >
      {children}
    </p>
  );
};
