import { ReactNode } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Lock, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface PremiumGuardProps {
  children: ReactNode;
  feature: "cards" | "goals" | "reports" | "exportPdf" | "exportExcel";
  currentCount?: number;
  fallback?: ReactNode;
}

export function PremiumGuard({ 
  children, 
  feature, 
  currentCount = 0,
  fallback 
}: PremiumGuardProps) {
  const { canAddCard, canAddGoal, hasAdvancedReports, canExportPdf, canExportExcel, tier } = useSubscription();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);

  const checkAccess = () => {
    switch (feature) {
      case "cards":
        return canAddCard(currentCount);
      case "goals":
        return canAddGoal(currentCount);
      case "reports":
        return hasAdvancedReports;
      case "exportPdf":
        return canExportPdf;
      case "exportExcel":
        return canExportExcel;
      default:
        return false;
    }
  };

  const getFeatureName = () => {
    switch (feature) {
      case "cards":
        return "adicionar mais cartões";
      case "goals":
        return "adicionar mais metas";
      case "reports":
        return "acessar relatórios avançados";
      case "exportPdf":
        return "exportar para PDF";
      case "exportExcel":
        return "exportar para Excel";
      default:
        return "acessar este recurso";
    }
  };

  const hasAccess = checkAccess();

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <div className="relative">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <Button
            onClick={() => setShowDialog(true)}
            variant="default"
            size="lg"
            className="gap-2"
          >
            <Crown className="h-5 w-5" />
            Fazer Upgrade
          </Button>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Que ótimo que você quer {getFeatureName()}! 🎉
            </DialogTitle>
            <DialogDescription>
              Esse recurso está disponível nos planos Premium e Premium Plus.
              Faça upgrade para desbloquear todo o potencial do Gastinho Simples!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Seu plano atual: <span className="font-semibold text-foreground">{tier === "free" ? "Gratuito" : tier}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              setShowDialog(false);
              navigate("/subscription");
            }}>
              Ver Planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
