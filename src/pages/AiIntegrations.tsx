import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Github,
  Link2,
  LockKeyhole,
  MessageSquareText,
  MousePointer2,
  ShieldCheck,
  Unplug,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { AiBrandIcon } from "@/components/ai/AiBrandIcon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Footer } from "@/components/footer";
import { toast } from "@/hooks/use-toast";
import {
  ADVANCED_AI_CLIENTS,
  CONSUMER_AI_CLIENTS,
  type AiAdvancedIconId,
  type AiClient,
  type AiClientIcon,
  type AiClientStatus,
  isAiBrandIcon,
} from "@/lib/mcp/aiClients";
import { MCP_SERVER_URL } from "@/lib/mcp/config";
import { cn } from "@/lib/utils";

const accountChangeSteps = [
  "Desconecte ou remova o Gastinho nas configurações de conectores do assistente.",
  "Saia da conta atual do Gastinho no navegador.",
  "Entre na conta do Gastinho que deseja conectar.",
  "Adicione ou vincule novamente o conector.",
  "Na tela de autorização, confira se está usando a conta correta antes de clicar em Aprovar.",
  "Abra uma nova conversa no assistente para evitar misturar informações de uma conversa anterior.",
];

const commandExamples = [
  "Gastei R$ 35 de gasolina hoje.",
  "Mostre meu resumo financeiro deste mês.",
  "Liste minhas despesas dos últimos sete dias.",
  "Adicione uma receita de R$ 500 recebida hoje.",
];

const privacyItems = [
  "O Gastinho não recebe a senha do assistente.",
  "O assistente não recebe a senha do Gastinho.",
  "A autorização utiliza OAuth.",
  "A conexão fica associada à conta do Gastinho que foi autenticada e aprovada.",
  "Confira a identidade e a conta do Gastinho antes de aprovar o acesso.",
  "Nunca envie senhas em conversas.",
];

const advancedIconById: Record<AiAdvancedIconId, LucideIcon> = {
  cursor: MousePointer2,
  github: Github,
};

const statusVariant: Record<
  AiClientStatus,
  "default" | "secondary" | "outline"
> = {
  tested: "default",
  supported: "secondary",
  restricted: "outline",
  unavailable: "outline",
  advanced: "secondary",
};

function copyWithFallback(text: string) {
  const textArea = document.createElement("textarea");
  const previouslyFocused = document.activeElement;

  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.inset = "0";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  try {
    if (!document.execCommand("copy")) {
      throw new Error("O navegador não permitiu copiar o link.");
    }
  } finally {
    document.body.removeChild(textArea);
    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    }
  }
}

function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground">
      {steps.map((step) => (
        <li key={step} className="pl-1">
          {step}
        </li>
      ))}
    </ol>
  );
}

function ClientIcon({
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

function ClientInstructions({ client }: { client: AiClient }) {
  return (
    <section
      id={`instructions-${client.id}`}
      aria-labelledby={`instructions-title-${client.id}`}
      className="space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ClientIcon icon={client.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-2">
          <h3
            id={`instructions-title-${client.id}`}
            className="text-lg font-semibold"
          >
            {client.panelTitle}
          </h3>
          <Badge variant={statusVariant[client.status]} className="whitespace-normal">
            {client.panelStatusLabel}
          </Badge>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {client.availability}
      </p>

      {client.instructionsDisplay === "collapsible" ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 w-full justify-between whitespace-normal py-2 text-left motion-reduce:transition-none [&[data-state=open]>svg]:rotate-180"
            >
              {client.instructionsTitle}
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-4 motion-reduce:animate-none">
            {client.instructionsIntro && (
              <p className="text-sm font-medium">{client.instructionsIntro}</p>
            )}
            <NumberedSteps steps={client.instructions} />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        client.instructions.length > 0 && (
          <NumberedSteps steps={client.instructions} />
        )
      )}

      {client.notes.map((note) => (
        <p
          key={note}
          className={cn(
            "rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed",
            client.status === "tested" && "border-primary/30 bg-primary/5",
          )}
        >
          {note}
        </p>
      ))}
    </section>
  );
}

function AdvancedClient({ client }: { client: AiClient }) {
  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "gastinho-simples": {
          url: MCP_SERVER_URL,
        },
      },
    },
    null,
    2,
  );

  return (
    <article className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <ClientIcon
          icon={client.icon}
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
        />
        <div className="min-w-0">
          <h3 className="font-semibold">{client.name}</h3>
          <Badge variant="secondary" className="mt-1">
            {client.statusLabel}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{client.availability}</p>
      <NumberedSteps steps={client.instructions} />
      {client.example === "mcp-server-json" && (
        <pre className="max-w-full whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-xs text-foreground">
          <code>{cursorConfig}</code>
        </pre>
      )}
      {client.notes.map((note) => (
        <p key={note} className="text-sm font-medium">
          {note}
        </p>
      ))}
    </article>
  );
}

