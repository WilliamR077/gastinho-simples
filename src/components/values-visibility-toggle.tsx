import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ValuesVisibilityToggle() {
  const { isHidden, toggleVisibility } = useValuesVisibility();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleVisibility}
          className="h-9 w-9"
        >
          {isHidden ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          <span className="sr-only">
            {isHidden ? "Mostrar valores" : "Esconder valores"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isHidden ? "Mostrar valores" : "Esconder valores"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
