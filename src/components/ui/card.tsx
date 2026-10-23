import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated" | "soft";
};

export function Card({
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  const surfaceClass =
    variant === "elevated"
      ? "surface-card"
      : variant === "soft"
        ? "rounded-panel border border-divider bg-surface-soft"
        : "surface-panel";

  return <div className={`${surfaceClass} ${className}`.trim()} {...props} />;
}
