import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import {
  Heart,
  Shield,
  Zap,
  Globe,
  ArrowLeft,
  Wallet,
  BarChart3,
  Target,
  CreditCard,
  Users,
  Bell,
  FileText,
} from "lucide-react";

const values = [
  {
    icon: Zap,
    title: "Simplicidade",
    description: "Interface intuitiva e fácil de usar. Sem complicações, sem burocracia.",
  },
  {
    icon: Shield,
    title: "Transparência",
    description: "Seus dados são seus. Segurança e privacidade são prioridades absolutas.",
  },
  {
    icon: Heart,
    title: "Acessibilidade",
    description: "Ferramentas financeiras acessíveis para todos, com plano gratuito completo.",
  },
];

const offerings = [
  { icon: Wallet, text: "Controle completo de despesas e entradas" },
  { icon: BarChart3, text: "Relatórios e gráficos detalhados" },
  { icon: Target, text: "Metas de gastos por categoria" },
  { icon: CreditCard, text: "Gerenciamento de cartões de crédito e débito" },
  { icon: Users, text: "Grupos compartilhados para dividir despesas" },
  { icon: Bell, text: "Lembretes de despesas recorrentes" },
  { icon: FileText, text: "Exportação de relatórios em PDF" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/landing")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img
              src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
              alt="Gastinho Simples"
              className="h-8 w-8 rounded-lg"
            />
            <h1 className="text-lg font-semibold text-foreground">Sobre o Gastinho Simples</h1>
          </div>
        </div>
      </header>

      {/* Missão */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-3xl font-bold text-foreground">Nossa Missão</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Ajudar as pessoas a terem <span className="font-semibold text-foreground">controle financeiro de forma simples e acessível</span>. 
            Acreditamos que organizar as finanças não precisa ser complicado — e que todos merecem 
            ferramentas práticas para cuidar melhor do seu dinheiro.
          </p>
        </div>
      </section>

      {/* Feito no Brasil */}
      <section className="bg-muted/30 px-6 py-12">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Feito no Brasil 🇧🇷</span>
          </div>
          <p className="text-muted-foreground">
            O Gastinho Simples é um aplicativo brasileiro, pensado para a realidade financeira do dia a dia do brasileiro. 
            Tudo em português, com categorias e funcionalidades que fazem sentido para você.
          </p>
        </div>
      </section>

      {/* Valores */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl space-y-10">
          <h2 className="text-center text-3xl font-bold text-foreground">Nossos Valores</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {values.map((v) => (
              <Card key={v.title} className="border-border/50">
                <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <v.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* O que oferecemos */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="text-center text-3xl font-bold text-foreground">O que Oferecemos</h2>
          <div className="space-y-4">
            {offerings.map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Quer experimentar?</h2>
          <p className="text-muted-foreground">
            Crie sua conta gratuitamente e comece a organizar suas finanças hoje.
          </p>
          <Button size="lg" onClick={() => navigate("/auth")}>
            Criar Conta Grátis
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
