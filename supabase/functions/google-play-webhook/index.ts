import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Google Play Real-time Developer Notifications (RTDN) Webhook
 * 
 * Recebe notificações do Google Play via Cloud Pub/Sub sobre:
 * - Renovações de assinatura
 * - Cancelamentos
 * - Expirações
 * - Recuperação de pagamento
 * - etc.
 * 
 * Configuração necessária no Google Play Console:
 * 1. Ir em Monetization setup > Real-time developer notifications
 * 2. Criar um topic no Google Cloud Pub/Sub
 * 3. Criar uma subscription push apontando para este endpoint
 * 4. URL: https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/google-play-webhook
 */

// Tipos de notificação de assinatura do Google Play
const SUBSCRIPTION_NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',      // Assinatura foi recuperada após falha de pagamento
  2: 'SUBSCRIPTION_RENEWED',        // Assinatura foi renovada
  3: 'SUBSCRIPTION_CANCELED',       // Assinatura foi cancelada (voluntária ou involuntária)
  4: 'SUBSCRIPTION_PURCHASED',      // Nova assinatura comprada
  5: 'SUBSCRIPTION_ON_HOLD',        // Assinatura em espera (problema de pagamento)
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD', // Assinatura em período de graça
  7: 'SUBSCRIPTION_RESTARTED',      // Usuário reativou assinatura cancelada
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED', // Usuário aceitou mudança de preço
  9: 'SUBSCRIPTION_DEFERRED',       // Renovação foi adiada
  10: 'SUBSCRIPTION_PAUSED',        // Assinatura foi pausada
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED', // Cronograma de pausa mudou
  12: 'SUBSCRIPTION_REVOKED',       // Assinatura foi revogada
  13: 'SUBSCRIPTION_EXPIRED',       // Assinatura expirou
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED', // Compra pendente foi cancelada
};

// Mapeamento de product ID para tier
const PRODUCT_ID_TO_TIER: Record<string, string> = {
  'app.gastinho.subscription_no_ads_monthly': 'no_ads',
  'app.gastinho.subs_premium_monthly': 'premium',
  'app.gastinho.subs_premium_plus_monthly': 'premium_plus',
};

interface CloudPubSubMessage {
  message: {
    data: string; // Base64 encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface DeveloperNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
  testNotification?: {
    version: string;
  };
}

serve(async (req) => {
  // Só aceitar POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body: CloudPubSubMessage = await req.json();
    
    // Decodificar mensagem do Pub/Sub (Base64 -> JSON)
    const messageData = atob(body.message.data);
    const notification: DeveloperNotification = JSON.parse(messageData);
    
    console.log('📬 Notificação recebida:', {
      messageId: body.message.messageId,
      packageName: notification.packageName,
      eventTime: notification.eventTimeMillis,
    });

    // Verificar se é notificação de teste
    if (notification.testNotification) {
      console.log('🧪 Notificação de teste recebida - configuração OK!');
      
      await supabaseAdmin.from('audit_log').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user
        action: 'google_play_test_notification',
        details: {
          messageId: body.message.messageId,
          receivedAt: new Date().toISOString(),
        },
      });
      
      return new Response('OK', { status: 200 });
    }

    // Processar notificação de assinatura
    if (notification.subscriptionNotification) {
      const subNotification = notification.subscriptionNotification;
      const notificationType = SUBSCRIPTION_NOTIFICATION_TYPES[subNotification.notificationType] || 'UNKNOWN';
      
      console.log('📦 Notificação de assinatura:', {
        type: notificationType,
        typeCode: subNotification.notificationType,
        subscriptionId: subNotification.subscriptionId,
        purchaseToken: subNotification.purchaseToken?.substring(0, 20) + '...',
      });

      // Buscar assinatura pelo purchase_token
      const { data: subscription, error: findError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('purchase_token', subNotification.purchaseToken)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ Erro ao buscar assinatura:', findError);
      }

      // Processar baseado no tipo de notificação
      switch (subNotification.notificationType) {
        case 2: // SUBSCRIPTION_RENEWED
        case 1: // SUBSCRIPTION_RECOVERED
        case 7: // SUBSCRIPTION_RESTARTED
          await handleSubscriptionRenewal(
            supabaseAdmin,
            subNotification.purchaseToken,
            subNotification.subscriptionId,
            subscription,
            notificationType
          );
          break;

        case 3:  // SUBSCRIPTION_CANCELED
        case 12: // SUBSCRIPTION_REVOKED
        case 13: // SUBSCRIPTION_EXPIRED
          await handleSubscriptionCancellation(
            supabaseAdmin,
            subNotification.purchaseToken,
            subscription,
            notificationType
          );
          break;

        case 5: // SUBSCRIPTION_ON_HOLD
        case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
          await handleSubscriptionGracePeriod(
            supabaseAdmin,
            subscription,
            notificationType
          );
          break;

        default:
          console.log(`ℹ️ Notificação não processada: ${notificationType}`);
      }

      // Registrar no audit log
      await supabaseAdmin.from('audit_log').insert({
        user_id: subscription?.user_id || '00000000-0000-0000-0000-000000000000',
        action: `google_play_${notificationType.toLowerCase()}`,
        details: {
          messageId: body.message.messageId,
          subscriptionId: subNotification.subscriptionId,
          notificationType,
          purchaseTokenPrefix: subNotification.purchaseToken?.substring(0, 20),
          processedAt: new Date().toISOString(),
        },
      });
    }

