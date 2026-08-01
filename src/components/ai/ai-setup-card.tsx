import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCopyText } from "@/components/ai/use-copy-text";
import { MCP_SERVER_URL } from "@/lib/mcp/config";

const steps = [
  {
    title: "Copie o endereço",
    description: "Use este link para conectar o Gastinho à sua IA.",
  },
  {
    title: "Configure seu assistente",
    description: "Escolha abaixo o Claude ou outro assistente e siga o tutorial.",
  },
  {
    title: "Autorize e converse",
    description:
      "Autorize sua conta do Gastinho e envie um dos comandos de exemplo.",
  },
];

export function AiSetupCard() {
  const { copy, copiedKey } = useCopyText({
    successTitle: "Link copiado",
    successDescription: "O endereço do servidor MCP foi copiado.",
  });
  const copied = copiedKey === MCP_SERVER_URL;

  return (
    <Card>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-semibold">Comece em 3 passos</h2>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {index + 1}
              </span>
              <span className="min-w-0 leading-snug">
                <span className="block font-medium">{step.title}</span>
                <span className="block text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-2 rounded-lg border p-3">
          <p id="mcp-server-help" className="text-xs text-muted-foreground">
            Este é o endereço que conecta o Gastinho ao seu assistente de IA.
          </p>
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
              onClick={() => copy(MCP_SERVER_URL)}
              aria-label={
                copied ? "Link MCP copiado" : "Copiar link do servidor MCP"
              }
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
          <p className="text-xs text-muted-foreground">
            O endereço é público; o acesso à conta exige autorização.
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {copied
              ? "Link do servidor MCP copiado para a área de transferência."
              : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
