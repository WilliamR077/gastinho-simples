import { useState, useEffect } from "react";
import { appLockService, BiometryType } from "@/services/app-lock-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Fingerprint, KeyRound, Clock, Smartphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

export function SecuritySettings() {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [useBiometric, setUseBiometric] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.NONE);
  const [lockTimeout, setLockTimeout] = useState("0");
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLockEnabled(appLockService.isLockEnabled());
    setUseBiometric(appLockService.useBiometric());
    setLockTimeout(appLockService.getLockTimeout().toString());
    setHasPin(appLockService.hasPin());

    const { isAvailable, biometryType } = await appLockService.checkBiometricAvailability();
    setBiometryAvailable(isAvailable);
    setBiometryType(biometryType);
  };

  const handleLockToggle = (enabled: boolean) => {
    if (enabled && !hasPin) {
      // Precisa configurar PIN primeiro
      setShowPinDialog(true);
      return;
    }

    setLockEnabled(enabled);
    appLockService.setLockEnabled(enabled);
    
    // Notify onboarding
    window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "security-lock-toggled" }));
    
    if (enabled) {
      toast({
        title: "Bloqueio ativado",
        description: "Seu app agora está protegido",
      });
    } else {
      toast({
        title: "Bloqueio desativado",
        description: "Cuidado! Qualquer pessoa pode acessar o app",
      });
    }
  };

  const handleBiometricToggle = async (use: boolean) => {
    if (use && biometryAvailable) {
      // Testar biometria antes de ativar
      const success = await appLockService.authenticateWithBiometric();
      if (!success) {
        toast({
          title: "Erro",
          description: "Não foi possível ativar a biometria. Tente novamente.",
          variant: "destructive",
        });
        return;
      }
    }

    setUseBiometric(use);
    appLockService.setUseBiometric(use);
    
    toast({
      title: use ? "Biometria ativada" : "Biometria desativada",
      description: use 
        ? `${appLockService.getBiometryTypeName(biometryType)} será usada para desbloquear` 
        : "Use apenas o PIN para desbloquear",
    });
  };

  const handleTimeoutChange = (value: string) => {
    setLockTimeout(value);
    appLockService.setLockTimeout(parseInt(value, 10));
  };

  const handleSavePin = () => {
    if (newPin.length < 4 || newPin.length > 6) {
      toast({
        title: "PIN inválido",
        description: "O PIN deve ter entre 4 e 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PINs não conferem",
        description: "Digite o mesmo PIN nos dois campos",
        variant: "destructive",
      });
      return;
    }

    appLockService.setPin(newPin);
    setHasPin(true);
    setShowPinDialog(false);
    setNewPin("");
    setConfirmPin("");

    // Se estava tentando ativar o bloqueio, ativa agora
    if (!lockEnabled) {
      setLockEnabled(true);
      appLockService.setLockEnabled(true);
    }

    // Notify onboarding
    window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "security-pin-saved" }));
    window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "security-lock-toggled" }));

    toast({
      title: "PIN configurado",
      description: "Seu PIN foi salvo com sucesso",
    });
  };

  const handleChangePin = () => {
    setShowPinDialog(true);
  };

  if (!isNative) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança do App
          </CardTitle>
          <CardDescription>
            Proteja seus dados com bloqueio por PIN ou biometria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              O bloqueio do app está disponível apenas na versão mobile (Android/iOS).
              No navegador, seus dados já são protegidos pelo login.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança do App
          </CardTitle>
          <CardDescription>
            Proteja seus dados com bloqueio por PIN ou biometria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle principal */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Ativar bloqueio do app</Label>
              <p className="text-sm text-muted-foreground">
                Exige autenticação ao abrir o app
              </p>
            </div>
            <Switch
              data-onboarding="settings-lock-toggle"
              checked={lockEnabled}
              onCheckedChange={handleLockToggle}
            />
          </div>

          {lockEnabled && (
            <>
              {/* Biometria */}
              {biometryAvailable && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-5 w-5 text-primary" />
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">
                        Usar {appLockService.getBiometryTypeName(biometryType)}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Desbloqueie rapidamente com biometria
                      </p>
                    </div>
                  </div>
                  <Switch
                    data-onboarding="settings-biometric-toggle"
                    checked={useBiometric}
                    onCheckedChange={handleBiometricToggle}
                  />
                </div>
              )}

              {/* PIN */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">PIN de segurança</Label>
                    <p className="text-sm text-muted-foreground">
                      {hasPin ? "PIN configurado" : "Configure um PIN"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleChangePin}>
                  {hasPin ? "Alterar" : "Configurar"}
                </Button>
              </div>

              {/* Timeout */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Bloquear após</Label>
                    <p className="text-sm text-muted-foreground">
                      Tempo em segundo plano para bloquear
                    </p>
                  </div>
                </div>
                <Select data-onboarding="settings-lock-timeout" value={lockTimeout} onValueChange={handleTimeoutChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Imediatamente</SelectItem>
                    <SelectItem value="1">1 minuto</SelectItem>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {!biometryAvailable && isNative && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 Seu dispositivo não suporta biometria ou ela não está configurada.
                Use o PIN para proteger o app.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para configurar PIN */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar PIN</DialogTitle>
            <DialogDescription>
              Crie um PIN de 4 a 6 dígitos para proteger seu app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-pin">Novo PIN</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Digite o PIN (4-6 dígitos)"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirmar PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Confirme o PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePin}>
              Salvar PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
