import { useEffect, useRef } from "react";
import { adMobService } from "./admob-service";

/**
 * Coordenador centralizado da visibilidade do banner AdMob.
 *
 * Vários componentes (sheets, dialogs, tutorial) podem precisar esconder o
 * banner ao mesmo tempo. Em vez de cada um chamar `hideBanner` / `showBanner`
 * diretamente (criando race conditions), todos solicitam um lock através do
 * coordenador. O banner só reaparece quando *todas* as razões forem liberadas.
 */
class AdBannerCoordinator {
  private reasons = new Set<string>();
  private hidden = false;

  requestHide(reason: string): void {
    if (!reason) return;
    this.reasons.add(reason);
    if (!this.hidden) {
      this.hidden = true;
      // Fire and forget — adMobService já cuida de plataforma/premium
      void adMobService.hideBanner();
    }
  }

  releaseHide(reason: string): void {
    if (!reason) return;
    this.reasons.delete(reason);
    if (this.reasons.size === 0 && this.hidden) {
      this.hidden = false;
      void adMobService.showBanner();
    }
  }

  /**
   * Limpeza defensiva — remove todas as razões cujo nome começa com `prefix`.
   * Útil para safety nets em mudanças de rota.
   */
  forceRelease(prefix?: string): void {
    if (!prefix) {
      this.reasons.clear();
    } else {
      for (const r of Array.from(this.reasons)) {
        if (r.startsWith(prefix)) this.reasons.delete(r);
      }
    }
    if (this.reasons.size === 0 && this.hidden) {
      this.hidden = false;
      void adMobService.showBanner();
    }
  }

  /** Útil para debug/testes */
  getActiveReasons(): string[] {
    return Array.from(this.reasons);
  }
}

export const adBannerCoordinator = new AdBannerCoordinator();

/**
 * Hook React que registra um lock no coordenador enquanto `active === true`.
 *
 * Garantias:
 * - Libera exatamente a `reason` que foi registrada (mesmo se a prop mudar).
 * - Cleanup roda em: `active` mudar, `reason` mudar, unmount, mudança de rota
 *   (via desmontagem natural do componente).
 */
export function useAdBannerLock(reason: string, active: boolean): void {
  // Guarda a reason que foi efetivamente registrada para liberar a mesma
  // string na cleanup, evitando vazamentos quando `reason` muda entre renders.
  const registeredReasonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      // Garante liberação se um lock anterior estiver pendurado
      if (registeredReasonRef.current) {
        adBannerCoordinator.releaseHide(registeredReasonRef.current);
        registeredReasonRef.current = null;
      }
      return;
    }

    adBannerCoordinator.requestHide(reason);
    registeredReasonRef.current = reason;

    return () => {
      if (registeredReasonRef.current) {
        adBannerCoordinator.releaseHide(registeredReasonRef.current);
        registeredReasonRef.current = null;
      }
    };
  }, [reason, active]);
}
