import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

export class FirebaseNotificationService {
  private static instance: FirebaseNotificationService;
  private fcmToken: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): FirebaseNotificationService {
    if (!FirebaseNotificationService.instance) {
      FirebaseNotificationService.instance = new FirebaseNotificationService();
    }
    return FirebaseNotificationService.instance;
  }

  /**
   * Inicializa o serviço de notificações Firebase
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Firebase Messaging já inicializado');
      return;
    }

    // Verificar se está rodando em plataforma nativa (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      console.warn('Firebase Messaging não está disponível na web');
      return;
    }

    try {
      console.log('Inicializando Firebase Messaging...');
      
      // Requisitar permissões
      const permission = await this.requestPermission();
      if (!permission) {
        console.warn('Permissão de notificação negada');
        return;
      }

      // Obter FCM Token
      await this.getFCMToken();

      // Configurar listeners
      this.setupListeners();

      this.isInitialized = true;
      console.log('Firebase Messaging inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar Firebase Messaging:', error);
      toast({
        title: 'Erro nas Notificações',
        description: 'Não foi possível configurar as notificações push.',
        variant: 'destructive',
      });
    }
  }

  /**
   * Requisita permissão para notificações
   */
  private async requestPermission(): Promise<boolean> {
    try {
      const result = await FirebaseMessaging.requestPermissions();
      console.log('Permissões de notificação:', result.receive);
      return result.receive === 'granted';
    } catch (error) {
      console.error('Erro ao requisitar permissões:', error);
      return false;
    }
  }

  /**
   * Obtém o FCM Token e salva no Supabase
   */
  async getFCMToken(): Promise<string | null> {
    try {
      const result = await FirebaseMessaging.getToken();
      this.fcmToken = result.token;
      console.log('FCM Token obtido:', this.fcmToken);

      // Salvar token no Supabase
      if (this.fcmToken) {
        await this.saveFCMToken(this.fcmToken);
      }

      return this.fcmToken;
    } catch (error) {
      console.error('Erro ao obter FCM Token:', error);
      return null;
    }
  }

  /**
   * Salva o FCM Token no Supabase
   */
  private async saveFCMToken(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('Usuário não autenticado, não é possível salvar FCM token');
        return;
      }

      // Obter informações do dispositivo
      const deviceInfo = {
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
      };

      // Inserir ou atualizar token (upsert)
      const { error } = await supabase
        .from('user_fcm_tokens')
        .upsert(
          {
            user_id: user.id,
            fcm_token: token,
            device_info: deviceInfo,
          },
          {
            onConflict: 'fcm_token',
          }
        );

      if (error) {
        console.error('Erro ao salvar FCM token:', error);
      } else {
        console.log('FCM token salvo no Supabase com sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar FCM token:', error);
    }
  }

  /**
   * Configura listeners para notificações
   */
  private setupListeners(): void {
    // Notificação recebida quando o app está em foreground
    FirebaseMessaging.addListener('notificationReceived', (notification) => {
      console.log('Notificação recebida (foreground):', notification);
      toast({
        title: notification.notification?.title || 'Nova Notificação',
        description: notification.notification?.body || '',
      });
    });

    // Notificação clicada (app em background ou fechado)
    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      console.log('Notificação clicada:', action);
      // Aqui você pode navegar para uma página específica
      // Exemplo: navigate('/recurring-expenses')
    });

    // Token atualizado (quando o Firebase gera um novo token)
    FirebaseMessaging.addListener('tokenReceived', async (event) => {
      console.log('FCM Token atualizado:', event.token);
      this.fcmToken = event.token;
      await this.saveFCMToken(event.token);
    });
  }

  /**
   * Remove o FCM Token do Supabase (ex: ao fazer logout)
   */
  async removeFCMToken(): Promise<void> {
    try {
      if (!this.fcmToken) return;

      const { error } = await supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('fcm_token', this.fcmToken);

      if (error) {
        console.error('Erro ao remover FCM token:', error);
      } else {
        console.log('FCM token removido do Supabase');
        this.fcmToken = null;
      }
    } catch (error) {
      console.error('Erro ao remover FCM token:', error);
    }
  }

  /**
   * Retorna o FCM Token atual
   */
  getCurrentToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Verifica se as notificações estão habilitadas
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const result = await FirebaseMessaging.checkPermissions();
      return result.receive === 'granted';
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  }
}

// Exportar instância singleton
export const firebaseNotificationService = FirebaseNotificationService.getInstance();
