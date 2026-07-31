import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientIcon, statusVariant } from "@/components/ai/ai-client-icon";
import { ClientInstructions } from "@/components/ai/ai-client-instructions";
import { CONSUMER_AI_CLIENTS, type AiClient } from "@/lib/mcp/aiClients";
import { cn } from "@/lib/utils";

// Claude primeiro, demais assistentes preservados na ordem atual.
const orderedClients: AiClient[] = [
  ...CONSUMER_AI_CLIENTS.filter((client) => client.id === "claude"),
  ...CONSUMER_AI_CLIENTS.filter((client) => client.id !== "claude"),
];

export function AiAssistantCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedClient, setSelectedClient] = useState<AiClient | null>(null);
  const lastIndex = orderedClients.length - 1;

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const child = scroller.firstElementChild as HTMLElement | null;
    if (!child) return;
    const step = child.offsetWidth + 12;
    setActiveIndex(
      Math.min(lastIndex, Math.max(0, Math.round(scroller.scrollLeft / step))),
    );
  }, [lastIndex]);

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = scroller.children[index] as HTMLElement | undefined;
    if (!target) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scroller.scrollTo({
      left: target.offsetLeft - scroller.offsetLeft,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const dots = useMemo(
    () => orderedClients.map((client) => client.id),
    [],
  );

  return (
    <section aria-labelledby="assistants-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="assistants-title" className="text-lg font-semibold">
            Escolha seu assistente
          </h2>
          <p className="text-sm text-muted-foreground">
            Deslize para ver as opções disponíveis.
          </p>
        </div>
        <div className="hidden shrink-0 gap-1 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Assistente anterior"
            disabled={activeIndex === 0}
            onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Próximo assistente"
            disabled={activeIndex === lastIndex}
            onClick={() => scrollToIndex(Math.min(lastIndex, activeIndex + 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        role="group"
        aria-label="Assistentes de IA compatíveis"
        className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 pb-2 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {orderedClients.map((client) => {
          const isRecommended = client.id === "claude";

          return (
            <article
              key={client.id}
              className="flex w-[82%] shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm sm:w-[46%] lg:w-[31%]"
            >
              <div className="flex items-start justify-between gap-2">
                <ClientIcon
                  icon={client.icon}
                  className="h-8 w-8 text-foreground"
                />
                {isRecommended && <Badge>Recomendado</Badge>}
              </div>
              <h3 className="text-base font-semibold leading-tight">
                {client.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {client.shortDescription}
              </p>
              <Badge
                variant={statusVariant[client.status]}
                className="w-fit max-w-full whitespace-normal px-2 py-0.5 text-[10px] leading-tight"
              >
                {client.statusLabel}
              </Badge>
              <Button
                type="button"
                variant="outline"
                className="mt-auto min-h-11 w-full"
                aria-label={`Ver como conectar ao ${client.name}`}
                onClick={() => setSelectedClient(client)}
              >
                Ver como conectar
              </Button>
            </article>
          );
        })}
      </div>

      <div className="flex justify-center gap-1.5" aria-hidden="true">
        {dots.map((id, index) => (
          <span
            key={id}
            className={cn(
              "h-1.5 rounded-full transition-all motion-reduce:transition-none",
              index === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-muted",
            )}
          />
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {`Assistente ${activeIndex + 1} de ${orderedClients.length}: ${orderedClients[activeIndex]?.name ?? ""}`}
      </p>

      <Dialog
        open={selectedClient !== null}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedClient
                ? `Como conectar ao ${selectedClient.name}`
                : "Como conectar"}
            </DialogTitle>
            <DialogDescription>
              Passos e disponibilidade da integração.
            </DialogDescription>
          </DialogHeader>
          {selectedClient && <ClientInstructions client={selectedClient} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
