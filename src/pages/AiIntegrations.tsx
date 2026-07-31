import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { AiSecurityNotice } from "@/components/ai/ai-security-notice";
import { AiSetupCard } from "@/components/ai/ai-setup-card";
import { AiAssistantCarousel } from "@/components/ai/ai-assistant-carousel";
import { AiCommandExamples } from "@/components/ai/ai-command-examples";
import { AiHelpSection } from "@/components/ai/ai-help-section";

export default function AiIntegrations() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24">
      <main className="container mx-auto max-w-2xl space-y-4 p-3 sm:p-4">
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

        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold sm:text-2xl">
              Conecte sua IA ao Gastinho
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Consulte, registre e organize suas finanças conversando com seu
            assistente.
          </p>
        </header>

        <AiSecurityNotice />
        <AiSetupCard />
        <AiAssistantCarousel />
        <AiCommandExamples />
        <AiHelpSection />
      </main>

      <Footer />
    </div>
  );
}
