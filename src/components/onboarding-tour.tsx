import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Sparkles, Crown, Users, FileText, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function OnboardingTour() {
  const {
    isOpen,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    showCompletionDialog,
    skipOnboarding,
    skipCurrentStep,
    navigateToStep,
    closeCompletionDialog,
  } = useOnboardingTour();

  const navigate = useNavigate();

  if (!isOpen && !showCompletionDialog) return null;

  // Modal de conclusão do onboarding
  if (showCompletionDialog) {
    return (
      <Dialog open={showCompletionDialog} onOpenChange={closeCompletionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl">
              Parabéns! Você está pronto! 🎉
            </DialogTitle>
            <DialogDescription className="text-base">
              Você configurou sua conta com sucesso! Agora está tudo pronto para você
              ter controle total das suas finanças.
            </DialogDescription>
          </DialogHeader>

          {/* Lista de conquistas */}
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span>Cartões configurados</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span>Primeira despesa registrada</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span>Metas definidas</span>
            </div>
          </div>

          {/* CTA Premium */}
          <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Quer ainda mais recursos?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Com o <strong>Premium</strong> você ganha:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Grupos compartilhados
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Relatórios avançados
              </li>
              <li className="flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Exportação em PDF/Excel
              </li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={() => {
                closeCompletionDialog();
                navigate("/subscription");
              }}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Conhecer Premium
            </Button>
            <Button
              variant="outline"
              onClick={closeCompletionDialog}
              className="w-full"
            >
              Começar a usar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Modal do step atual
  if (!currentStep) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Passo {currentStepIndex + 1} de {totalSteps}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Emoji e título */}
          <div className="text-center space-y-3">
            <div className="text-5xl">{currentStep.emoji}</div>
            <DialogTitle className="text-xl">{currentStep.title}</DialogTitle>
            <DialogDescription className="text-base">
              {currentStep.description}
            </DialogDescription>
            {currentStep.exampleText && (
              <p className="text-sm text-muted-foreground italic">
                {currentStep.exampleText}
              </p>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {/* Botão principal */}
          {currentStep.action === "navigate" && (
            <Button onClick={navigateToStep} className="w-full" size="lg">
              {currentStep.targetRoute === "/cards"
                ? "Ir para Cartões"
                : currentStep.targetRoute === "/settings"
                ? "Ir para Configurações"
                : "Continuar"}
            </Button>
          )}

          {currentStep.action === "wait" && (
            <div className="w-full p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
              Aguardando você completar esta ação...
            </div>
          )}

          {/* Botões secundários */}
          <div className="flex gap-2 w-full">
            {currentStep.optional && (
              <Button
                variant="outline"
                onClick={skipCurrentStep}
                className="flex-1"
              >
                Pular
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={skipOnboarding}
              className="flex-1"
              size="sm"
            >
              Sair do tutorial
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
