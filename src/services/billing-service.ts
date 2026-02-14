import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Declare the CdvPurchase global type
declare global {
  interface Window {
    CdvPurchase?: {
      store: CdvPurchaseStore;
      Platform: {
        GOOGLE_PLAY: string;
        APPLE_APPSTORE: string;
      };
      ProductType: {
        PAID_SUBSCRIPTION: string;
        CONSUMABLE: string;
        NON_CONSUMABLE: string;
      };
      LogLevel: {
        DEBUG: number;
        INFO: number;
        WARNING: number;
        ERROR: number;
        QUIET: number;
      };
    };
  }
}

interface CdvPurchaseStore {
  verbosity: number;
  register: (products: CdvPurchaseProduct[]) => void;
  initialize: (platforms?: string[]) => Promise<void>;
  ready: (callback: () => void) => void;
  when: () => CdvPurchaseWhen;
  get: (productId: string) => CdvPurchaseProduct | undefined;
  order: (product: CdvPurchaseProduct) => Promise<any>;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<void>;
}

interface CdvPurchaseOffer {
  id: string;
  order: () => Promise<any>;
  pricingPhases?: Array<{
    price: string;
    priceMicros: number;
    currency: string;
    billingPeriod?: string;
  }>;
}

interface CdvPurchaseProduct {
  id: string;
  type?: string;
  platform?: string;
  title?: string;
  description?: string;
  pricing?: {
    price: string;
    priceMicros: number;
    currency: string;
  };
  canPurchase?: boolean;
  owned?: boolean;
  getOffer?: () => CdvPurchaseOffer | undefined;
  offers?: CdvPurchaseOffer[];
  // Transaction properties for restorePurchases
  lastTransaction?: CdvPurchaseTransaction;
  transactions?: CdvPurchaseTransaction[];
}

interface CdvPurchaseWhen {
  approved: (callback: (transaction: CdvPurchaseTransaction) => void) => CdvPurchaseWhen;
  verified: (callback: (receipt: any) => void) => CdvPurchaseWhen;
  finished: (callback: (transaction: CdvPurchaseTransaction) => void) => CdvPurchaseWhen;
  updated: (callback: (product: CdvPurchaseProduct) => void) => CdvPurchaseWhen;
}

interface CdvPurchaseTransaction {
  id: string;
  products: { id: string }[];
  finish: () => void;
  verify: () => Promise<void>;
  purchaseToken?: string;
}

