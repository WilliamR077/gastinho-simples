import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { SUBSCRIPTION_FEATURES } from "@/types/subscription";
import { Skeleton } from "@/components/ui/skeleton";

export default function Subscription() {
  const { tier, loading, features } = useSubscription();

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const plans = [
    {
      tier: "free" as const,
      icon: Sparkles,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
    },
    {
      tier: "no_ads" as const,
      icon: Zap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      tier: "premium" as const,
      icon: Crown,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      tier: "premium_plus" as const,
      icon: Crown,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      popular: true,
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Planos e Assinaturas</h1>
        <p className="text-muted-foreground">
          Escolha o plano ideal para suas necessidades
        </p>
        {tier !== "free" && (
          <Badge variant="secondary" className="text-sm">
            Plano Atual: {SUBSCRIPTION_FEATURES[tier].name}
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const planFeatures = SUBSCRIPTION_FEATURES[plan.tier];
          const Icon = plan.icon;
          const isCurrentPlan = tier === plan.tier;

          return (
            <Card 
              key={plan.tier}
              className={`relative ${isCurrentPlan ? "border-primary shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">
                    Mais Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className={`w-12 h-12 rounded-full ${plan.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${plan.color}`} />
                </div>
                <CardTitle>{planFeatures.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    {planFeatures.price.split("/")[0]}
                  </span>
                  {planFeatures.price.includes("/") && (
                    <span className="text-sm">/{planFeatures.price.split("/")[1]}</span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>
                      {planFeatures.cards === Infinity ? "Cartões ilimitados" : `Até ${planFeatures.cards} cartões`}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>
                      {planFeatures.goals === Infinity ? "Metas ilimitadas" : `Até ${planFeatures.goals} meta`}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${planFeatures.reports ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={planFeatures.reports ? "" : "text-muted-foreground"}>
                      {planFeatures.reports ? "Relatórios avançados" : "Relatórios básicos"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${planFeatures.exportPdf ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={planFeatures.exportPdf ? "" : "text-muted-foreground"}>
                      Exportar PDF
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${planFeatures.exportExcel ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={planFeatures.exportExcel ? "" : "text-muted-foreground"}>
                      Exportar Excel
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${!planFeatures.ads ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={!planFeatures.ads ? "" : "text-muted-foreground"}>
                      {planFeatures.ads ? "Com anúncios" : "Sem anúncios"}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" disabled>
                    Plano Atual
                  </Button>
                ) : (
                  <Button 
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.tier === "free" ? "Plano Gratuito" : "Fazer Upgrade"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Comparação de Recursos</CardTitle>
          <CardDescription>
            Veja todos os recursos disponíveis em cada plano
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>✅ <strong>Gratuito:</strong> Perfeito para começar a organizar suas finanças</p>
            <p>⚡ <strong>Sem Anúncios:</strong> Experiência sem interrupções por apenas R$ 4,90/mês</p>
            <p>👑 <strong>Premium:</strong> Recursos avançados para controle total (com anúncios)</p>
            <p>🌟 <strong>Premium Plus:</strong> Todos os recursos + experiência sem anúncios</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
