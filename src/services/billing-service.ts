import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Product IDs configurados no Google Play Console
 * IMPORTANTE: Estes são os IDs reais das assinaturas criadas
 */
export const PRODUCT_IDS = {
  NO_ADS: 'app.gastinho.subscription_no_ads_monthly',
  PREMIUM: 'app.gastinho.subs_premium_monthly',
  PREMIUM_PLUS: 'app.gastinho.subs_premium_plus_monthly',
} as const;

/**
 * Preços dos planos (para exibição - os preços reais vêm do Google Play)
 */
export const PLAN_PRICES = {
  NO_ADS: 4.90,
  PREMIUM: 14.90,
  PREMIUM_PLUS: 17.90,
} as const;

/**
 * Mapeia tier para product ID
 */
export const TIER_TO_PRODUCT_ID: Record<string, string> = {
  no_ads: PRODUCT_IDS.NO_ADS,
  premium: PRODUCT_IDS.PREMIUM,
  premium_plus: PRODUCT_IDS.PREMIUM_PLUS,
};

/**
 * Mapeia product ID para tier
 */
export const PRODUCT_ID_TO_TIER: Record<string, string> = {
  [PRODUCT_IDS.NO_ADS]: 'no_ads',
  [PRODUCT_IDS.PREMIUM]: 'premium',
  [PRODUCT_IDS.PREMIUM_PLUS]: 'premium_plus',
};

class BillingService {
  private isNative: boolean;
  private purchasesPlugin: any = null;
  private initialized = false;

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
   * Inicializa o plugin de compras in-app
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (!this.isNative) return false;

