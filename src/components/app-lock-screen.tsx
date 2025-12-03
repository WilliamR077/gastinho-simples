import { useState, useEffect, useRef } from "react";
import { appLockService, BiometryType } from "@/services/app-lock-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fingerprint, Lock, Delete, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AppLockScreenProps {
  onUnlock: () => void;
}

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.NONE);
  const [attempts, setAttempts] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkBiometry();
  }, []);

  const checkBiometry = async () => {
    if (appLockService.useBiometric()) {
      const { isAvailable, biometryType } = await appLockService.checkBiometricAvailability();
      setBiometryAvailable(isAvailable);
      setBiometryType(biometryType);
      
      // Auto-trigger biometric on load
      if (isAvailable) {
        handleBiometricAuth();
      }
    }
  };

  const handleBiometricAuth = async () => {
    if (isAuthenticating) return;
    
    setIsAuthenticating(true);
    const success = await appLockService.authenticateWithBiometric();
    setIsAuthenticating(false);
    
    if (success) {
      appLockService.setLastActive();
      onUnlock();
    } else {
      toast({
        title: "Falha na autenticação",
        description: "Tente novamente ou use o PIN",
        variant: "destructive",
      });
    }
  };

  const handlePinSubmit = () => {
    if (pin.length < 4) {
      toast({
        title: "PIN inválido",
        description: "O PIN deve ter pelo menos 4 dígitos",
        variant: "destructive",
      });
      return;
    }

    if (appLockService.verifyPin(pin)) {
      appLockService.setLastActive();
      onUnlock();
    } else {
      setAttempts((prev) => prev + 1);
      setPin("");
      toast({
        title: "PIN incorreto",
        description: attempts >= 2 ? "Cuidado! Muitas tentativas incorretas." : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const renderPinDots = () => {
    return (
      <div className="flex gap-3 justify-center mb-8">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              index < pin.length
                ? "bg-primary border-primary scale-110"
                : "border-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderNumpad = () => {
    const keys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "del"],
    ];

    return (
      <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
        {keys.flat().map((key, index) => {
          if (key === "") {
            return <div key={index} />;
          }
          
          if (key === "del") {
            return (
              <Button
                key={index}
                variant="ghost"
                className="h-16 w-16 rounded-full text-xl"
                onClick={handleDelete}
                disabled={pin.length === 0}
              >
                <Delete className="h-6 w-6" />
              </Button>
            );
          }

          return (
            <Button
              key={index}
              variant="ghost"
              className="h-16 w-16 rounded-full text-2xl font-semibold hover:bg-primary/10"
              onClick={() => handleKeyPress(key)}
            >
              {key}
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8">
        <img 
          src="/Gastinho_Simples_icone.png" 
          alt="Gastinho Simples" 
          className="w-20 h-20"
        />
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Gastinho Simples</h1>
        <p className="text-muted-foreground">Digite seu PIN para desbloquear</p>
      </div>

      {/* PIN Dots */}
      {renderPinDots()}

      {/* Numpad */}
      {renderNumpad()}

      {/* Submit Button */}
      <Button
        className="mt-6 w-full max-w-[280px]"
        onClick={handlePinSubmit}
        disabled={pin.length < 4}
      >
        <Lock className="h-4 w-4 mr-2" />
        Desbloquear
      </Button>

      {/* Biometric Button */}
      {biometryAvailable && appLockService.useBiometric() && (
        <Button
          variant="outline"
          className="mt-4 w-full max-w-[280px]"
          onClick={handleBiometricAuth}
          disabled={isAuthenticating}
        >
          <Fingerprint className="h-5 w-5 mr-2" />
          {isAuthenticating ? "Autenticando..." : `Usar ${appLockService.getBiometryTypeName(biometryType)}`}
        </Button>
      )}

      {/* Attempts Warning */}
      {attempts >= 3 && (
        <p className="mt-4 text-sm text-destructive text-center">
          {attempts} tentativas incorretas. Verifique seu PIN.
        </p>
      )}
    </div>
  );
}
