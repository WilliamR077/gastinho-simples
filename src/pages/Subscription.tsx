import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Zap, Smartphone, Wallet, BarChart3, FileDown, ArrowLeft, RefreshCw, Settings, AlertTriangle, Users } from "lucide-react";
import { SUBSCRIPTION_FEATURES } from "@/types/subscription";
import { Skeleton } from "@/components/ui/skeleton";
import { billingService, TIER_TO_PRODUCT_ID } from "@/services/billing-service";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Subscription() {
  const { tier, loading, features, refreshSubscription } = useSubscription();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();
  const navigate = useNavigate();

  // Buscar data de expiração da assinatura
  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('user_id', user.id)
        .single();

      if (data?.expires_at) {
        setExpiresAt(data.expires_at);
      }
    };

    fetchSubscriptionDetails();
  }, [tier]);

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
      const productId = TIER_TO_PRODUCT_ID[planTier];
      
      if (!productId) {
        toast({
          title: "Erro",
          description: "Plano não encontrado.",
          variant: "destructive",
        });
        return;
      }

      const success = await billingService.purchase(productId, planTier);
      
      if (success) {
        toast({
          title: "Assinatura ativada!",
          description: "Sua assinatura foi ativada com sucesso. Aproveite todos os recursos!",
        });
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
            title: "Compra cancelada",
            description: "A compra foi cancelada ou não foi possível processar.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua compra. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (!isNative) {
      toast({
        title: "Não disponível",
        description: "Restaurar compras disponível apenas no app Android.",
        variant: "destructive",
      });
      return;
    }

    setRestoring(true);

    try {
      const result = await billingService.restorePurchases();
      
      if (result.success && result.tier) {
        toast({
          title: "Compras restauradas!",
          description: `Sua assinatura ${SUBSCRIPTION_FEATURES[result.tier as keyof typeof SUBSCRIPTION_FEATURES]?.name || result.tier} foi restaurada.`,
        });
        await refreshSubscription();
      } else {
        toast({
          title: "Nenhuma compra encontrada",
          description: "Não encontramos assinaturas anteriores para restaurar.",
        });
      }
    } catch (error) {
      console.error('Erro ao restaurar compras:', error);
      toast({
        title: "Erro",
        description: "Não foi possível restaurar suas compras. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    billingService.openSubscriptionManagement();
    toast({
      title: "Gerenciar Assinatura",
      description: "Você será redirecionado para o Google Play para gerenciar sua assinatura.",
    });
  };

  const handleResetToFree = async () => {
    setResetting(true);

    try {
      const success = await billingService.resetToFree();
      
      if (success) {
        toast({
          title: "Assinatura resetada",
          description: "Sua assinatura foi alterada para o plano gratuito.",
        });
        await refreshSubscription();
        setExpiresAt(null);
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível resetar a assinatura.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao resetar assinatura:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao resetar sua assinatura.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const TIER_ORDER = ["free", "no_ads", "premium", "premium_plus"] as const;
  const currentTierIndex = TIER_ORDER.indexOf(tier);

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

  const renderPlanFeatures = (planTier: keyof typeof SUBSCRIPTION_FEATURES) => {
    const planFeatures = SUBSCRIPTION_FEATURES[planTier];
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{planFeatures.cards === Infinity ? "Cartões ilimitados" : `Até ${planFeatures.cards} cartões`}</span>
        </div>
        <div className="flex items-start gap-2">
          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{planFeatures.goals === Infinity ? "Metas ilimitadas" : `Até ${planFeatures.goals} meta`}</span>
        </div>
        <div className="flex items-start gap-2">
          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{planFeatures.reports ? "Relatórios: todos os períodos" : "Relatórios: mês atual"}</span>
        </div>
        {planFeatures.exportPdf && (
          <div className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Exportar PDF/Excel</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <span>{planFeatures.groups > 0 ? `Criar até ${planFeatures.groups} grupos` : "Participar de grupos"}</span>
        </div>
        <div className="flex items-start gap-2">
          {planFeatures.ads ? (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-amber-500">Com anúncios</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Sem anúncios</span>
            </>
          )}
        </div>
      </div>
    );
  };

  // ========== VISÃO PARA USUÁRIOS COM PLANO PAGO ==========
  if (tier !== "free") {
    const currentPlan = plans.find(p => p.tier === tier)!;
    const currentFeatures = SUBSCRIPTION_FEATURES[tier];
    const CurrentIcon = currentPlan.icon;
    const upgradePlans = plans.filter(p => TIER_ORDER.indexOf(p.tier) > currentTierIndex);

    return (
      <div className="container mx-auto p-6 space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          {isNative && (
            <Button 
              variant="outline" 
              onClick={handleRestorePurchases}
              disabled={restoring}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${restoring ? 'animate-spin' : ''}`} />
              {restoring ? 'Restaurando...' : 'Restaurar Compras'}
            </Button>
          )}
        </div>

        {/* Título */}
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-3xl font-bold">Sua Assinatura</h1>
          <p className="text-muted-foreground">Gerencie seu plano atual</p>
        </div>

        {/* Card do plano atual */}
        <Card className="border-primary shadow-lg">
          <CardHeader className="text-center">
            <div className={`w-16 h-16 rounded-full ${currentPlan.bgColor} flex items-center justify-center mx-auto mb-4`}>
              <CurrentIcon className={`h-8 w-8 ${currentPlan.color}`} />
            </div>
            <Badge className="mx-auto mb-2">Plano Atual</Badge>
            <CardTitle className="text-2xl">{currentFeatures.name}</CardTitle>
            <CardDescription>
              <span className="text-3xl font-bold text-foreground">
                {currentFeatures.price.split("/")[0]}
              </span>
              {currentFeatures.price.includes("/") && (
                <span className="text-sm">/{currentFeatures.price.split("/")[1]}</span>
              )}
            </CardDescription>
            {expiresAt && (
              <p className="text-sm text-muted-foreground mt-2">
                Válido até: {formatDate(expiresAt)}
              </p>
            )}
          </CardHeader>

          <CardContent>
            {renderPlanFeatures(tier)}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={handleManageSubscription}
            >
              <Settings className="h-4 w-4" />
              Gerenciar no Google Play
            </Button>
          </CardFooter>
        </Card>

        {/* Planos superiores para upgrade */}
        {upgradePlans.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center">Fazer Upgrade</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {upgradePlans.map((plan) => {
                const planFeatures = SUBSCRIPTION_FEATURES[plan.tier];
                const Icon = plan.icon;

                return (
                  <Card key={plan.tier} className="relative">
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
                    <CardContent>
                      {renderPlanFeatures(plan.tier)}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full gap-2"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handlePurchase(plan.tier)}
                        disabled={purchasing !== null || !isNative}
                      >
                        {purchasing === plan.tier ? (
                          "Processando..."
                        ) : !isNative ? (
                          "Disponível no App"
                        ) : (
                          "Fazer Upgrade 🚀"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Google Play */}
        {isNative && (
          <Card className="border-primary/20 bg-primary/5">
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
      </div>
    );
  }

  // ========== VISÃO PARA USUÁRIOS GRATUITOS ==========
  return (
    <div className="container mx-auto p-6 space-y-6 pb-20">
      {/* Header com botão voltar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {isNative && (
          <Button 
            variant="outline" 
            onClick={handleRestorePurchases}
            disabled={restoring}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${restoring ? 'animate-spin' : ''}`} />
            {restoring ? 'Restaurando...' : 'Restaurar Compras'}
          </Button>
        )}
      </div>

      {/* Título e descrição */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl font-bold">Planos e Assinaturas</h1>
        <p className="text-muted-foreground">
          Escolha o plano ideal para suas necessidades
        </p>
      </div>

      {/* Seção: Por que fazer upgrade? */}
      <Card className="mb-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Por que fazer upgrade?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <Wallet className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Controle Total</h4>
              <p className="text-sm text-muted-foreground">
                Cartões e metas ilimitadas para organizar suas finanças do seu jeito
              </p>
            </div>
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Todos os Períodos</h4>
              <p className="text-sm text-muted-foreground">
                Veja relatórios por trimestre, semestre ou ano inteiro
              </p>
            </div>
            <div className="text-center">
              <FileDown className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Seus Dados, Seu Controle</h4>
              <p className="text-sm text-muted-foreground">
                Exporte para PDF ou Excel e use em qualquer ferramenta
              </p>
            </div>
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold mb-2">Grupos Compartilhados</h4>
              <p className="text-sm text-muted-foreground">
                Crie grupos para dividir gastos com família, amigos ou viagens
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const planFeatures = SUBSCRIPTION_FEATURES[plan.tier];
          const Icon = plan.icon;

          return (
            <Card 
              key={plan.tier}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
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
                {renderPlanFeatures(plan.tier)}
              </CardContent>

              <CardFooter>
                {plan.tier === "free" ? (
                  <Button className="w-full" variant="outline" disabled>
                    Plano Atual
                  </Button>
                ) : (
                  <Button 
                    className="w-full gap-2"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handlePurchase(plan.tier)}
                    disabled={purchasing !== null || !isNative}
                  >
                    {purchasing === plan.tier ? (
                      "Processando..."
                    ) : !isNative ? (
                      "Disponível no App"
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
            <p>✅ <strong>Gratuito:</strong> Perfeito para começar • Relatórios do mês • Participar de grupos</p>
            <p>⚡ <strong>Sem Anúncios:</strong> Experiência sem interrupções • Relatórios do mês • Participar de grupos</p>
            <p>👑 <strong>Premium:</strong> Todos os períodos • Criar até 3 grupos • Exportar PDF/Excel</p>
            <p>🌟 <strong>Premium Plus:</strong> Tudo do Premium + sem anúncios</p>
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