    // Sempre retornar 200 para o Pub/Sub não reenviar
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    
    // Ainda retornar 200 para evitar retentativas infinitas
    // Mas logar o erro para investigação
    try {
      await supabaseAdmin.from('audit_log').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        action: 'google_play_webhook_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.error('❌ Erro ao logar erro:', logError);
    }
    
    return new Response('OK', { status: 200 });
  }
});

/**
 * Processa renovação/recuperação de assinatura
 */
async function handleSubscriptionRenewal(
  supabase: any,
  purchaseToken: string,
  subscriptionId: string,
  existingSubscription: any,
  notificationType: string
) {
  console.log(`🔄 Processando ${notificationType}...`);
  
  try {
    // Obter detalhes atualizados da assinatura no Google Play
    const subscriptionDetails = await getSubscriptionFromGooglePlay(subscriptionId, purchaseToken);
    
    if (!subscriptionDetails) {
      console.error('❌ Não foi possível obter detalhes da assinatura no Google Play');
      return;
    }

    const tier = PRODUCT_ID_TO_TIER[subscriptionId] || 'premium';
    const newExpiresAt = subscriptionDetails.expiryTimeMillis 
      ? new Date(parseInt(subscriptionDetails.expiryTimeMillis)).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (existingSubscription) {
      // Atualizar assinatura existente
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier,
          is_active: true,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id);

      if (error) {
        console.error('❌ Erro ao atualizar assinatura:', error);
      } else {
        console.log(`✅ Assinatura renovada: ${tier} até ${newExpiresAt}`);
      }
    } else {
      console.log('⚠️ Assinatura não encontrada pelo purchase_token - pode ser primeira compra via webhook');
    }
  } catch (error) {
    console.error('❌ Erro ao processar renovação:', error);
  }
}

/**
 * Processa cancelamento/expiração de assinatura
 */
async function handleSubscriptionCancellation(
  supabase: any,
  purchaseToken: string,
  existingSubscription: any,
  notificationType: string
) {
  console.log(`❌ Processando ${notificationType}...`);
  
  if (existingSubscription) {
    // Para CANCELED, a assinatura ainda pode estar ativa até expirar
    // Para EXPIRED/REVOKED, desativar imediatamente
    const shouldDeactivate = notificationType === 'SUBSCRIPTION_REVOKED' || 
                             notificationType === 'SUBSCRIPTION_EXPIRED';

    if (shouldDeactivate) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier: 'free',
          is_active: true, // Manter ativo, só mudar para free
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id);

      if (error) {
        console.error('❌ Erro ao desativar assinatura:', error);
      } else {
        console.log('✅ Assinatura desativada para free');
      }
    } else {
      console.log('ℹ️ Assinatura cancelada mas ainda ativa até expiração');
    }
  }
}

/**
 * Processa assinatura em período de graça
 */
async function handleSubscriptionGracePeriod(
  supabase: any,
  existingSubscription: any,
  notificationType: string
) {
  console.log(`⏳ Processando ${notificationType}...`);
  
  // Durante grace period, manter a assinatura ativa
  // Podemos adicionar um flag ou enviar notificação para o usuário
  if (existingSubscription) {
    console.log('ℹ️ Usuário em período de graça - mantendo assinatura ativa');
    // TODO: Enviar push notification avisando sobre problema de pagamento
  }
}

/**
 * Obtém detalhes da assinatura diretamente do Google Play
 */
async function getSubscriptionFromGooglePlay(
  subscriptionId: string,
  purchaseToken: string
): Promise<any> {
  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    
    if (!serviceAccountJson) {
      console.error('❌ GOOGLE_PLAY_SERVICE_ACCOUNT não configurado');
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    if (!accessToken) {
      console.error('❌ Não foi possível obter access token');
      return null;
    }

    const packageName = 'com.gastinhosimples.app';
    const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorText = await response.text();
      console.error('❌ Erro na API do Google Play:', response.status, errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao consultar Google Play:', error);
    return null;
  }
}

/**
 * Obtém access token do Google usando Service Account
 */
async function getGoogleAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const privateKey = serviceAccount.private_key;
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToBinary(privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signatureInput)
    );
    
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwt = `${signatureInput}.${encodedSignature}`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      return tokenData.access_token;
    } else {
      const errorText = await tokenResponse.text();
      console.error('❌ Erro ao obter access token:', errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao gerar access token:', error);
    return null;
  }
}

function pemToBinary(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
