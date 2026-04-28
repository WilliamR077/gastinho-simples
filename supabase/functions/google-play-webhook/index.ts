import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyGoogleOidc } from "../_shared/google-oidc.ts";
import { maskToken } from "../_shared/mask.ts";

/**
 * Google Play Real-time Developer Notifications (RTDN) Webhook
 *
 * SECURITY (A1): every request is authenticated via OIDC token issued by
 * Google Cloud Pub/Sub Push Subscription with "Authentication" enabled.
 * Requests without a valid Bearer JWT signed by Google for the expected
 * audience and service account are rejected with 401.
 *
 * Configuração necessária:
 * 1. Pub/Sub Push Subscription com Authentication habilitada
 *    - Service account: gastinho-billing@gastinho-simples.iam.gserviceaccount.com
 *    - Audience: https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/google-play-webhook
 * 2. Conceder roles/iam.serviceAccountTokenCreator à SA do Pub/Sub
 *    (service-<PROJECT_NUMBER>@gcp-sa-pubsub.iam.gserviceaccount.com)
 * 3. Google Play Console → RTDN → topic apontando para essa subscription
 */

const EXPECTED_AUDIENCE = 'https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/google-play-webhook';
const EXPECTED_OIDC_EMAIL = 'gastinho-billing@gastinho-simples.iam.gserviceaccount.com';
const EXPECTED_PACKAGE_NAME = 'com.gastinhosimples.app';

const SUBSCRIPTION_NOTIFICATION_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
  20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
};

const PRODUCT_ID_TO_TIER: Record<string, string> = {
  'app.gastinho.subscription_no_ads_monthly': 'no_ads',
  'app.gastinho.subs_premium_monthly': 'premium',
  'app.gastinho.subs_premium_plus_monthly': 'premium_plus',
};

interface CloudPubSubMessage {
  message: { data: string; messageId: string; publishTime: string };
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
  testNotification?: { version: string };
}

function plainResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return plainResponse(405, 'Method not allowed');
  }

  // 1) Verificar OIDC ANTES de qualquer processamento ou leitura do body
  try {
    await verifyGoogleOidc(req, {
      expectedAudience: EXPECTED_AUDIENCE,
      expectedEmail: EXPECTED_OIDC_EMAIL,
    });
  } catch (err) {
    const reason = (err as Error).message || 'OIDC_UNKNOWN';
    console.warn('webhook auth rejected:', reason);
    return plainResponse(401, 'Unauthorized');
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let body: CloudPubSubMessage;
  try {
    body = await req.json();
  } catch {
    // Malformed body — ack to Pub/Sub to avoid retries
    return plainResponse(200, 'OK');
  }

  try {
    const messageData = atob(body.message.data);
    const notification: DeveloperNotification = JSON.parse(messageData);

    console.log('webhook received:', {
      messageId: body.message.messageId,
      packageName: notification.packageName,
      eventTime: notification.eventTimeMillis,
    });

    // 2) Validar packageName
    if (notification.packageName && notification.packageName !== EXPECTED_PACKAGE_NAME) {
      console.warn('webhook rejected: bad packageName');
      return plainResponse(403, 'Forbidden');
    }

    // Test notification
    if (notification.testNotification) {
      console.log('webhook test notification ok');
      await supabaseAdmin.from('audit_log').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        action: 'google_play_test_notification',
        details: {
          messageId: body.message.messageId,
          receivedAt: new Date().toISOString(),
        },
      });
      return plainResponse(200, 'OK');
    }

    if (notification.subscriptionNotification) {
      const subNotification = notification.subscriptionNotification;
      const notificationType =
        SUBSCRIPTION_NOTIFICATION_TYPES[subNotification.notificationType] || 'UNKNOWN';

      console.log('webhook subscription event:', {
        type: notificationType,
        typeCode: subNotification.notificationType,
        subscriptionId: subNotification.subscriptionId,
        purchaseToken: maskToken(subNotification.purchaseToken),
      });

      // Buscar assinatura pelo purchase_token
      let subscription: any = null;
      const { data: foundSubscription, error: findError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('purchase_token', subNotification.purchaseToken)
        .eq('platform', 'android')
        .maybeSingle();

      if (findError) {
        console.error('subscription lookup error');
      }

      subscription = foundSubscription;

      if (!subscription) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: recentSubscriptions, error: recentError } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('product_id', subNotification.subscriptionId)
          .is('purchase_token', null)
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentError) {
          console.error('recent subscription lookup error');
        } else if (recentSubscriptions && recentSubscriptions.length > 0) {
          subscription = recentSubscriptions[0];
          console.log('linking purchase_token to recent subscription');

          const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update({
              purchase_token: subNotification.purchaseToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.id);

          if (updateError) console.error('purchase_token link failed');
        } else {
          console.log('no subscription to link');
        }
      }

      switch (subNotification.notificationType) {
        case 4:
          await handleNewPurchase(
            supabaseAdmin,
            subNotification.purchaseToken,
            subNotification.subscriptionId,
            subscription,
            notificationType
          );
          break;
        case 2:
        case 1:
        case 7:
          await handleSubscriptionRenewal(
            supabaseAdmin,
            subNotification.purchaseToken,
            subNotification.subscriptionId,
            subscription,
            notificationType
          );
          break;
        case 3:
        case 12:
        case 13:
          await handleSubscriptionCancellation(
            supabaseAdmin,
            subNotification.purchaseToken,
            subscription,
            notificationType
          );
          break;
        case 5:
        case 6:
          await handleSubscriptionGracePeriod(supabaseAdmin, subscription, notificationType);
          break;
        default:
          console.log('webhook event not handled:', notificationType);
      }

      await supabaseAdmin.from('audit_log').insert({
        user_id: subscription?.user_id || '00000000-0000-0000-0000-000000000000',
        action: `google_play_${notificationType.toLowerCase()}`,
        details: {
          messageId: body.message.messageId,
          subscriptionId: subNotification.subscriptionId,
          notificationType,
          purchaseTokenMasked: maskToken(subNotification.purchaseToken),
          foundUser: !!subscription?.user_id,
          processedAt: new Date().toISOString(),
        },
      });
    }

    return plainResponse(200, 'OK');
  } catch (error) {
    console.error('webhook processing error:', (error as Error).message);
    try {
      await supabaseAdmin.from('audit_log').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        action: 'google_play_webhook_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          receivedAt: new Date().toISOString(),
        },
      });
    } catch {
      // ignore
    }
    return plainResponse(200, 'OK');
  }
});

