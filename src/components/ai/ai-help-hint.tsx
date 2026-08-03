import { useId, useState } from "react";
import { Bot, Check, Copy, ExternalLink, Settings2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CLAUDE_WEB_URL } from "@/lib/mcp/aiContextualHints";
import { cn } from "@/lib/utils";

/** Rota real da página de Integrações com IA (registrada em src/App.tsx). */
const AI_INTEGRATIONS_ROUTE = "/settings/ai-integrations";

export interface AiHelpHintProps {
  /** Título contextual exibido no modal. */
  title: string;
  /** Explicação curta exibida no modal. */
  description: string;
  /** Prompt completo, sem dados financeiros, IDs ou dados privados. */
  prompt: string;
  /** Nome acessível do botão que abre o modal. */
  ariaLabel: string;
  /** Classes extras para o botão gatilho. */
  className?: string;
}

/**
 * Botão discreto de ajuda contextual com IA. Abre um modal com o prompt
 * pronto para copiar. Não acessa Supabase e não chama nenhuma tool MCP.
 */
export function AiHelpHint({
  title,
  description,
  prompt,
  ariaLabel,
  className,
}: AiHelpHintProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusId = useId();

  const handleCopy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      const el = document.createElement("textarea");
      el.value = prompt;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        ok = true;
      } catch {
        ok = false;
      }
      document.body.removeChild(el);
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={ariaLabel}
                className={cn(
                  "h-11 w-11 shrink-0 rounded-full text-primary hover:bg-primary/10 hover:text-primary",
                  className,
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Ajuda com IA</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-hidden p-0 sm:w-full">
        <div className="flex max-h-[85dvh] flex-col">
          <DialogHeader className="space-y-2 p-6 pb-3 text-left">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1 px-6">
            <div className="pb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Comando
              </p>
              <p className="whitespace-pre-wrap rounded-lg border bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                {prompt}
              </p>
              <p
                id={statusId}
                role="status"
                aria-live="polite"
                className="mt-2 min-h-5 text-xs font-medium text-primary"
              >
                {copied ? "Comando copiado para a área de transferência." : ""}
              </p>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col gap-2 border-t p-4 sm:flex-row sm:justify-end">
            <Button
              onClick={handleCopy}
              className="w-full min-h-11 sm:w-auto"
              aria-describedby={statusId}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copiado" : "Copiar comando"}
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full min-h-11 sm:w-auto"
            >
              <a href={CLAUDE_WEB_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Abrir o Claude
              </a>
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" asChild className="w-full min-h-11 sm:w-auto">
                <Link to={AI_INTEGRATIONS_ROUTE}>
                  <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Configurar minha IA
                </Link>
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
