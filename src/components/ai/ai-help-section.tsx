import { LockKeyhole, MousePointer2, Unplug, UserRoundCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AdvancedClient,
  NumberedSteps,
} from "@/components/ai/ai-client-instructions";
import { ADVANCED_AI_CLIENTS } from "@/lib/mcp/aiClients";

const accountChangeSteps = [
  "Desconecte ou remova o Gastinho nas configurações de conectores do assistente.",
  "Saia da conta atual do Gastinho no navegador.",
  "Entre na conta do Gastinho que deseja conectar.",
  "Adicione ou vincule novamente o conector.",
  "Na tela de autorização, confira se está usando a conta correta antes de clicar em Aprovar.",
  "Abra uma nova conversa no assistente para evitar misturar informações de uma conversa anterior.",
];

const privacyItems = [
  "O Gastinho não recebe a senha do assistente.",
  "O assistente não recebe a senha do Gastinho.",
  "A autorização utiliza OAuth.",
  "A conexão fica associada à conta do Gastinho que foi autenticada e aprovada.",
  "Confira a identidade e a conta do Gastinho antes de aprovar o acesso.",
  "Nunca envie senhas em conversas.",
];

export function AiHelpSection() {
  return (
    <section aria-labelledby="help-title" className="space-y-2">
      <h2 id="help-title" className="text-lg font-semibold">
        Ajuda e controle
      </h2>

      <Accordion type="single" collapsible className="rounded-lg border px-4">
        <AccordionItem value="another-account">
          <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
            <span className="flex items-center gap-2">
              <UserRoundCheck
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              Conectar outra conta
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 motion-reduce:animate-none">
            <NumberedSteps steps={accountChangeSteps} />
            <p className="rounded-lg bg-muted/50 p-3 text-sm">
              Remover o conector do assistente não exclui nenhum dado do
              Gastinho.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="disconnect">
          <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
            <span className="flex items-center gap-2">
              <Unplug
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              Encerrar o acesso
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

        <AccordionItem value="advanced" className="border-b-0">
          <AccordionTrigger className="min-h-12 gap-3 text-left hover:no-underline">
            <span className="flex items-center gap-2">
              <MousePointer2
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              Opções avançadas
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 motion-reduce:animate-none">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                Ferramentas para desenvolvedores
              </h3>
              {ADVANCED_AI_CLIENTS.map((client) => (
                <AdvancedClient key={client.id} client={client} />
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                Privacidade e segurança
              </h3>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
                {privacyItems.map((item) => (
                  <li key={item} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
