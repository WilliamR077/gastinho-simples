import { useEffect, useId, useMemo, useState } from "react";
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
import { useCopyText } from "@/components/ai/use-copy-text";
import { CLAUDE_WEB_URL, type AiContextualPrompt } from "@/lib/mcp/aiContextualHints";
import { cn } from "@/lib/utils";

/** Rota real da página de Integrações com IA (registrada em src/App.tsx). */
const AI_INTEGRATIONS_ROUTE = "/settings/ai-integrations";

export interface AiHelpHintProps {
  /** Título contextual exibido no modal. */
  title: string;
  /** Explicação curta exibida no modal. */
  description: string;
  /** Coleção de prompts do contexto, agrupados por categoria. */
  prompts: AiContextualPrompt[];
  /** Nome acessível do botão que abre o modal. */
  ariaLabel: string;
  /** Classes extras para o botão gatilho. */
  className?: string;
}

/**
 * Botão discreto de ajuda contextual com IA. Abre um modal com categorias e
 * prompts prontos para copiar. Não acessa Supabase e não chama tools MCP.
 */
export function AiHelpHint({
  title,
  description,
  prompts,
  ariaLabel,
  className,
}: AiHelpHintProps) {
  const [open, setOpen] = useState(false);
  const statusId = useId();
  const { copy, copiedKey } = useCopyText({
    successTitle: "Comando copiado",
    successDescription: "Cole o comando no seu assistente de IA.",
  });

  const categories = useMemo(() => {
    const seen: string[] = [];
    prompts.forEach((item) => {
      if (!seen.includes(item.category)) seen.push(item.category);
    });
    return seen;
  }, [prompts]);

  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "");
  const categoryPrompts = useMemo(
    () => prompts.filter((item) => item.category === activeCategory),
    [prompts, activeCategory],
  );
  const [activeId, setActiveId] = useState(categoryPrompts[0]?.id ?? "");

  useEffect(() => {
    if (!categoryPrompts.some((item) => item.id === activeId)) {
      setActiveId(categoryPrompts[0]?.id ?? "");
    }
  }, [categoryPrompts, activeId]);

  const selected =
    categoryPrompts.find((item) => item.id === activeId) ?? categoryPrompts[0];
  const selectedPrompt = selected?.prompt ?? "";
  const copied = copiedKey === selectedPrompt && selectedPrompt !== "";

  const handleCopyAndOpen = async () => {
    try {
      if (selectedPrompt) await copy(selectedPrompt);
    } finally {
      window.open(CLAUDE_WEB_URL, "_blank", "noopener,noreferrer");
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

      <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0 sm:w-full sm:max-w-2xl">
        <DialogHeader className="space-y-2 p-4 pb-3 text-left sm:p-6 sm:pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </span>
            <DialogTitle className="min-w-0 break-words text-base sm:text-lg">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 px-4 sm:px-6">
          <div
            role="tablist"
            aria-label="Categorias de comandos"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
          >
            {categories.map((category) => {
              const isActive = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="min-w-0 px-4 pb-4 sm:px-6">
            {categoryPrompts.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {categoryPrompts.map((item) => {
                  const isActive = item.id === selected?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        "min-w-0 max-w-full rounded-md border px-3 py-2 text-left text-xs font-medium",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {selected ? `Comando · ${selected.title}` : "Comando"}
            </p>
            <p className="whitespace-pre-wrap break-words rounded-lg border bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
              {selectedPrompt}
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

        <DialogFooter className="grid shrink-0 grid-cols-1 gap-2 border-t p-4 sm:grid-cols-3 sm:space-x-0">
          <Button
            onClick={() => copy(selectedPrompt)}
            className="min-h-11 w-full min-w-0"
            aria-describedby={statusId}
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{copied ? "Copiado" : "Copiar comando"}</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyAndOpen}
            className="min-h-11 w-full min-w-0"
          >
            <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Copiar e abrir o Claude</span>
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" asChild className="min-h-11 w-full min-w-0">
              <Link to={AI_INTEGRATIONS_ROUTE}>
                <Settings2 className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Configurar minha IA</span>
              </Link>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