export default function AiIntegrations() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const instructionsPanelRef = useRef<HTMLDivElement>(null);
  const selectedClient =
    CONSUMER_AI_CLIENTS.find((client) => client.id === selectedClientId) ?? null;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedClient || !instructionsPanelRef.current) return;

    const animationFrame = requestAnimationFrame(() => {
      const panel = instructionsPanelRef.current;
      if (!panel) return;

      const bounds = panel.getBoundingClientRect();
      const panelIsOutsideViewport =
        bounds.top < 0 || bounds.top > window.innerHeight * 0.75;

      if (panelIsOutsideViewport) {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        panel.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [selectedClient]);

  const handleCopy = async () => {
    try {
      let copiedWithClipboard = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(MCP_SERVER_URL);
          copiedWithClipboard = true;
        } catch {
          // Alguns navegadores expõem a API, mas bloqueiam seu uso.
        }
      }

      if (!copiedWithClipboard) {
        copyWithFallback(MCP_SERVER_URL);
      }

      setCopied(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);

      toast({
        title: "Link copiado",
        description: "O endereço do servidor MCP foi copiado.",
      });
    } catch {
      setCopied(false);
      toast({
        title: "Não foi possível copiar",
        description: "Selecione o link e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24">
      <main className="container mx-auto max-w-4xl space-y-4 p-3 sm:space-y-6 sm:p-4">
        <nav aria-label="Navegação da página">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/settings")}
            className="min-h-11 gap-2 px-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para Configurações
          </Button>
        </nav>

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold sm:text-3xl">Integrações com IA</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Conecte sua conta a um assistente compatível para registrar e consultar
            suas finanças por conversa.
          </p>
        </header>

        <Alert className="border-primary/40 bg-primary/5 p-3 sm:p-4">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <h2 className="mb-1 font-semibold text-foreground">Acesso protegido</h2>
            <p className="text-muted-foreground">
              Autorize somente a conta correta do Gastinho e nunca informe senhas
              em conversas. O acesso usa OAuth e depende da sua aprovação.
            </p>
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="space-y-2 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="font-semibold">Link do servidor MCP</h2>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                id="mcp-server-url"
                value={MCP_SERVER_URL}
                readOnly
                aria-label="Endereço do servidor MCP"
                aria-describedby="mcp-server-help"
                className="min-w-0 font-mono text-xs"
              />
              <Button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? "Link MCP copiado" : "Copiar link do servidor MCP"}
                className="min-h-11 w-full shrink-0 sm:w-auto"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
            </div>
            <p id="mcp-server-help" className="text-xs text-muted-foreground">
              O endereço é público; o acesso à conta exige autorização.
            </p>
            <p className="sr-only" role="status" aria-live="polite">
              {copied ? "Link do servidor MCP copiado para a área de transferência." : ""}
            </p>
          </CardContent>
        </Card>

        <section aria-labelledby="client-picker-title" className="space-y-3">
          <div>
            <h2 id="client-picker-title" className="text-lg font-semibold sm:text-xl">
              Escolha seu assistente
            </h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma opção para ver disponibilidade e instruções.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {CONSUMER_AI_CLIENTS.map((client) => {
              const isSelected = selectedClientId === client.id;

              return (
                <button
                  key={client.id}
                  type="button"
                  aria-expanded={isSelected}
                  aria-controls={`instructions-${client.id}`}
                  onClick={() =>
                    setSelectedClientId((current) =>
                      current === client.id ? null : client.id,
                    )
                  }
                  className={cn(
                    "relative flex min-h-28 min-w-0 flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors motion-reduce:transition-none",
                    "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected && "border-primary ring-1 ring-primary",
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <ClientIcon
                      icon={client.icon}
                      className="h-7 w-7 text-foreground lg:h-8 lg:w-8"
                    />
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Aberto</span>
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 text-sm font-semibold leading-tight">
                    {client.name}
                  </span>
                  <Badge
                    variant={statusVariant[client.status]}
                    className="mt-auto max-w-full whitespace-normal px-2 py-0.5 text-[10px] leading-tight"
                  >
                    {client.statusLabel}
                  </Badge>
                </button>
              );
            })}
          </div>

          {selectedClient && (
            <Card ref={instructionsPanelRef} className="scroll-mt-3">
              <CardContent className="p-4 sm:p-6">
                <ClientInstructions client={selectedClient} />
              </CardContent>
            </Card>
          )}
        </section>

        <section aria-labelledby="advanced-options-title">
          <h2 id="advanced-options-title" className="sr-only">
            Ferramentas para desenvolvedores
          </h2>
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="rounded-lg border px-4">
              <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
                <span className="flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Opções avançadas para desenvolvedores
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 motion-reduce:animate-none">
                {ADVANCED_AI_CLIENTS.map((client) => (
                  <AdvancedClient key={client.id} client={client} />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section aria-labelledby="more-information-title">
          <h2 id="more-information-title" className="sr-only">
            Mais informações
          </h2>
          <Accordion type="single" collapsible className="rounded-lg border px-4">
            <AccordionItem value="commands">
              <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
                <span className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Exemplos de comandos
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 motion-reduce:animate-none">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {commandExamples.map((example) => (
                    <li
                      key={example}
                      className="break-words rounded-lg bg-muted/50 p-3 text-sm"
                    >
                      “{example}”
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  O assistente pode solicitar dados ausentes, como forma de
                  pagamento, categoria ou cartão utilizado.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="another-account">
              <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
                <span className="flex items-center gap-2">
                  <UserRoundCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  Como conectar outra conta
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 motion-reduce:animate-none">
                <NumberedSteps steps={accountChangeSteps} />
                <p className="rounded-lg bg-muted/50 p-3 text-sm">
                  Remover o conector do assistente não exclui nenhum dado do Gastinho.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="disconnect">
              <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
                <span className="flex items-center gap-2">
                  <Unplug className="h-4 w-4 text-primary" aria-hidden="true" />
                  Como encerrar o acesso
                </span>
              </AccordionTrigger>
              <AccordionContent className="motion-reduce:animate-none">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Desconecte ou remova o Gastinho nas configurações do assistente.
                  Recursos adicionais de gerenciamento de autorizações poderão ser
                  disponibilizados futuramente.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="privacy" className="border-b-0">
              <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true" />
                  Privacidade e segurança
                </span>
              </AccordionTrigger>
              <AccordionContent className="motion-reduce:animate-none">
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
                  {privacyItems.map((item) => (
                    <li key={item} className="pl-1">
                      {item}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>

      <Footer />
    </div>
  );
}
