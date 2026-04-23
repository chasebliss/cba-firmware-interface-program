import type { ButtonHTMLAttributes } from "react";

interface CbaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "success";
}

export const CbaButton = ({
  variant = "default",
  className = "",
  children,
  disabled,
  ...rest
}: CbaButtonProps) => {
  const isSuccess = variant === "success";
  const colorClasses = isSuccess
    ? "border-green text-green shadow-cba"
    : "border-black text-black hover:shadow-cba";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`h-[50px] w-[240px] border-2 bg-cream px-3 py-2 text-base font-bold transition-shadow duration-300 ease-in-out enabled:hover:italic disabled:cursor-not-allowed disabled:opacity-40 ${colorClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
