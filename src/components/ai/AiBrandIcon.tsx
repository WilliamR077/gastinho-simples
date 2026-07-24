import type { IconType } from "react-icons";
import { BsOpenai } from "react-icons/bs";
import { RiMicrosoftCopilotFill } from "react-icons/ri";
import {
  SiClaude,
  SiDeepseek,
  SiGooglegemini,
  SiPerplexity,
} from "react-icons/si";
import type { AiBrandIconId } from "@/lib/mcp/aiClients";
import { cn } from "@/lib/utils";

const brandIconById: Record<AiBrandIconId, IconType> = {
  claude: SiClaude,
  perplexity: SiPerplexity,
  chatgpt: BsOpenai,
  gemini: SiGooglegemini,
  "microsoft-copilot": RiMicrosoftCopilotFill,
  deepseek: SiDeepseek,
};

export function AiBrandIcon({
  icon,
  className,
}: {
  icon: AiBrandIconId;
  className?: string;
}) {
  const Icon = brandIconById[icon];

  return (
    <Icon
      className={cn("h-7 w-7 shrink-0 lg:h-8 lg:w-8", className)}
      aria-hidden="true"
    />
  );
}
