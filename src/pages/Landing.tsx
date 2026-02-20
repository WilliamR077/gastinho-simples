import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import {
  Wallet,
  TrendingUp,
  BarChart3,
  Target,
  CreditCard,
  Users,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Controle de Despesas",
    description: "Registre e categorize todos os seus gastos de forma rápida e intuitiva.",
  },
  {
    icon: TrendingUp,
    title: "Entradas & Receitas",
    description: "Acompanhe suas fontes de renda e entradas recorrentes com facilidade.",
  },
  {
    icon: BarChart3,
    title: "Relatórios Detalhados",
    description: "Visualize gráficos e relatórios completos para entender seus hábitos financeiros.",
  },
  {
    icon: Target,
    title: "Metas de Gastos",
    description: "Defina limites por categoria e receba alertas quando estiver perto do limite.",
  },
  {
    icon: CreditCard,
    title: "Gerenciamento de Cartões",
    description: "Controle seus cartões de crédito e débito com fechamento e abertura personalizados.",
  },
  {
    icon: Users,
    title: "Grupos Compartilhados",
    description: "Divida despesas com familiares ou amigos em grupos compartilhados.",
  },
];

const plans = [
  {
    name: "Gratuito",
    price: "R$ 0",
    period: "/mês",
    description: "Para quem está começando",
    features: [
      "Controle de despesas e entradas",
      "Categorias personalizadas",
      "1 grupo compartilhado",
      "Relatórios básicos",
    ],
    highlight: false,
  },
  {
    name: "Premium",
    price: "R$ 9,90",
    period: "/mês",
    description: "Para controle financeiro completo",
    features: [
      "Tudo do plano gratuito",
      "Sem anúncios",
      "Grupos ilimitados",
      "Relatórios avançados",
      "Exportação PDF",
      "Metas de gastos",
    ],
    highlight: true,
  },
  {
    name: "Sem Anúncios",
    price: "R$ 4,90",
    period: "/mês",
    description: "Experiência limpa",
    features: [
      "Tudo do plano gratuito",
      "Sem anúncios",
      "Navegação mais rápida",
    ],
    highlight: false,
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-3xl space-y-6">
          <img
            src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
            alt="Gastinho Simples"
            className="mx-auto h-20 w-20 rounded-2xl shadow-lg"
          />
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Gastinho Simples
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Controle seus gastos de forma simples, rápida e gratuita. Organize suas finanças pessoais sem complicação.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              Começar Agora <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/about")}>
              Saiba Mais
            </Button>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-foreground">
              Tudo que você precisa para organizar suas finanças
            </h2>
            <p className="text-muted-foreground">
              Funcionalidades pensadas para simplificar o seu dia a dia financeiro.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50 transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-start gap-3 p-6">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-foreground">Planos & Preços</h2>
            <p className="text-muted-foreground">
              Escolha o plano ideal para o seu controle financeiro.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative transition-shadow hover:shadow-md ${
                  plan.highlight
                    ? "border-primary shadow-md ring-1 ring-primary/20"
                    : "border-border/50"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      <Sparkles className="h-3 w-3" /> Mais popular
                    </span>
                  </div>
                )}
                <CardContent className="flex flex-col gap-4 p-6 pt-8">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.highlight ? "default" : "outline"}
                    className="mt-auto w-full"
                    onClick={() => navigate("/auth")}
                  >
                    Começar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl font-bold text-foreground">
            Pronto para organizar suas finanças?
          </h2>
          <p className="text-muted-foreground">
            Crie sua conta gratuita e comece a controlar seus gastos agora mesmo.
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
            Criar Conta Grátis <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
