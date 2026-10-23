import {
  CheckCheck,
  Code2,
  Compass,
  ListChecks,
  PanelsTopLeft,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  Discover: Compass,
  Plan: ListChecks,
  Design: PanelsTopLeft,
  Build: Code2,
  QA: CheckCheck,
  Launch: Rocket,
};

export function ProcessStepIcon({ title }: { title: string }) {
  const Icon = icons[title] ?? Compass;

  return <Icon aria-hidden="true" focusable="false" size={18} strokeWidth={1.75} />;
}
