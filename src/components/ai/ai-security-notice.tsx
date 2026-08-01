import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "ai-integrations-security-notice-dismissed";

const BANNER_SUMMARY =
  "A conexão exige sua autorização, não compartilha sua senha e pode ser encerrada quando você quiser.";

const securityPoints = [
  "A conexão só funciona depois que você autoriza o acesso.",
  "Somente a conta do Gastinho autorizada pode ser acessada.",
  "Sua senha nunca é compartilhada com o assistente.",
  "O acesso pode ser encerrado a qualquer momento nas configurações do assistente.",
];

export function AiSecurityNotice() {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Preferência apenas visual: ignorar falha de armazenamento.
    }
  };

  return (
    <div className="space-y-3">
      {!dismissed && (
        <div className="relative w-full rounded-lg border border-primary/40 bg-primary/5 p-3 pr-12">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Acesso protegido</h2>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {BANNER_SUMMARY}
          </p>
          <Button
            type="button"
            variant="link"
            onClick={() => setOpen(true)}
            className="mt-1 h-auto p-0 text-sm font-medium"
          >
            Saiba mais
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={dismiss}
            aria-label="Fechar aviso de acesso protegido"
            className="absolute right-1 top-1 h-11 w-11"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver detalhes sobre o acesso protegido"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        Acesso protegido
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              Acesso protegido
            </DialogTitle>
            <DialogDescription>
              Como funciona a segurança da conexão com seu assistente.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {securityPoints.map((point) => (
              <li key={point} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
