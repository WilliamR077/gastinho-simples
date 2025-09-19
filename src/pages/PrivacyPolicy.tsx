import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
              alt="Gastinho Simples - Controle de Gastos"
              className="h-20 w-auto"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/account")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Minha Conta</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/auth")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Privacy Policy Content */}
        <div className="prose dark:prose-invert max-w-none">
          <h1>Política de Privacidade — Gastinho Simples</h1>
          <p><strong>Última atualização: 18 de setembro de 2025</strong></p>

          <p>
            Esta Política de Privacidade explica como o aplicativo e site <strong>Gastinho
            Simples</strong> (doravante "App" ou "nós") coleta, usa, armazena e compartilha os
            dados dos usuários. Ao usar o App, você concorda com as práticas descritas nesta
            política.
          </p>

          <h2>1. Quem é o controlador dos dados</h2>
          <p>
            Nome do serviço: <strong>Gastinho Simples</strong><br />
            Site / domínio: <strong>https://seudominio.com</strong><br />
            Contato: <strong>seu.email@seudominio.com</strong>
          </p>

          <h2>2. Quais dados coletamos</h2>
          <ul>
            <li>E-mail e senha (armazenada de forma segura) para autenticação.</li>
            <li>Dados financeiros inseridos voluntariamente: despesas com descrição, valor,
                método de pagamento (débito, crédito, PIX), parcelas e notas.</li>
            <li>Configurações como dia de fechamento da fatura e filtros.</li>
            <li>Identificadores técnicos e dados mínimos de diagnóstico (quando habilitado).
            </li>
          </ul>

          <h2>3. Como usamos os dados</h2>
          <ul>
            <li>Para autenticar sua conta e permitir o uso do App.</li>
            <li>Para armazenar, exibir e organizar suas despesas.</li>
            <li>Para calcular o fechamento de faturas conforme sua configuração.</li>
            <li>Para melhorar a estabilidade e corrigir erros.</li>
          </ul>

          <h2>4. Base legal</h2>
          <p>
            Tratamos seus dados com base em consentimento, execução de contrato (uso do App) e
            cumprimento de obrigações legais, conforme a LGPD.
          </p>

          <h2>5. Compartilhamento de dados</h2>
          <p>Compartilhamos dados apenas com:</p>
          <ul>
            <li><strong>Supabase</strong>, que armazena seu e-mail, senha e despesas de forma
                segura.</li>
            <li><strong>Google AdMob</strong>, se anúncios estiverem ativos. Nesse caso, pode
                coletar identificadores de publicidade.</li>
          </ul>

          <h2>6. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados. No entanto,
            nenhum método de transmissão ou armazenamento é 100% seguro.
          </p>

          <h2>7. Retenção de dados</h2>
          <p>
            Mantemos seus dados enquanto sua conta existir. Ao excluir a conta, todos os dados
            pessoais e financeiros associados serão removidos em até 30 dias.
          </p>

          <h2>8. Seus direitos</h2>
          <p>
            Você tem direito de acessar, corrigir, excluir, limitar o uso ou solicitar
            portabilidade dos seus dados. Para exercer, entre em contato em
            <strong> seu.email@seudominio.com</strong>.
          </p>

          <h2>9. Exclusão da conta</h2>
          <p>
            Pelo App, em <em>Minha Conta</em>, você pode excluir sua conta e todos os dados
            associados de forma permanente.
          </p>

          <h2>10. Alterações nesta Política</h2>
          <p>
            Podemos atualizar esta Política periodicamente. Publicaremos a nova versão nesta
            página com a data de atualização revisada.
          </p>

          <h2>11. Contato</h2>
          <p>
            Dúvidas? Entre em contato pelo e-mail: <strong>seu.email@seudominio.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
