import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

class AdMobService {
  // Estado interno
  private initialized = false;
  private bannerVisible = false;
  private interstitialReady = false;
  private expenseCount = 0;
  private userIsPremium = false;

  // Configuração
  private readonly SHOW_INTERSTITIAL_AFTER = 3; // Mostrar a cada 3 despesas
  private readonly INTERSTITIAL_DELAY_ON_STARTUP = 2000; // 2 segundos após abrir o app
  private readonly STARTUP_INTERSTITIAL_COOLDOWN = 6 * 60 * 60 * 1000; // 6 horas em ms
  private readonly LAST_STARTUP_INTERSTITIAL_KEY = 'lastStartupInterstitial';

  // IDs das unidades de anúncio (IDs reais do AdMob)
  private readonly BANNER_AD_UNIT_ID = 'ca-app-pub-7994981472093749/7496902553';
  private readonly INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-7994981472093749/5214338233';

  /**
   * Inicializa o AdMob e prepara o primeiro intersticial
   */
  async initialize(): Promise<void> {
    // Verificar se está rodando em plataforma mobile
    if (!Capacitor.isNativePlatform()) {
      console.log('⚠️ AdMob não disponível em plataforma web');
      return;
    }

    // Verificar se usuário é premium (futuro)
    this.userIsPremium = await this.checkPremiumStatus();
    if (this.userIsPremium) {
      console.log('✅ Usuário premium - anúncios desabilitados');
      return;
    }

    try {
      // Inicializar AdMob
      await AdMob.initialize({
        initializeForTesting: false, // Mudar para true durante testes
      });

      console.log('✅ AdMob inicializado com sucesso');
      this.initialized = true;

      // Preparar primeiro intersticial em background
      await this.prepareInterstitial();

    } catch (error) {
      console.error('❌ Erro ao inicializar AdMob:', error);
    }
  }

  /**
   * Exibe banner fixo na parte inferior da tela
   */
  async showBanner(): Promise<void> {
    if (!this.initialized || this.userIsPremium || this.bannerVisible) {
      return;
    }

    try {
      const options: BannerAdOptions = {
        adId: this.BANNER_AD_UNIT_ID,
        adSize: BannerAdSize.BANNER, // 320x50
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false, // Mudar para true durante testes
      };

      await AdMob.showBanner(options);
      this.bannerVisible = true;
      console.log('✅ Banner exibido');

    } catch (error) {
      console.error('❌ Erro ao exibir banner:', error);
    }
  }

  /**
   * Esconde o banner (útil ao navegar para outras páginas)
   */
  async hideBanner(): Promise<void> {
    if (!this.bannerVisible) {
      return;
    }

    try {
      await AdMob.hideBanner();
      this.bannerVisible = false;
      console.log('✅ Banner escondido');
    } catch (error) {
      console.error('❌ Erro ao esconder banner:', error);
    }
  }

  /**
   * Remove completamente o banner
   */
  async removeBanner(): Promise<void> {
    if (!this.bannerVisible) {
      return;
    }

    try {
      await AdMob.removeBanner();
      this.bannerVisible = false;
      console.log('✅ Banner removido');
    } catch (error) {
      console.error('❌ Erro ao remover banner:', error);
    }
  }

  /**
   * Prepara um anúncio intersticial em background
   */
  async prepareInterstitial(): Promise<void> {
    if (!this.initialized || this.userIsPremium) {
      return;
    }

    try {
      await AdMob.prepareInterstitial({
        adId: this.INTERSTITIAL_AD_UNIT_ID,
        isTesting: false, // Mudar para true durante testes
      });

      this.interstitialReady = true;
      console.log('✅ Intersticial preparado');

    } catch (error) {
      console.error('❌ Erro ao preparar intersticial:', error);
      this.interstitialReady = false;
    }
  }

