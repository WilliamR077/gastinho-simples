import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export const Footer = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: "Início", path: "/" },
    { label: "Relatórios", path: "/reports" },
    { label: "Cartões", path: "/cards" },
  ];

  const accountLinks = [
    { label: "Minha Conta", path: "/account" },
    { label: "Assinatura", path: "/subscription" },
    { label: "Configurações", path: "/settings" },
  ];

  return (
    <footer className="border-t border-border bg-muted/30 px-6 pt-10 pb-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Logo & tagline */}
        <div className="flex items-center gap-3">
          <img
            src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
            alt="Gastinho Simples"
            className="h-10 w-10 rounded-lg"
          />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Gastinho Simples</h3>
            <p className="text-xs text-muted-foreground">Controle seus gastos de forma simples</p>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links Rápidos</h4>
            {quickLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conta</h4>
            {accountLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </div>
          <div className="col-span-2 space-y-2 sm:col-span-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</h4>
            <button
              onClick={() => navigate("/privacy-policy")}
              className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Política de Privacidade
            </button>
          </div>
        </div>

        <Separator />

        {/* Bottom */}
        <div className="space-y-1 text-center text-xs text-muted-foreground">
          <p className="italic">Toda Honra e Glória a Jesus Cristo</p>
          <p>© {currentYear} Gastinho Simples</p>
        </div>
      </div>
    </footer>
  );
};
