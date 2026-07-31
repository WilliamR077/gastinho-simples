import { useState } from "react";
import { Check, Copy, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCopyText } from "@/components/ai/use-copy-text";
import {
  AI_COMMAND_CATEGORIES,
  AI_COMMAND_EXAMPLES,
  AI_COMMAND_NOTE,
  FEATURED_AI_COMMANDS,
  type AiCommandCategory,
} from "@/lib/mcp/aiCommands";
import { cn } from "@/lib/utils";

function CommandRow({
  text,
  copied,
  onCopy,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
      <span className="min-w-0 flex-1 break-words text-sm">“{text}”</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCopy}
        aria-label={copied ? "Comando copiado" : `Copiar comando: ${text}`}
        className="h-11 w-11 shrink-0"
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </li>
  );
}

export function AiCommandExamples() {
  const { copy, copiedKey } = useCopyText({
    successTitle: "Comando copiado",
    successDescription: "Cole o comando na conversa do seu assistente.",
  });
  const [activeCategory, setActiveCategory] =
    useState<AiCommandCategory | "todos">("todos");

  const visibleFeatured =
    activeCategory === "todos"
      ? FEATURED_AI_COMMANDS
      : AI_COMMAND_EXAMPLES.filter(
          (example) => example.category === activeCategory,
        ).slice(0, 3);

  return (
    <section aria-labelledby="commands-title" className="space-y-3">
      <div>
        <h2 id="commands-title" className="text-lg font-semibold">
          Experimente agora
        </h2>
        <p className="text-sm text-muted-foreground">
          Copie um comando e envie no seu assistente.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar exemplos por categoria"
      >
        {[{ id: "todos" as const, label: "Todos" }, ...AI_COMMAND_CATEGORIES].map(
          (category) => {
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                  isActive
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {category.label}
              </button>
            );
          },
        )}
      </div>

      <ul className="space-y-2">
        {visibleFeatured.map((example) => (
          <CommandRow
            key={example.text}
            text={example.text}
            copied={copiedKey === example.text}
            onCopy={() => copy(example.text)}
          />
        ))}
        {visibleFeatured.length === 0 && (
          <li className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Veja mais exemplos desta categoria abaixo.
          </li>
        )}
      </ul>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
          >
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Ver mais exemplos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exemplos de comandos</DialogTitle>
            <DialogDescription>
              Comandos organizados por categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {AI_COMMAND_CATEGORIES.map((category) => {
              const items = AI_COMMAND_EXAMPLES.filter(
                (example) => example.category === category.id,
              );
              if (items.length === 0) return null;

              return (
                <div key={category.id} className="space-y-2">
                  <h3 className="text-sm font-semibold">{category.label}</h3>
                  <ul className="space-y-2">
                    {items.map((example) => (
                      <CommandRow
                        key={example.text}
                        text={example.text}
                        copied={copiedKey === example.text}
                        onCopy={() => copy(example.text)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
            <p className="text-sm text-muted-foreground">{AI_COMMAND_NOTE}</p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
