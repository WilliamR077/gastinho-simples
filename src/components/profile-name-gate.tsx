import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { UserCircle2, LogOut } from "lucide-react";

/**
 * Modal obrigatório (não dismissível) que pede o nome quando o perfil
 * ainda não tem `display_name`. Aparece para usuários antigos e para
 * cadastros que não trouxeram nome do provedor.
 */
export function ProfileNameGate() {
  const { needsName, updateDisplayName, loading } = useProfile();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (needsName) setName("");
  }, [needsName]);

  if (loading || !needsName) return null;

  const trimmed = name.trim();
  const canSave = trimmed.length >= 2 && trimmed.length <= 60 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const { error } = await updateDisplayName(trimmed);
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Nome salvo!", description: "Obrigado por se apresentar 👋" });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        hideCloseButton
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <UserCircle2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Como podemos te chamar?</DialogTitle>
          <DialogDescription className="text-center">
            Esse nome aparece para outras pessoas nos grupos compartilhados, no lugar do seu e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="display-name">Nome</Label>
          <Input
            id="display-name"
            placeholder="Ex.: Maria Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) handleSave();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Pode ser primeiro nome e sobrenome. Não precisa ser o nome completo.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSave} disabled={!canSave} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-muted-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {signingOut ? "Saindo..." : "Sair da conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
