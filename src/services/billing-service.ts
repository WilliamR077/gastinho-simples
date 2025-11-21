import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Product IDs que devem ser configurados no Google Play Console
 * Formato recomendado: app.lovable.gastinhosimples.subscription_{plan}_monthly
 */
export const PRODUCT_IDS = {
  NO_ADS: 'app.lovable.gastinhosimples.subscription_no_ads_monthly',
  PREMIUM: 'app.lovable.gastinhosimples.subscription_premium_monthly',
  PREMIUM_PLUS: 'app.lovable.gastinhosimples.subscription_premium_plus_monthly',
} as const;

/**
 * Preços dos planos (para exibição - os preços reais vêm do Google Play)
 */
export const PLAN_PRICES = {
  NO_ADS: 4.90,
  PREMIUM: 14.90,
  PREMIUM_PLUS: 17.90,
} as const;

class BillingService {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Verifica se está rodando em plataforma nativa
   */
  isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Inicia processo de compra
   * No Android: Abre Google Play Billing
   * Na Web: Redireciona para página de instruções ou sistema de pagamento web
   */
  async purchase(productId: string, tier: string): Promise<boolean> {
    try {
      console.log(`🛒 Iniciando compra: ${productId} (${tier})`);

      if (this.isNative) {
        // Em produção, aqui seria integrado com Google Play Billing
        // Por enquanto, vamos simular e registrar no banco
        console.warn('⚠️ Google Play Billing não implementado - Simulando compra');
        return await this.simulatePurchase(tier);
      } else {
        // Na web, redirecionar para sistema de pagamento web (Stripe, PagSeguro, etc)
        console.log('ℹ️ Compra na web - redirecionar para gateway de pagamento');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao processar compra:', error);
      return false;
    }
  }

  /**
   * Simula compra para testes (REMOVER EM PRODUÇÃO)
   */
  private async simulatePurchase(tier: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Calcular data de expiração (30 dias)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Atualizar assinatura
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          tier: tier as any,
          is_active: true,
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      // Registrar no audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'subscription_activated_test',
        details: {
          tier,
          expiresAt: expiresAt.toISOString(),
          method: 'simulation',
        },
      });

      console.log('✅ Compra simulada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao simular compra:', error);
      return false;
    }
  }

  /**
   * Restaura compras anteriores
   */
  async restorePurchases(): Promise<boolean> {
    if (!this.isNative) {
      console.log('ℹ️ Restaurar compras disponível apenas no app nativo');
      return false;
    }

    try {
      console.log('🔄 Restaurando compras...');
      // Aqui seria feita a restauração via Google Play Billing
      console.warn('⚠️ Restauração de compras não implementada');
      return false;
    } catch (error) {
      console.error('❌ Erro ao restaurar compras:', error);
      return false;
    }
  }

  /**
   * Cancela assinatura (redireciona para Google Play)
   */
  cancelSubscription(): void {
    if (this.isNative) {
      console.log('ℹ️ Redirecionar para: Google Play Store > Assinaturas');
      // Aqui poderia abrir deep link para as assinaturas do Google Play
    } else {
      console.log('ℹ️ Gerenciar assinaturas na web');
    }
  }
}

export const billingService = new BillingService();