    try {
      // Importação dinâmica para evitar erros na web
      const purchasesModule = await import('@capgo/capacitor-purchases');
      this.purchasesPlugin = purchasesModule.CapacitorPurchases;
      
      // Inicializar com a chave do Google Play (será configurada)
      // Por enquanto, apenas prepara o plugin
      console.log('🛒 Plugin de compras carregado');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Erro ao carregar plugin de compras:', error);
      return false;
    }
  }

  /**
   * Busca os produtos disponíveis
   */
  async getProducts(): Promise<any[]> {
    if (!this.isNative || !this.purchasesPlugin) {
      console.log('ℹ️ Busca de produtos disponível apenas no app nativo');
      return [];
    }

    try {
      const productIds = Object.values(PRODUCT_IDS);
      const { products } = await this.purchasesPlugin.getProducts({
        productIdentifiers: productIds,
        type: 'SUBS',
      });
      
      console.log('📦 Produtos encontrados:', products);
      return products;
    } catch (error) {
      console.error('❌ Erro ao buscar produtos:', error);
      return [];
    }
  }

  /**
   * Inicia processo de compra
   * @param productId - ID do produto no Google Play
   * @param tier - Tier da assinatura (no_ads, premium, premium_plus)
   */
  async purchase(productId: string, tier: string): Promise<boolean> {
    try {
      console.log(`🛒 Iniciando compra: ${productId || 'auto'} (${tier})`);
      
      // Determinar o product ID correto
      const finalProductId = productId || TIER_TO_PRODUCT_ID[tier];
      
      if (!finalProductId) {
        console.error('❌ Product ID não encontrado para tier:', tier);
        return false;
      }

      if (this.isNative) {
        await this.initialize();
        
        if (this.purchasesPlugin) {
          return await this.purchaseWithPlugin(finalProductId, tier);
        } else {
          // Fallback para simulação (apenas desenvolvimento)
          console.warn('⚠️ Plugin não disponível - Usando simulação');
          return await this.simulatePurchase(tier, finalProductId);
        }
      } else {
        console.log('ℹ️ Compra na web não disponível');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao processar compra:', error);
      return false;
    }
  }

  /**
   * Realiza compra usando o plugin nativo
   */
  private async purchaseWithPlugin(productId: string, tier: string): Promise<boolean> {
    try {
      console.log(`🛒 Iniciando compra via plugin: ${productId}`);
      
      // Fazer a compra via Google Play
      const { customerInfo, productIdentifier } = await this.purchasesPlugin.purchaseProduct({
        productIdentifier: productId,
      });
      
      console.log('✅ Compra realizada:', { customerInfo, productIdentifier });
      
      // Obter o token da compra para validação
      const purchaseToken = customerInfo?.originalPurchaseDate || Date.now().toString();
      
      // Validar compra no backend
      return await this.validatePurchase(productId, purchaseToken, tier);
    } catch (error: any) {
      // Verifica se o usuário cancelou
      if (error?.code === 'PRODUCT_ALREADY_OWNED' || 
          error?.message?.includes('cancelled') ||
          error?.message?.includes('canceled')) {
        console.log('ℹ️ Compra cancelada pelo usuário');
        return false;
      }
      
      console.error('❌ Erro na compra via plugin:', error);
      throw error;
    }
  }

  /**
   * Valida compra no backend
   */
  private async validatePurchase(productId: string, purchaseToken: string, tier: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const response = await supabase.functions.invoke('validate-purchase', {
        body: {
          productId,
          purchaseToken,
          platform: 'android',
          tier,
        },
      });

      if (response.error) {
        throw response.error;
      }

      console.log('✅ Compra validada:', response.data);
      return response.data?.valid === true;
    } catch (error) {
      console.error('❌ Erro ao validar compra:', error);
      return false;
    }
  }

  /**
   * Simula compra para testes (REMOVER EM PRODUÇÃO)
   */
  private async simulatePurchase(tier: string, productId: string): Promise<boolean> {
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
          product_id: productId,
          platform: 'android',
          purchase_token: `sim_${Date.now()}`,
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
          productId,
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
  async restorePurchases(): Promise<{ success: boolean; tier?: string }> {
    if (!this.isNative) {
      console.log('ℹ️ Restaurar compras disponível apenas no app nativo');
      return { success: false };
    }

    try {
      await this.initialize();
      
      if (!this.purchasesPlugin) {
        console.warn('⚠️ Plugin não disponível para restaurar compras');
        return { success: false };
      }

      console.log('🔄 Restaurando compras...');
      
      const { customerInfo } = await this.purchasesPlugin.restorePurchases();
      
      console.log('📦 Informações do cliente:', customerInfo);
      
      // Verificar se há assinaturas ativas
      const activeSubscriptions = customerInfo?.activeSubscriptions || [];
      
      if (activeSubscriptions.length > 0) {
        // Encontrar o tier mais alto
        let highestTier = 'free';
        let highestProductId = '';
        
        for (const sub of activeSubscriptions) {
          const tier = PRODUCT_ID_TO_TIER[sub];
          if (tier === 'premium_plus') {
            highestTier = 'premium_plus';
            highestProductId = sub;
            break;
          } else if (tier === 'premium' && highestTier !== 'premium_plus') {
            highestTier = 'premium';
            highestProductId = sub;
          } else if (tier === 'no_ads' && highestTier === 'free') {
            highestTier = 'no_ads';
            highestProductId = sub;
          }
        }
        
        // Validar e atualizar no backend
        if (highestTier !== 'free') {
          const purchaseToken = customerInfo?.originalPurchaseDate || Date.now().toString();
          await this.validatePurchase(highestProductId, purchaseToken, highestTier);
          return { success: true, tier: highestTier };
        }
      }
      
      return { success: false };
    } catch (error) {
      console.error('❌ Erro ao restaurar compras:', error);
      return { success: false };
    }
  }

  /**
   * Cancela assinatura (redireciona para Google Play)
   */
  cancelSubscription(): void {
    if (this.isNative) {
      console.log('ℹ️ Redirecionar para: Google Play Store > Assinaturas');
      // Aqui poderia abrir deep link para as assinaturas do Google Play
      // Exemplo: window.open('https://play.google.com/store/account/subscriptions', '_system');
    } else {
      console.log('ℹ️ Gerenciar assinaturas na web');
    }
  }
}

export const billingService = new BillingService();