async function handleNewPurchase(
  supabase: any,
  purchaseToken: string,
  subscriptionId: string,
  existingSubscription: any,
  notificationType: string
) {
  console.log('processing:', notificationType);
  try {
    const subscriptionDetails = await getSubscriptionFromGooglePlay(subscriptionId, purchaseToken);
    if (!subscriptionDetails) {
      console.error('Play API returned no details');
      return;
    }
    const tier = PRODUCT_ID_TO_TIER[subscriptionId] || 'premium';
    const newExpiresAt = subscriptionDetails.expiryTimeMillis
      ? new Date(parseInt(subscriptionDetails.expiryTimeMillis)).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (existingSubscription) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier,
          is_active: true,
          expires_at: newExpiresAt,
          purchase_token: purchaseToken,
          product_id: subscriptionId,
          platform: 'android',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id);
      if (error) console.error('subscription update failed');
      else console.log('subscription activated:', { tier });
    } else {
      console.log('webhook purchase without linkable user');
    }
  } catch {
    console.error('handleNewPurchase failed');
  }
}

async function handleSubscriptionRenewal(
  supabase: any,
  purchaseToken: string,
  subscriptionId: string,
  existingSubscription: any,
  notificationType: string
) {
  console.log('processing:', notificationType);
  try {
    const subscriptionDetails = await getSubscriptionFromGooglePlay(subscriptionId, purchaseToken);
    if (!subscriptionDetails) {
      console.error('Play API returned no details');
      return;
    }
    const tier = PRODUCT_ID_TO_TIER[subscriptionId] || 'premium';
    const newExpiresAt = subscriptionDetails.expiryTimeMillis
      ? new Date(parseInt(subscriptionDetails.expiryTimeMillis)).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (existingSubscription) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier,
          is_active: true,
          expires_at: newExpiresAt,
          purchase_token: purchaseToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id);
      if (error) console.error('subscription update failed');
      else console.log('subscription renewed:', { tier });
    } else {
      console.log('renewal without matching subscription');
    }
  } catch {
    console.error('handleSubscriptionRenewal failed');
  }
}

async function handleSubscriptionCancellation(
  supabase: any,
  _purchaseToken: string,
  existingSubscription: any,
  notificationType: string
) {
  console.log('processing:', notificationType);
  if (existingSubscription) {
    const shouldDeactivate =
      notificationType === 'SUBSCRIPTION_REVOKED' || notificationType === 'SUBSCRIPTION_EXPIRED';
    if (shouldDeactivate) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier: 'free',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id);
      if (error) console.error('subscription deactivation failed');
      else console.log('subscription set to free');
    } else {
      console.log('canceled but still active until expiration');
    }
  }
}

async function handleSubscriptionGracePeriod(
  _supabase: any,
  existingSubscription: any,
  notificationType: string
) {
  console.log('processing:', notificationType);
  if (existingSubscription) {
    console.log('user in grace period');
  }
}

async function getSubscriptionFromGooglePlay(
  subscriptionId: string,
  purchaseToken: string
): Promise<any> {
  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      console.error('GOOGLE_PLAY_SERVICE_ACCOUNT not configured');
      return null;
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    const accessToken = await getGoogleAccessToken(serviceAccount);
    if (!accessToken) {
      console.error('Play access token fetch failed');
      return null;
    }
    const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${EXPECTED_PACKAGE_NAME}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) return await response.json();
    console.error('Play API error status:', response.status);
    return null;
  } catch {
    console.error('Play API call failed');
    return null;
  }
}

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
    const encodedHeader = btoa(JSON.stringify(header))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToBinary(serviceAccount.private_key),
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
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const jwt = `${signatureInput}.${encodedSignature}`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      return tokenData.access_token;
    }
    console.error('Google token endpoint error');
    return null;
  } catch {
    console.error('access token generation failed');
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
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
