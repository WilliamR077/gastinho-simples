import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/footer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-6 max-w-4xl flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img
            src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
            alt="Gastinho Simples"
            className="h-8 w-8 rounded-lg"
          />
          <h1 className="text-lg font-semibold text-foreground">Política de Privacidade</h1>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-8">
            <div>
              <p className="text-sm text-muted-foreground">
                <strong>Última atualização: {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                Esta Política de Privacidade explica como o aplicativo e site <strong>Gastinho
                Simples</strong> (doravante "App" ou "nós") coleta, usa, armazena e compartilha os
                dados dos usuários. Ao usar o App, você concorda com as práticas descritas nesta
                política.
              </p>
            </div>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Quem é o controlador dos dados</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nome do serviço: <strong className="text-foreground">Gastinho Simples</strong><br />
                Site / domínio: <strong className="text-foreground">https://gastinho-simples.lovable.app</strong><br />
                Contato: <strong className="text-foreground">gastinhosimples@gmail.com</strong>
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. Quais dados coletamos</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>E-mail e senha (armazenada de forma segura e criptografada) para autenticação.</li>
                <li>Dados financeiros inseridos voluntariamente: despesas com descrição, valor, método de pagamento (débito, crédito, PIX), parcelas e notas.</li>
                <li>Configurações como dia de fechamento da fatura e filtros.</li>
                <li>Identificadores técnicos e dados mínimos de diagnóstico (quando habilitado).</li>
                <li><strong className="text-foreground">Logs de auditoria:</strong> Registramos ações críticas (login, alteração de senha/email, exclusão de dados) incluindo data/hora e agente de usuário (navegador) para fins de segurança e conformidade com a LGPD.</li>
              </ul>
              <div className="mt-3">
                <h3 className="text-sm font-medium text-foreground">Cookies e armazenamento local</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Utilizamos armazenamento local do navegador (localStorage) para manter sua sessão ativa
                  e preferências de tema. Não utilizamos cookies de terceiros para rastreamento. Os dados
                  armazenados localmente incluem apenas tokens de autenticação e configurações de interface.
                </p>
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Como usamos os dados</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>Para autenticar sua conta e permitir o uso do App.</li>
                <li>Para armazenar, exibir e organizar suas despesas.</li>
                <li>Para calcular o fechamento de faturas conforme sua configuração.</li>
                <li>Para melhorar a estabilidade e corrigir erros.</li>
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Base legal</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tratamos seus dados com base em consentimento, execução de contrato (uso do App) e
                cumprimento de obrigações legais, conforme a LGPD.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Compartilhamento de dados</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">Compartilhamos dados apenas com:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">Supabase</strong>, que armazena seu e-mail, senha e despesas de forma segura.</li>
                <li><strong className="text-foreground">Google AdMob</strong>, se anúncios estiverem ativos. Nesse caso, pode coletar identificadores de publicidade.</li>
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">6. Segurança</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Adotamos medidas técnicas e organizacionais para proteger seus dados. No entanto,
                nenhum método de transmissão ou armazenamento é 100% seguro.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">7. Retenção de dados</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Mantemos seus dados enquanto sua conta existir. Ao excluir a conta, todos os dados
                pessoais e financeiros associados serão removidos em até 30 dias.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Dados de auditoria:</strong> Registramos ações críticas (login, alterações de senha,
                exclusão de dados) em logs de auditoria para fins de segurança. Esses logs são mantidos
                por até 90 dias após a exclusão da conta.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">8. Seus direitos</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Você tem direito de acessar, corrigir, excluir, limitar o uso ou solicitar
                portabilidade dos seus dados. Para exercer, entre em contato em
                <strong className="text-foreground"> gastinhosimples@gmail.com</strong>.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">9. Exclusão da conta e dos dados</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Pelo App, em <em>Minha Conta</em>, você tem duas opções:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li><strong className="text-foreground">Limpar dados:</strong> Remove todos os gastos, despesas recorrentes e configurações, mas mantém sua conta ativa para continuar usando o sistema.</li>
                <li><strong className="text-foreground">Excluir conta permanentemente:</strong> Remove todos os dados e encerra sua conta de acesso. Esta ação é irreversível.</li>
              </ul>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Processo de exclusão de dados:</strong> Quando você solicita a exclusão da conta,
                todos os dados financeiros são removidos imediatamente. Os logs de auditoria são mantidos
                por até 90 dias para conformidade com a LGPD. Para excluir completamente os dados de
                autenticação do Supabase, entre em contato com <strong className="text-foreground">gastinhosimples@gmail.com</strong>.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">10. Alterações nesta Política</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Podemos atualizar esta Política periodicamente. Publicaremos a nova versão nesta
                página com a data de atualização revisada.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">11. Contato</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Dúvidas? Entre em contato pelo e-mail: <strong className="text-foreground">gastinhosimples@gmail.com</strong>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>

      <Footer isAuthenticated={false} />
    </div>
  );
}
