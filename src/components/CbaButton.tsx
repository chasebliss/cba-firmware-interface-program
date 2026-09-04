import type { ButtonHTMLAttributes } from "react";

interface CbaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "success" | "danger";
  size?: "md" | "sm";
  fullWidth?: boolean;
}

export const CbaButton = ({
  variant = "default",
  size = "md",
  fullWidth = false,
  className = "",
  style,
  children,
  disabled,
  ...rest
}: CbaButtonProps) => {
  const colorClasses =
    variant === "success"
      ? "border-ok text-ok"
      : variant === "danger"
        ? "border-bad text-bad"
        : "border-border text-text";

  const sizeClasses =
    size === "sm"
      ? "h-10 text-caption tracking-[0.07em]"
      : "h-[52px] text-body tracking-[0.02em]";

  return (
    <button
      type="button"
      disabled={disabled}
      style={style}
      className={`shrink-0 border-2 bg-surface px-4 font-bold transition-shadow duration-200 ease-in-out enabled:hover:italic enabled:hover:shadow-cba disabled:cursor-not-allowed disabled:opacity-[0.28] ${colorClasses} ${sizeClasses} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
