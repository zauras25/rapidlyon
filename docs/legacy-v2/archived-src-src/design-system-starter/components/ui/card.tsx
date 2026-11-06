import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`ds-card ${className}`.trim()} />;
}
