import { NativeBiometric, BiometryType } from "capacitor-native-biometric";
import { Capacitor } from "@capacitor/core";

const LOCK_ENABLED_KEY = "app_lock_enabled";
const PIN_KEY = "app_lock_pin";
const USE_BIOMETRIC_KEY = "app_lock_use_biometric";
const LAST_ACTIVE_KEY = "app_last_active";
const LOCK_TIMEOUT_KEY = "app_lock_timeout"; // em minutos

interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: BiometryType;
}

class AppLockService {
  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  // Verificar se biometria está disponível no dispositivo
  async checkBiometricAvailability(): Promise<BiometricAvailability> {
    if (!this.isNative()) {
      return { isAvailable: false, biometryType: BiometryType.NONE };
    }

    try {
      const result = await NativeBiometric.isAvailable();
      return {
        isAvailable: result.isAvailable,
        biometryType: result.biometryType,
      };
    } catch (error) {
      console.error("Erro ao verificar biometria:", error);
      return { isAvailable: false, biometryType: BiometryType.NONE };
    }
  }

  // Autenticar com biometria
  async authenticateWithBiometric(): Promise<boolean> {
    if (!this.isNative()) {
      return false;
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: "Desbloqueie o Gastinho Simples",
        title: "Autenticação",
        subtitle: "Use sua biometria para desbloquear",
        description: "Coloque seu dedo no sensor ou use o reconhecimento facial",
      });
      return true;
    } catch (error) {
      console.error("Falha na autenticação biométrica:", error);
      return false;
    }
  }

  // Verificar se o bloqueio está ativado
  isLockEnabled(): boolean {
    return localStorage.getItem(LOCK_ENABLED_KEY) === "true";
  }

  // Ativar/desativar bloqueio
  setLockEnabled(enabled: boolean): void {
    localStorage.setItem(LOCK_ENABLED_KEY, enabled ? "true" : "false");
  }

  // Verificar se deve usar biometria
  useBiometric(): boolean {
    return localStorage.getItem(USE_BIOMETRIC_KEY) === "true";
  }

  // Ativar/desativar uso de biometria
  setUseBiometric(use: boolean): void {
    localStorage.setItem(USE_BIOMETRIC_KEY, use ? "true" : "false");
  }

  // Salvar PIN (em produção, considerar criptografar)
  setPin(pin: string): void {
    // Simple hash para não salvar o PIN em texto puro
    const hashedPin = this.hashPin(pin);
    localStorage.setItem(PIN_KEY, hashedPin);
  }

  // Verificar PIN
  verifyPin(pin: string): boolean {
    const storedHash = localStorage.getItem(PIN_KEY);
    if (!storedHash) return false;
    return this.hashPin(pin) === storedHash;
  }

  // Verificar se tem PIN configurado
  hasPin(): boolean {
    return localStorage.getItem(PIN_KEY) !== null;
  }

  // Remover PIN
  removePin(): void {
    localStorage.removeItem(PIN_KEY);
  }

  // Simple hash function (em produção, usar algo mais robusto)
  private hashPin(pin: string): string {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // Registrar última atividade
  setLastActive(): void {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  }

  // Verificar se deve bloquear (baseado em timeout)
  shouldLock(): boolean {
    if (!this.isLockEnabled()) return false;
    
    const timeout = this.getLockTimeout();
    if (timeout === 0) return true; // Sempre bloquear

    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActive) return true;

    const elapsed = Date.now() - parseInt(lastActive, 10);
    const timeoutMs = timeout * 60 * 1000; // minutos para ms
    
    return elapsed > timeoutMs;
  }

  // Obter timeout de bloqueio (em minutos)
  getLockTimeout(): number {
    const timeout = localStorage.getItem(LOCK_TIMEOUT_KEY);
    return timeout ? parseInt(timeout, 10) : 0; // 0 = sempre bloquear
  }

  // Definir timeout de bloqueio
  setLockTimeout(minutes: number): void {
    localStorage.setItem(LOCK_TIMEOUT_KEY, minutes.toString());
  }

  // Obter nome do tipo de biometria
  getBiometryTypeName(type: BiometryType): string {
    switch (type) {
      case BiometryType.FACE_ID:
        return "Face ID";
      case BiometryType.TOUCH_ID:
        return "Touch ID";
      case BiometryType.FINGERPRINT:
        return "Digital";
      case BiometryType.FACE_AUTHENTICATION:
        return "Reconhecimento Facial";
      case BiometryType.IRIS_AUTHENTICATION:
        return "Íris";
      default:
        return "Biometria";
    }
  }

  // Resetar todas as configurações de segurança
  resetAll(): void {
    localStorage.removeItem(LOCK_ENABLED_KEY);
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(USE_BIOMETRIC_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    localStorage.removeItem(LOCK_TIMEOUT_KEY);
  }
}

export const appLockService = new AppLockService();
export { BiometryType };
