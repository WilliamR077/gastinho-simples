import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Zap, Smartphone, Wallet, BarChart3, FileDown } from "lucide-react";
import { SUBSCRIPTION_FEATURES } from "@/types/subscription";
import { Skeleton } from "@/components/ui/skeleton";
import { billingService } from "@/services/billing-service";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";

export default function Subscription() {
  const { tier, loading, features, refreshSubscription } = useSubscription();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

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

  const handlePurchase = async (planTier: string) => {
    setPurchasing(planTier);

    try {
      const success = await billingService.purchase('', planTier);
      
      if (success) {
        toast({
          title: "Assinatura ativada!",
          description: "Sua assinatura foi ativada com sucesso. Aproveite todos os recursos premium!",
        });
        
        // Atualizar estado da assinatura
        await refreshSubscription();
      } else {
        if (!isNative) {
          toast({
            title: "Compra via web",
            description: "Sistema de pagamento web em desenvolvimento. Use o app Android para realizar compras.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro na compra",
            description: "Não foi possível processar sua compra. Tente novamente.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua compra.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

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
      <div className="text-center space-y-2 mb-6">
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

      {/* Seção: Por que fazer upgrade? */}
      <Card className="mb-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Por que fazer upgrade?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <Wallet className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Controle Total</h4>
              <p className="text-sm text-muted-foreground">
                Cartões e metas ilimitadas para organizar suas finanças do seu jeito
              </p>
            </div>
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Insights Poderosos</h4>
              <p className="text-sm text-muted-foreground">
                Relatórios avançados para identificar padrões e economizar mais
              </p>
            </div>
            <div className="text-center">
              <FileDown className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Seus Dados, Seu Controle</h4>
              <p className="text-sm text-muted-foreground">
                Exporte para Excel ou PDF e use em qualquer ferramenta
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                ) : plan.tier === "free" ? (
                  <Button className="w-full" variant="outline" disabled>
                    Plano Gratuito
                  </Button>
                ) : (
                  <Button 
                    className="w-full gap-2"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handlePurchase(plan.tier)}
                    disabled={purchasing !== null}
                  >
                    {purchasing === plan.tier ? (
                      "Processando..."
                    ) : (
                      <>
                        {plan.tier === "no_ads" && "Remover Anúncios 🎯"}
                        {plan.tier === "premium" && "Desbloquear Premium 🚀"}
                        {plan.tier === "premium_plus" && "Ter Acesso Completo ⭐"}
                      </>
                    )}
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
            <p>⚡ <strong>Sem Anúncios (R$ 4,90/mês):</strong> Experiência sem interrupções</p>
            <p>👑 <strong>Premium (R$ 14,90/mês):</strong> Recursos avançados para controle total</p>
            <p>🌟 <strong>Premium Plus (R$ 17,90/mês):</strong> Todos os recursos + sem anúncios</p>
          </div>
        </CardContent>
      </Card>

      {isNative && (
        <Card className="mt-4 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-1">Compra Segura via Google Play</p>
                <p className="text-muted-foreground">
                  Todas as compras são processadas pelo Google Play Store com segurança total. 
                  Gerencie suas assinaturas diretamente nas configurações do Google Play.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isNative && (
        <Card className="mt-4 border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="text-sm text-center">
              <p className="font-semibold text-foreground mb-2">💡 Dica</p>
              <p className="text-muted-foreground">
                Para realizar compras, use o aplicativo Android. 
                Sistema de pagamento web em desenvolvimento.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
