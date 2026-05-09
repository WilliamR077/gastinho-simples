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
  // Retorna: { success: boolean, cancelled: boolean }
  async authenticateWithBiometric(): Promise<{ success: boolean; cancelled: boolean }> {
    if (!this.isNative()) {
      return { success: false, cancelled: false };
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: "Desbloqueie o Gastinho Simples",
        title: "Autenticação",
        subtitle: "Use sua biometria para desbloquear",
        description: "Coloque seu dedo no sensor ou use o reconhecimento facial",
        negativeButtonText: "Usar PIN",
      });
      // Se chegou aqui, autenticação foi bem-sucedida
      console.log("Biometria: autenticação bem-sucedida");
      return { success: true, cancelled: false };
    } catch (error: any) {
      console.log("Biometria erro:", error);
      // Verificar se foi cancelamento do usuário
      const errorMessage = error?.message || error?.toString() || "";
      const isCancelled = 
        errorMessage.includes("cancel") || 
        errorMessage.includes("Cancel") ||
        errorMessage.includes("negative") ||
        errorMessage.includes("dismissed") ||
        error?.code === "10" || // Android: ERROR_CANCELED
        error?.code === "13"; // Android: ERROR_NEGATIVE_BUTTON
      
      return { success: false, cancelled: isCancelled };
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

  // PBKDF2-SHA256 com salt aleatório de 16B e 200k iterações.
  // Formato: v2.pbkdf2.<iterations>.<saltB64>.<hashB64>
  private static readonly PBKDF2_ITERATIONS = 200_000;
  private static readonly PBKDF2_SALT_BYTES = 16;
  private static readonly PBKDF2_HASH_BITS = 256;

  private getSubtle(): SubtleCrypto {
    const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
    if (!subtle) {
      // Falha controlada: não cair em hash fraco como fallback.
      throw new Error("Secure crypto unavailable");
    }
    return subtle;
  }

  private bytesToB64(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  private b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Comparação em tempo constante.
  private constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  private async derivePbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const subtle = this.getSubtle();
    const keyMaterial = await subtle.importKey(
      "raw",
      new TextEncoder().encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const bits = await subtle.deriveBits(
      { name: "PBKDF2", salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, iterations, hash: "SHA-256" },
      keyMaterial,
      AppLockService.PBKDF2_HASH_BITS
    );
    return new Uint8Array(bits);
  }

  // Hash legado (apenas para verificar PINs antigos durante a migração).
  private legacyHash(pin: string): string {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private async buildV2Record(pin: string): Promise<string> {
    const salt = new Uint8Array(AppLockService.PBKDF2_SALT_BYTES);
    crypto.getRandomValues(salt);
    const iterations = AppLockService.PBKDF2_ITERATIONS;
    const hash = await this.derivePbkdf2(pin, salt, iterations);
    return `v2.pbkdf2.${iterations}.${this.bytesToB64(salt)}.${this.bytesToB64(hash)}`;
  }

  // Salvar PIN com PBKDF2-SHA256.
  async setPin(pin: string): Promise<void> {
    const record = await this.buildV2Record(pin);
    localStorage.setItem(PIN_KEY, record);
  }

  // Verificar PIN. Suporta formato v2 e legado (com migração transparente).
  async verifyPin(pin: string): Promise<boolean> {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;

    if (stored.startsWith("v2.")) {
      // Parser defensivo: formato malformado retorna false sem quebrar.
      try {
        const parts = stored.split(".");
        if (parts.length !== 5 || parts[1] !== "pbkdf2") return false;
        const iterations = parseInt(parts[2], 10);
        if (!Number.isFinite(iterations) || iterations <= 0) return false;
        const salt = this.b64ToBytes(parts[3]);
        const expected = this.b64ToBytes(parts[4]);
        if (salt.length === 0 || expected.length === 0) return false;
        const actual = await this.derivePbkdf2(pin, salt, iterations);
        return this.constantTimeEqual(actual, expected);
      } catch {
        // Não logar conteúdo bruto / salt / hash.
        return false;
      }
    }

    // Formato legado: comparar e migrar para v2 se bater.
    const legacyOk = this.legacyHash(pin) === stored;
    if (!legacyOk) return false;

    try {
      const newRecord = await this.buildV2Record(pin);
      // Só sobrescreve depois de derivar com sucesso.
      localStorage.setItem(PIN_KEY, newRecord);
    } catch {
      // Migração falhou (ex.: subtle indisponível): mantém legado e segue ok.
    }
    return true;
  }

  // Verificar se tem PIN configurado
  hasPin(): boolean {
    return localStorage.getItem(PIN_KEY) !== null;
  }

  // Remover PIN
  removePin(): void {
    localStorage.removeItem(PIN_KEY);
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