/**
 * Product IDs configurados no Google Play Console
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
  private store: CdvPurchaseStore | null = null;
  private initialized = false;
  private pendingPurchaseResolve: ((value: boolean) => void) | null = null;
  private pendingPurchaseTier: string | null = null;

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
      // Aguardar o CdvPurchase estar disponível
      if (!window.CdvPurchase) {
        console.log('⏳ Aguardando CdvPurchase...');
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (window.CdvPurchase) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          // Timeout após 5 segundos
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        });
      }

      if (!window.CdvPurchase) {
        console.warn('⚠️ CdvPurchase não disponível');
        return false;
      }

      this.store = window.CdvPurchase.store;
      
      // Configurar nível de log
      this.store.verbosity = window.CdvPurchase.LogLevel.DEBUG;

      // Registrar produtos com grupo para upgrades/downgrades
      const products = Object.values(PRODUCT_IDS).map(id => ({
        id,
        type: window.CdvPurchase!.ProductType.PAID_SUBSCRIPTION,
        platform: window.CdvPurchase!.Platform.GOOGLE_PLAY,
        group: 'subscription',
      }));

      this.store.register(products as any);
      console.log('📦 Produtos registrados:', products.map(p => p.id));

      // Configurar handlers
      this.setupEventHandlers();

      // Inicializar a loja
      await this.store.initialize([window.CdvPurchase.Platform.GOOGLE_PLAY]);
      
      console.log('✅ Loja de compras inicializada');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar loja de compras:', error);
      return false;
    }
  }

  /**
   * Configura handlers de eventos de compra
   */
  private setupEventHandlers(): void {
    if (!this.store || !window.CdvPurchase) return;

    this.store.when()
      .approved(async (transaction) => {
        console.log('✅ Transação aprovada:', transaction.id);
        console.log('📋 Transaction object keys:', Object.keys(transaction));
        
        // Obter o produto comprado
        const productId = transaction.products[0]?.id;
        if (productId) {
          const tier = PRODUCT_ID_TO_TIER[productId] || this.pendingPurchaseTier;
          
          // Extrair purchaseToken de múltiplas fontes possíveis
          const transactionAny = transaction as any;
          
          // Log completo do objeto transaction para debug
          console.log('📋 Transaction details:', JSON.stringify({
            id: transaction.id,
            purchaseToken: transaction.purchaseToken,
            transactionId: transactionAny.transactionId,
            nativePurchase: transactionAny.nativePurchase ? {
              purchaseToken: transactionAny.nativePurchase.purchaseToken,
              orderId: transactionAny.nativePurchase.orderId,
            } : null,
            originalJson: transactionAny.originalJson ? 'exists' : 'not found',
          }, null, 2));
          
          let purchaseToken = '';
          let tokenSource = '';
          
          // Ordem de prioridade para extração do token
          if (transaction.purchaseToken && transaction.purchaseToken.length > 50) {
            purchaseToken = transaction.purchaseToken;
            tokenSource = 'transaction.purchaseToken';
          } else if (transactionAny.nativePurchase?.purchaseToken && transactionAny.nativePurchase.purchaseToken.length > 50) {
            purchaseToken = transactionAny.nativePurchase.purchaseToken;
            tokenSource = 'nativePurchase.purchaseToken';
          } else if (transactionAny.transactionId && transactionAny.transactionId.length > 50) {
            purchaseToken = transactionAny.transactionId;
            tokenSource = 'transactionId';
          } else if (transactionAny.originalJson) {
            // Tentar parsear originalJson se existir
            try {
              const parsed = JSON.parse(transactionAny.originalJson);
              if (parsed.purchaseToken) {
                purchaseToken = parsed.purchaseToken;
                tokenSource = 'originalJson.purchaseToken';
              }
            } catch (e) {
              console.warn('⚠️ Erro ao parsear originalJson:', e);
            }
          }
          
          // Fallback para ID se não encontramos um token válido
          if (!purchaseToken) {
            purchaseToken = transaction.id;
            tokenSource = 'transaction.id (fallback)';
          }
          
          console.log('🔐 Token extraction result:', {
            source: tokenSource,
            tokenLength: purchaseToken.length,
            tokenPrefix: purchaseToken.substring(0, 40) + '...',
          });
          
          // Validar no backend
          const success = await this.validatePurchase(productId, purchaseToken, tier || 'premium');
          
          if (success) {
            console.log('✅ Compra validada no backend - finalizando transação');
            transaction.finish();
            
            if (this.pendingPurchaseResolve) {
              this.pendingPurchaseResolve(true);
              this.pendingPurchaseResolve = null;
            }
          } else {
            console.warn('⚠️ Validação falhou - salvando purchase_token para retry posterior');
            
            // Salvar o purchase_token no banco mesmo assim para recuperação posterior
            await this.savePurchaseTokenForRetry(productId, purchaseToken, tier || 'premium');
            
            // NÃO finalizamos para que o Google Play continue pedindo confirmação
            if (this.pendingPurchaseResolve) {
              this.pendingPurchaseResolve(false);
              this.pendingPurchaseResolve = null;
            }
          }
        }
      })
      .finished((transaction) => {
        console.log('🏁 Transação finalizada:', transaction.id);
      })
      .updated((product) => {
        console.log('🔄 Produto atualizado:', product.id, product);
      });
  }

  /**
   * Salva o purchase_token no banco para retry posterior
   * Usado quando a validação falha mas queremos permitir recuperação
   */
  private async savePurchaseTokenForRetry(productId: string, purchaseToken: string, tier: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('💾 Salvando purchase_token para retry...');
      
      // Upsert para criar ou atualizar a assinatura com o token
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          product_id: productId,
          purchase_token: purchaseToken,
          tier: tier as any,
          platform: 'android',
          is_active: false, // Marcar como inativo até validação bem-sucedida
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Erro ao salvar purchase_token:', error);
      } else {
        console.log('✅ purchase_token salvo para retry posterior');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar purchase_token:', error);
    }
  }

  /**
   * Busca os produtos disponíveis
   */
  async getProducts(): Promise<CdvPurchaseProduct[]> {
    if (!this.isNative) {
      console.log('ℹ️ Busca de produtos disponível apenas no app nativo');
      return [];
    }

    await this.initialize();

    if (!this.store) {
      return [];
    }

    const products: CdvPurchaseProduct[] = [];
    for (const productId of Object.values(PRODUCT_IDS)) {
      const product = this.store.get(productId);
      if (product) {
        products.push(product);
      }
    }

    console.log('📦 Produtos disponíveis:', products);
    return products;
  }

  /**
   * Inicia processo de compra
   */
  async purchase(productId: string, tier: string): Promise<boolean> {
    try {
      console.log(`🛒 Iniciando compra: ${productId} (${tier})`);
      
      const finalProductId = productId || TIER_TO_PRODUCT_ID[tier];
      
      if (!finalProductId) {
        console.error('❌ Product ID não encontrado para tier:', tier);
        return false;
      }

      if (this.isNative) {
        await this.initialize();
        
        if (this.store && window.CdvPurchase) {
          return await this.purchaseWithStore(finalProductId, tier);
        } else {
          // Fallback para simulação (apenas desenvolvimento)
          console.warn('⚠️ Store não disponível - Usando simulação');
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
   * Realiza compra usando cordova-plugin-purchase
   */
  private async purchaseWithStore(productId: string, tier: string): Promise<boolean> {
    if (!this.store) {
      throw new Error('Store não inicializada');
    }

    return new Promise(async (resolve) => {
      try {
        console.log(`🛒 Iniciando compra via store: ${productId}`);
        
        const product = this.store!.get(productId) as CdvPurchaseProduct | undefined;
        
        if (!product) {
          console.error('❌ Produto não encontrado:', productId);
          resolve(false);
          return;
        }

        console.log('📦 Produto encontrado:', JSON.stringify(product));

        // Obter a oferta do produto (necessário para assinaturas)
        let offer: CdvPurchaseOffer | undefined;
        
        if (typeof product.getOffer === 'function') {
          offer = product.getOffer();
          console.log('📦 Oferta via getOffer():', offer?.id);
        } else if (product.offers && product.offers.length > 0) {
          offer = product.offers[0];
          console.log('📦 Oferta via offers[]:', offer?.id);
        }

        if (!offer) {
          console.error('❌ Oferta não encontrada para o produto:', productId);
          console.log('📦 Estrutura do produto:', Object.keys(product));
          
          // Tentar acessar offers de forma alternativa
          const productAny = product as any;
          if (productAny.offers && Array.isArray(productAny.offers) && productAny.offers.length > 0) {
            offer = productAny.offers[0];
            console.log('📦 Oferta encontrada via fallback:', offer?.id);
          } else {
            resolve(false);
            return;
          }
        }

        if (product.owned) {
          console.log('ℹ️ Produto já foi comprado');
          const success = await this.validatePurchase(productId, 'restored', tier);
          resolve(success);
          return;
        }

        // Salvar resolver para usar no callback approved
        this.pendingPurchaseResolve = resolve;
        this.pendingPurchaseTier = tier;

        // Iniciar compra usando a OFERTA (não o produto)
        console.log('🛒 Chamando offer.order() para:', offer.id);
        const result = await offer.order();
        
        if (result?.error) {
          console.error('❌ Erro ao iniciar compra:', result.error);
          this.pendingPurchaseResolve = null;
          resolve(false);
        }
        
        // O resultado final virá pelo callback 'approved'
        // Timeout para não ficar esperando indefinidamente
        setTimeout(() => {
          if (this.pendingPurchaseResolve) {
            console.log('⏰ Timeout da compra - usuário pode ter cancelado');
            this.pendingPurchaseResolve = null;
            resolve(false);
          }
        }, 120000); // 2 minutos

      } catch (error: any) {
        console.error('❌ Erro na compra via store:', error);
        this.pendingPurchaseResolve = null;
        
        // Verifica se o usuário cancelou
        if (error?.code === 6777001 || 
            error?.message?.includes('cancelled') ||
            error?.message?.includes('canceled')) {
          console.log('ℹ️ Compra cancelada pelo usuário');
        }
        
        resolve(false);
      }
    });
  }

  /**
   * Valida compra no backend
   */
  private async validatePurchase(productId: string, purchaseToken: string, tier: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ Usuário não autenticado para validar compra');
        return false;
      }

      console.log('🔄 Validating purchase with backend...', { productId, tier, tokenPrefix: purchaseToken?.substring(0, 20) });

      const response = await supabase.functions.invoke('validate-purchase', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          productId,
          purchaseToken,
          platform: 'android',
          tier,
        },
      });

      if (response.error) {
        console.error('❌ validate-purchase error:', response.error);
        return false;
      }

      console.log('✅ validate-purchase response:', response.data);
      
      if (response.data?.errorCode) {
        console.error('❌ Backend validation error code:', response.data.errorCode);
        
        // Se o token pertence a outro usuário, não tentar novamente
        if (response.data.errorCode === 'TOKEN_BELONGS_TO_OTHER_USER') {
          console.log('⚠️ Esta assinatura pertence a outra conta - não será aplicada');
          return false;
        }
      }
      
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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

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
      
      if (!this.store) {
        console.warn('⚠️ Store não disponível para restaurar compras');
        return { success: false };
      }

      console.log('🔄 Restaurando compras...');
      
      // Chamar refresh E restorePurchases para garantir que todas as transações sejam processadas
      await this.store.refresh();
      
      // Tentar chamar restorePurchases se disponível (força reprocessamento de transações pendentes)
      try {
        if (typeof this.store.restorePurchases === 'function') {
          console.log('🔄 Chamando store.restorePurchases()...');
          await this.store.restorePurchases();
        }
      } catch (restoreError) {
        console.warn('⚠️ restorePurchases falhou (pode ser normal):', restoreError);
      }
      
      // Aguardar um tempo para as transações serem carregadas
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar produtos owned
      let highestTier = 'free';
      let highestProductId = '';
      let purchaseToken = '';
      
      for (const productId of Object.values(PRODUCT_IDS)) {
        const product = this.store.get(productId) as CdvPurchaseProduct | undefined;
        
        console.log(`🔍 Verificando produto ${productId}:`, {
          owned: product?.owned,
          hasLastTransaction: !!(product as any)?.lastTransaction,
          hasTransactions: !!((product as any)?.transactions?.length),
        });
        
        if (product?.owned) {
          // Tentar obter o token real da transação de múltiplas fontes
          const productAny = product as any;
          const transaction = productAny.lastTransaction || 
                             (productAny.transactions && productAny.transactions[0]);
          
          if (transaction) {
            console.log('📋 Transação encontrada:', {
              id: transaction.id,
              hasPurchaseToken: !!transaction.purchaseToken,
              hasNativePurchaseToken: !!transaction.nativePurchase?.purchaseToken,
              transactionKeys: Object.keys(transaction),
            });
            
            // O purchaseToken pode estar em diferentes lugares dependendo da versão do plugin
            if (transaction.purchaseToken) {
              purchaseToken = transaction.purchaseToken;
              console.log('✅ Token from transaction.purchaseToken');
            } else if (transaction.nativePurchase?.purchaseToken) {
              purchaseToken = transaction.nativePurchase.purchaseToken;
              console.log('✅ Token from transaction.nativePurchase.purchaseToken');
            } else if (transaction.transactionId) {
              purchaseToken = transaction.transactionId;
              console.log('✅ Token from transaction.transactionId');
            } else if (transaction.id) {
              purchaseToken = transaction.id;
              console.log('⚠️ Using fallback transaction.id as token');
            }
          }
          
          const tier = PRODUCT_ID_TO_TIER[productId];
          if (tier === 'premium_plus') {
            highestTier = 'premium_plus';
            highestProductId = productId;
            break;
          } else if (tier === 'premium' && highestTier !== 'premium_plus') {
            highestTier = 'premium';
            highestProductId = productId;
          } else if (tier === 'no_ads' && highestTier === 'free') {
            highestTier = 'no_ads';
            highestProductId = productId;
          }
        }
      }
      
      console.log('📊 Resultado da verificação:', { highestTier, highestProductId, hasPurchaseToken: !!purchaseToken, tokenPrefix: purchaseToken?.substring(0, 20) });
      
      if (highestTier !== 'free') {
        // Se temos um token real, usar ele
        if (purchaseToken && purchaseToken !== 'restored' && purchaseToken.length > 50) {
          console.log('🔐 Validando com token real:', purchaseToken.substring(0, 30) + '...');
          const success = await this.validatePurchase(highestProductId, purchaseToken, highestTier);
          if (success) {
            return { success: true, tier: highestTier };
          }
          
          // Se validação falhou, tentar recover-subscription
          console.log('🔄 Tentando recover-subscription Edge Function...');
          const recoverSuccess = await this.recoverSubscription(highestProductId, purchaseToken);
          if (recoverSuccess) {
            return { success: true, tier: highestTier };
          }
        }
        
        // Fallback: tentar sincronização manual via Edge Function
        console.log('🔄 Tentando sincronização manual via sync-subscription...');
        const syncSuccess = await this.syncSubscriptionFromBackend(highestProductId, highestTier);
        if (syncSuccess) {
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
   * Tenta recuperar assinatura via Edge Function recover-subscription
   * Útil quando a validação original falhou mas a compra foi confirmada no Google Play
   */
  async recoverSubscription(productId: string, purchaseToken: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ Usuário não autenticado para recover');
        return false;
      }

      console.log('🔄 Chamando recover-subscription Edge Function...');
      
      const response = await supabase.functions.invoke('recover-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          productId,
          purchaseToken,
        },
      });

      if (response.error) {
        console.error('❌ Erro na recover-subscription:', response.error);
        return false;
      }

      // Se o token pertence a outro usuário, não tentar novamente
      if (response.data?.errorCode === 'TOKEN_BELONGS_TO_OTHER_USER') {
        console.log('⚠️ Esta assinatura pertence a outra conta - não será aplicada');
        return false;
      }

      console.log('✅ Recuperação via backend:', response.data);
      return response.data?.success === true;
    } catch (error) {
      console.error('❌ Erro ao recuperar assinatura:', error);
      return false;
    }
  }

  /**
   * Sincroniza assinatura diretamente pelo backend usando productId
   * Fallback quando não temos o purchaseToken disponível
   */
  private async syncSubscriptionFromBackend(productId: string, tier: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ Usuário não autenticado para sync');
        return false;
      }

      console.log('🔄 Chamando sync-subscription Edge Function...');
      
      const response = await supabase.functions.invoke('sync-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          productId,
          tier,
          platform: 'android',
        },
      });

      if (response.error) {
        console.error('❌ Erro na sync-subscription:', response.error);
        return false;
      }

      // Se o token pertence a outro usuário, não tentar novamente
      if (response.data?.errorCode === 'TOKEN_BELONGS_TO_OTHER_USER') {
        console.log('⚠️ Esta assinatura pertence a outra conta - não será aplicada');
        return false;
      }

      console.log('✅ Sincronização via backend:', response.data);
      return response.data?.success === true;
    } catch (error) {
      console.error('❌ Erro ao sincronizar via backend:', error);
      return false;
    }
  }

  /**
   * Abre página de gerenciamento de assinaturas do Google Play
   */
  openSubscriptionManagement(): void {
    const url = 'https://play.google.com/store/account/subscriptions';
    if (this.isNative) {
      // Abrir no navegador do sistema
      window.open(url, '_system');
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * Reseta assinatura para gratuito (apenas desenvolvimento)
   */
  async resetToFree(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier: 'free',
          is_active: true,
          expires_at: null,
          product_id: null,
          purchase_token: null,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'subscription_reset_to_free',
        details: {
          method: 'manual_reset',
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ Assinatura resetada para gratuito');
      return true;
    } catch (error) {
      console.error('❌ Erro ao resetar assinatura:', error);
      return false;
    }
  }

  /**
   * Verifica se a assinatura precisa ser sincronizada e sincroniza automaticamente
   * Chamado ao iniciar o app para garantir que assinaturas renovadas sejam reconhecidas
   * 
   * IMPORTANTE: Também tenta restaurar compras quando o usuário está no tier free,
   * para confirmar transações pendentes que não foram finalizadas anteriormente.
   */
  async checkAndSyncSubscription(): Promise<void> {
    if (!this.isNative) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar assinatura atual no banco
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, expires_at, is_active, updated_at, purchase_token')
        .eq('user_id', user.id)
        .single();

      const currentTier = subscription?.tier || 'free';
      const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
      const now = new Date();
      
      // Lógica para tier free: tentar restaurar compras pendentes
      // (com throttling para não chamar toda vez que abre o app)
      if (currentTier === 'free') {
        const lastCheck = localStorage.getItem('last_restore_check');
        const hoursSinceLastCheck = lastCheck 
          ? (now.getTime() - parseInt(lastCheck)) / (1000 * 60 * 60)
          : Infinity;
        
        // Só verificar a cada 4 horas para não pesar
        if (hoursSinceLastCheck > 4) {
          console.log('🔄 Tier é free - tentando restaurar compras pendentes...');
          localStorage.setItem('last_restore_check', now.getTime().toString());
          
          const result = await this.restorePurchases();
          
          if (result.success) {
            console.log('✅ Compra pendente encontrada e confirmada:', result.tier);
          } else {
            console.log('ℹ️ Nenhuma compra pendente encontrada');
          }
        } else {
          console.log(`ℹ️ Último check de restore há ${hoursSinceLastCheck.toFixed(1)}h - pulando`);
        }
        return;
      }

      // Lógica para tier pago: verificar propriedade do token
      // Se o purchase_token foi limpo (NULL), significa que a assinatura não pertence a este usuário
      if (!subscription?.purchase_token) {
        console.log('⚠️ Tier pago mas sem purchase_token - resetando para free...');
        
        const { error } = await supabase
          .from('subscriptions')
          .update({
            tier: 'free',
            is_active: true,
            expires_at: null,
            product_id: null,
            purchase_token: null,
          })
          .eq('user_id', user.id);
        
        if (!error) {
          console.log('✅ Assinatura resetada para free - token não pertence a este usuário');
        } else {
          console.error('❌ Erro ao resetar assinatura:', error);
        }
        return;
      }

      // Lógica para tier pago com token válido: verificar se precisa sincronizar
      if (expiresAt) {
        const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysUntilExpiry < 3) {
          console.log(`🔄 Assinatura expira em ${daysUntilExpiry.toFixed(1)} dias, sincronizando com Google Play...`);
          
          // Tentar restaurar/sincronizar com Google Play
          const result = await this.restorePurchases();
          
          if (result.success) {
            console.log('✅ Assinatura sincronizada com sucesso:', result.tier);
          } else {
            console.log('⚠️ Não foi possível sincronizar assinatura - pode ter sido cancelada');
          }
        } else {
          console.log(`✅ Assinatura válida por mais ${daysUntilExpiry.toFixed(0)} dias`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar/sincronizar assinatura:', error);
    }
  }
}

export const billingService = new BillingService();
