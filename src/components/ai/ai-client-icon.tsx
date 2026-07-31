import { Github, MousePointer2, type LucideIcon } from "lucide-react";
import { AiBrandIcon } from "@/components/ai/AiBrandIcon";
import {
  isAiBrandIcon,
  type AiAdvancedIconId,
  type AiClientIcon,
  type AiClientStatus,
} from "@/lib/mcp/aiClients";

const advancedIconById: Record<AiAdvancedIconId, LucideIcon> = {
  cursor: MousePointer2,
  github: Github,
};

export const statusVariant: Record<
  AiClientStatus,
  "default" | "secondary" | "outline"
> = {
  tested: "default",
  supported: "secondary",
  restricted: "outline",
  unavailable: "outline",
  advanced: "secondary",
};

export function ClientIcon({
  icon,
  className,
}: {
  icon: AiClientIcon;
  className?: string;
}) {
  if (isAiBrandIcon(icon)) {
    return <AiBrandIcon icon={icon} className={className} />;
  }

  const Icon = advancedIconById[icon];
  return <Icon className={className} aria-hidden="true" />;
}