  /**
   * Mostra o intersticial se estiver pronto
   */
  async showInterstitial(): Promise<void> {
    if (!this.initialized || this.userIsPremium || !this.interstitialReady) {
      console.log('⚠️ Intersticial não pode ser exibido:', {
        initialized: this.initialized,
        premium: this.userIsPremium,
        ready: this.interstitialReady,
      });
      return;
    }

    try {
      await AdMob.showInterstitial();
      console.log('✅ Intersticial exibido');
      this.interstitialReady = false;

      // Preparar próximo intersticial em background
      setTimeout(() => {
        this.prepareInterstitial();
      }, 1000);

    } catch (error) {
      console.error('❌ Erro ao exibir intersticial:', error);
      this.interstitialReady = false;
    }
  }

  /**
   * Mostra intersticial de boas-vindas ao abrir o app (com cooldown de 6h)
   */
  async showStartupInterstitial(): Promise<void> {
    // Verificar cooldown
    const lastShown = localStorage.getItem(this.LAST_STARTUP_INTERSTITIAL_KEY);
    const now = Date.now();

    if (lastShown) {
      const timeSinceLastShown = now - parseInt(lastShown);
      if (timeSinceLastShown < this.STARTUP_INTERSTITIAL_COOLDOWN) {
        const hoursRemaining = ((this.STARTUP_INTERSTITIAL_COOLDOWN - timeSinceLastShown) / (60 * 60 * 1000)).toFixed(1);
        console.log(`⏰ Cooldown ativo. Próximo intersticial em ${hoursRemaining}h`);
        return;
      }
    }

    // Mostrar intersticial após delay
    setTimeout(async () => {
      await this.showInterstitial();
      
      // Salvar timestamp
      localStorage.setItem(this.LAST_STARTUP_INTERSTITIAL_KEY, now.toString());
    }, this.INTERSTITIAL_DELAY_ON_STARTUP);
  }

  /**
   * Incrementa contador de despesas e verifica se deve mostrar anúncio
   */
  incrementExpenseCount(): void {
    if (this.userIsPremium) {
      return;
    }

    this.expenseCount++;
    console.log(`📊 Despesas: ${this.expenseCount}/${this.SHOW_INTERSTITIAL_AFTER} - Próximo anúncio em ${this.SHOW_INTERSTITIAL_AFTER - this.expenseCount}`);

    if (this.expenseCount >= this.SHOW_INTERSTITIAL_AFTER) {
      this.showInterstitial();
      this.expenseCount = 0; // Resetar contador
    }
  }

  /**
   * Reseta o contador de despesas
   */
  resetExpenseCount(): void {
    this.expenseCount = 0;
  }

  /**
   * Verifica se usuário tem assinatura premium ativa (no_ads ou premium_plus)
   */
  private async checkPremiumStatus(): Promise<boolean> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      const { data, error } = await supabase.rpc('get_user_subscription_tier', {
        user_id_param: user.id
      });

      if (error) {
        console.error('❌ Erro ao verificar premium:', error);
        return false;
      }

      // Usuário é premium se tier é 'no_ads' ou 'premium_plus' (sem anúncios)
      const isPremium = data === 'no_ads' || data === 'premium_plus';
      console.log(`🎯 Premium Status: ${isPremium ? 'SIM' : 'NÃO'} (Tier: ${data})`);
      
      return isPremium;
    } catch (error) {
      console.error('❌ Erro ao verificar premium:', error);
      return false;
    }
  }

  /**
   * Desabilita anúncios para usuário premium
   */
  async disableAdsForPremium(): Promise<void> {
    this.userIsPremium = true;
    await this.removeBanner();
    console.log('✅ Anúncios desabilitados para usuário premium');
  }

  /**
   * Reabilita anúncios (quando assinatura expirar)
   */
  async enableAds(): Promise<void> {
    this.userIsPremium = false;
    await this.showBanner();
    await this.prepareInterstitial();
    console.log('✅ Anúncios reabilitados');
  }
}

// Exportar instância única (singleton)
export const adMobService = new AdMobService();
