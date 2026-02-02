import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function para recuperar assinatura manualmente
 * 
 * Permite ao usuário vincular sua assinatura quando:
 * - A validação original falhou
 * - O purchase_token não foi salvo corretamente
 * - Houve problema de comunicação
 * 
 * Funciona consultando o Google Play com o purchase_token fornecido
 * e atualizando o banco de dados se a assinatura for válida.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de product ID para tier
const PRODUCT_ID_TO_TIER: Record<string, string> = {
  'app.gastinho.subscription_no_ads_monthly': 'no_ads',
  'app.gastinho.subs_premium_monthly': 'premium',
  'app.gastinho.subs_premium_plus_monthly': 'premium_plus',
};

interface RecoverRequest {
  productId: string;
  purchaseToken: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verificar autenticação
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      console.error('❌ Usuário não autenticado');
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { productId, purchaseToken }: RecoverRequest = await req.json();

    console.log('🔄 Tentando recuperar assinatura:', {
      userId: user.id,
      productId,
      purchaseTokenPrefix: purchaseToken?.substring(0, 30),
    });

    // Validar parâmetros
    if (!productId || !purchaseToken || purchaseToken.length < 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Parâmetros inválidos',
          errorCode: 'INVALID_PARAMS',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Consultar Google Play
    const subscriptionDetails = await getSubscriptionFromGooglePlay(productId, purchaseToken);

    if (!subscriptionDetails) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível verificar a assinatura no Google Play',
          errorCode: 'GOOGLE_PLAY_ERROR',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar se assinatura está ativa
    const isActive = subscriptionDetails.paymentState === 1 || subscriptionDetails.paymentState === 2;
    
    if (!isActive) {
      console.log('⚠️ Assinatura não está ativa no Google Play:', {
        paymentState: subscriptionDetails.paymentState,
        cancelReason: subscriptionDetails.cancelReason,
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Esta assinatura não está ativa no Google Play',
          errorCode: 'SUBSCRIPTION_NOT_ACTIVE',
          details: {
            paymentState: subscriptionDetails.paymentState,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const tier = PRODUCT_ID_TO_TIER[productId] || 'premium';
    const expiresAt = subscriptionDetails.expiryTimeMillis 
      ? new Date(parseInt(subscriptionDetails.expiryTimeMillis)).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Atualizar ou criar assinatura no banco
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        tier: tier,
        is_active: true,
        expires_at: expiresAt,
        product_id: productId,
        platform: 'android',
        purchase_token: purchaseToken,
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('❌ Erro ao atualizar assinatura:', upsertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao salvar assinatura',
          errorCode: 'DATABASE_ERROR',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Registrar no audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'subscription_recovered',
      details: {
        productId,
        tier,
        expiresAt,
        method: 'manual_recovery',
        purchaseTokenPrefix: purchaseToken.substring(0, 30),
      },
    });

    console.log('✅ Assinatura recuperada com sucesso:', { tier, expiresAt });

    return new Response(
      JSON.stringify({
        success: true,
        tier,
        expiresAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erro ao recuperar assinatura:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

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
    
    // Converter \n literais em quebras de linha reais
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    if (!accessToken) {
      console.error('❌ Não foi possível obter access token');
      return null;
    }

    const packageName = 'com.gastinhosimples.app';
    const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;
    
    console.log('🔍 Consultando Google Play API...');
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Google Play API response:', {
        paymentState: data.paymentState,
        expiryTimeMillis: data.expiryTimeMillis,
        acknowledgementState: data.acknowledgementState,
      });
      return data;
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
