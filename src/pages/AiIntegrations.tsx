import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Link2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Unplug,
  UserRoundCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/footer";
import { toast } from "@/hooks/use-toast";
import { MCP_SERVER_URL } from "@/lib/mcp/config";

const claudeSteps = [
  "Abra o Claude.",
  "Entre em Configurações.",
  "Abra Personalizar e depois Conectores.",
  "Escolha adicionar um conector personalizado.",
  "Use o nome “Gastinho Simples”.",
  "Cole o link disponibilizado nesta página.",
  "Clique em adicionar ou vincular.",
  "Entre na sua conta do Gastinho.",
  "Confira se você está usando a conta correta.",
  "Leia a tela de autorização e clique em Aprovar.",
  "Volte ao Claude, abra uma nova conversa e habilite o conector Gastinho Simples.",
];

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
  "Confira a conta do Gastinho antes de aprovar o acesso.",
  "Você pode remover ou desconectar o conector nas configurações do assistente.",
  "Nunca envie senhas em conversas.",
];

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

export default function AiIntegrations() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

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
      <main className="container mx-auto max-w-4xl space-y-6 p-4">
        <nav aria-label="Navegação da página">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/settings")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para Configurações
          </Button>
        </nav>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Bot className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-bold">
              Conecte o Gastinho ao seu assistente de IA
            </h1>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            Registre despesas, consulte receitas e acompanhe seu resumo financeiro
            conversando com um assistente compatível. Você continuará no controle e
            precisará autorizar o acesso à sua conta.
          </p>
          <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Integração em fase de testes
          </span>
        </header>

        <Alert className="border-primary/40 bg-primary/5">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <h2 className="mb-1 font-semibold text-foreground">Acesso protegido</h2>
            <div className="space-y-2 text-muted-foreground">
              <p>
                O assistente só poderá acessar os dados da conta do Gastinho que você
                autorizar. Nunca informe sua senha diretamente em uma conversa com o
                assistente.
              </p>
              <p>
                Antes de aprovar a conexão, confira se você está conectado à conta
                correta do Gastinho.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <Link2 className="h-5 w-5" aria-hidden="true" />
              Link do servidor MCP
            </CardTitle>
            <CardDescription>
              Use este endereço ao adicionar o Gastinho como conector personalizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label htmlFor="mcp-server-url" className="text-sm font-medium">
              Endereço do servidor
            </label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                id="mcp-server-url"
                value={MCP_SERVER_URL}
                readOnly
                aria-describedby="mcp-server-help"
                className="min-w-0 font-mono text-xs"
              />
              <Button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? "Link MCP copiado" : "Copiar link do servidor MCP"}
                className="w-full shrink-0 sm:w-auto"
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
              O endereço é público e o acesso à sua conta é protegido por autorização.
            </p>
            <p className="sr-only" role="status" aria-live="polite">
              {copied ? "Link do servidor MCP copiado para a área de transferência." : ""}
            </p>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              Como conectar ao Claude
            </CardTitle>
            <CardDescription>
              Siga estes passos nas configurações de conectores do Claude.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground">
              {claudeSteps.map((step) => (
                <li key={step} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              Exemplos de comandos
            </CardTitle>
            <CardDescription>
              Exemplos de como iniciar uma conversa sobre suas finanças.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {commandExamples.map((example) => (
                <li
                  key={example}
                  className="min-w-0 break-words rounded-lg border border-border bg-muted/40 p-3 text-sm"
                >
                  “{example}”
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              O assistente poderá solicitar informações que estejam faltando, como
              forma de pagamento, categoria ou cartão utilizado.
            </p>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <UserRoundCheck className="h-5 w-5" aria-hidden="true" />
              Como conectar outra conta
            </CardTitle>
            <CardDescription>
              Troque a conta conectada com atenção antes de autorizar novamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground">
              {accountChangeSteps.map((step) => (
                <li key={step} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
            <p className="rounded-lg bg-muted p-3 text-sm">
              Remover o conector do assistente não exclui nenhum dado do Gastinho.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <Unplug className="h-5 w-5" aria-hidden="true" />
              Como encerrar o acesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Para parar de usar a integração, remova ou desconecte o Gastinho nas
              configurações de conectores do assistente.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <Bot className="h-5 w-5" aria-hidden="true" />
              Outros clientes MCP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O mesmo endereço pode ser utilizado em outros assistentes compatíveis
              com servidores MCP remotos. A disponibilidade depende do aplicativo,
              da versão e do plano utilizado pelo usuário.
            </p>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-xl"
            >
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              Privacidade e controle
            </CardTitle>
            <CardDescription>
              Entenda quais cuidados tomar durante a conexão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
              {privacyItems.map((item) => (
                <li key={item} className="pl-1">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
