import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Footer } from "@/components/footer";
import {
  ArrowLeft,
  Download,
  Smartphone,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  Share2,
  Globe,
} from "lucide-react";

const socialLinks = [
  {
    icon: Instagram,
    label: "Instagram",
    url: "#",
    color: "hover:text-pink-500",
  },
  {
    icon: Twitter,
    label: "Twitter / X",
    url: "#",
    color: "hover:text-sky-500",
  },
  {
    icon: Youtube,
    label: "YouTube",
    url: "#",
    color: "hover:text-red-500",
  },
  {
    icon: Music2,
    label: "TikTok",
    url: "#",
    color: "hover:text-foreground",
  },
];

const pwaSteps = [
  "Abra o Safari no seu iPhone",
  "Acesse o site gastinho-simples.lovable.app",
  'Toque no ícone de compartilhar (quadrado com seta para cima)',
  'Role para baixo e toque em "Adicionar à Tela de Início"',
  'Toque em "Adicionar" no canto superior direito',
  "Pronto! O Gastinho Simples aparecerá como um app na sua tela inicial",
];

export default function Contact() {
  const navigate = useNavigate();
  const [pwaDialogOpen, setPwaDialogOpen] = useState(false);

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
            <h1 className="text-lg font-semibold text-foreground">Contato & Links</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-8 px-6 py-12">
        {/* Logo central */}
        <div className="text-center space-y-3">
          <img
            src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
            alt="Gastinho Simples"
            className="mx-auto h-20 w-20 rounded-2xl shadow-lg"
          />
          <h2 className="text-2xl font-bold text-foreground">Gastinho Simples</h2>
          <p className="text-muted-foreground">Controle seus gastos de forma simples</p>
        </div>

        {/* Download buttons */}
        <div className="space-y-3">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Baixe o App
          </h3>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <Button
                className="w-full gap-3 text-base"
                size="lg"
                onClick={() => window.open("#", "_blank")}
              >
                <Download className="h-5 w-5" />
                Baixar na Google Play Store
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Disponível para Android
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full gap-3 text-base"
                size="lg"
                onClick={() => setPwaDialogOpen(true)}
              >
                <Smartphone className="h-5 w-5" />
                Instalar no iPhone (PWA)
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Veja como instalar via Safari
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Redes sociais */}
        <div className="space-y-3">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Redes Sociais
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="border-border/50 transition-all hover:shadow-md hover:border-primary/30">
                  <CardContent className="flex items-center gap-3 p-4">
                    <link.icon className={`h-5 w-5 text-muted-foreground transition-colors ${link.color}`} />
                    <span className="font-medium text-foreground">{link.label}</span>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>

        {/* Site */}
        <div className="text-center">
          <a
            href="https://gastinho-simples.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Globe className="h-4 w-4" />
            gastinho-simples.lovable.app
          </a>
        </div>
      </div>

      {/* PWA Dialog */}
      <Dialog open={pwaDialogOpen} onOpenChange={setPwaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Instalar no iPhone
            </DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para adicionar o Gastinho Simples na tela inicial do seu iPhone.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 py-2">
            {pwaSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="text-sm text-foreground leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">
              💡 O app funciona como um aplicativo nativo depois de instalado!
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
