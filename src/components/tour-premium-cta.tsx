import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Check, X, Sparkles, BarChart3, Download, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourPremiumCtaProps {
  isVisible: boolean;
  onClose: () => void;
}

const premiumFeatures = [
  {
    icon: BarChart3,
    title: "Relatórios em todos os períodos",
    description: "Veja trimestre, semestre e ano inteiro. Gráficos mensais já são gratuitos!",
  },
  {
    icon: Download,
    title: "Exportar PDF e Excel",
    description: "Baixe seus dados para usar em qualquer lugar",
  },
  {
    icon: Users,
    title: "Crie grupos compartilhados",
    description: "Crie até 3 grupos para dividir gastos. Todos podem participar!",
  },
  {
    icon: Wallet,
    title: "Cartões e metas ilimitados",
    description: "Organize suas finanças sem limites",
  },
];

export function TourPremiumCta({ isVisible, onClose }: TourPremiumCtaProps) {
  const navigate = useNavigate();

  if (!isVisible) return null;

  const handleSubscribe = () => {
    onClose();
    navigate("/subscription");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80">
      <div
        className={cn(
          "relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-300"
        )}
      >
        {/* Gradient background decoration */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
        
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-8 w-8 z-10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Content */}
        <div className="relative p-6 pt-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">Aproveite ao máximo! 🚀</h2>
              <p className="text-muted-foreground">
                Desbloqueie recursos exclusivos com o Premium
              </p>
            </div>
          </div>

          {/* Features list */}
          <div className="space-y-3">
            {premiumFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
                <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleSubscribe}
              className="w-full h-12 text-base font-semibold gap-2"
              size="lg"
            >
              <Sparkles className="h-5 w-5" />
              Assinar agora
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full text-muted-foreground"
            >
              Talvez depois
            </Button>
          </div>

          {/* Bottom note */}
          <p className="text-center text-xs text-muted-foreground">
            Cancele quando quiser. Sem compromisso.
          </p>
        </div>
      </div>
    </div>
  );
}
