import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://gastinho-simples.lovable.app",
  "https://id-preview--a1f2a0b1-38be-4811-8b36-2e341ccca268.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "capacitor://localhost",
  "https://localhost",
]);

function pickOrigin(req: Request): string {
  const o = req.headers.get("origin");
  return o && ALLOWED_ORIGINS.has(o) ? o : "";
}

function buildCorsHeaders(req: Request): Record<string,string> {
  const origin = pickOrigin(req);
  const base =  {
  "Access-Control-Allow-Origin": "__ORIGIN__",
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
  base["Access-Control-Allow-Origin"] = origin;
  base["Vary"] = "Origin";
  return base;
}
// Back-compat default (no origin) for any legacy reference; real usage builds per-request.
const corsHeaders = { "Access-Control-Allow-Origin": "", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" };

interface SyncRequest {
  productId: string;
  tier: string;
  platform: 'android' | 'ios';
}

/**
 * Mapeia product ID para tier da assinatura
 */
const PRODUCT_ID_TO_TIER: Record<string, string> = {
  'app.gastinho.subscription_no_ads_monthly': 'no_ads',
  'app.gastinho.subs_premium_monthly': 'premium',
  'app.gastinho.subs_premium_plus_monthly': 'premium_plus',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: buildCorsHeaders(req) });
  }

  try {
    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar cliente para verificar autenticação do usuário
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
      throw new Error('Não autorizado');
    }

    // Parse do body
    const { productId, tier: providedTier, platform }: SyncRequest = await req.json();

    console.log('sync-subscription: start', { productId, platform, userId: user.id });

    // Determinar o tier baseado no product ID
    const tier = providedTier || PRODUCT_ID_TO_TIER[productId] || 'free';
    
    if (tier === 'free') {
      throw new Error('Product ID inválido');
    }

    // Buscar assinatura atual do usuário no banco
    const { data: currentSub } = await supabaseAdmin
      .from('subscriptions')
      .select('purchase_token, product_id')
      .eq('user_id', user.id)
      .single();

    // Verificar se o purchase_token já pertence a outro usuário (apenas registros Android)
    if (currentSub?.purchase_token) {
      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .eq('purchase_token', currentSub.purchase_token)
        .eq('platform', 'android')
        .neq('user_id', user.id)
        .maybeSingle();

      if (existingSub) {
        console.warn('sync-subscription: token belongs to other user');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Esta assinatura pertence a outra conta.',
            errorCode: 'TOKEN_BELONGS_TO_OTHER_USER',
          }),
          {
            headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }
    }

    // Se temos um purchase_token salvo, usá-lo para verificar com o Google Play
    if (currentSub?.purchase_token && platform === 'android') {
      const validationResult = await validateWithGooglePlay(
        currentSub.product_id || productId,
        currentSub.purchase_token
      );

      if (validationResult.valid) {
        // Atualizar subscription com os dados mais recentes
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            tier: tier,
            is_active: true,
            expires_at: validationResult.expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('❌ Erro ao atualizar subscription:', updateError);
          throw new Error('Erro ao atualizar assinatura');
        }

        // Registrar no audit log
        await supabaseAdmin.from('audit_log').insert({
          user_id: user.id,
          action: 'subscription_synced',
          details: {
            productId: currentSub.product_id || productId,
            tier,
            expiresAt: validationResult.expiresAt,
            method: 'sync_subscription_edge_function',
            syncedAt: new Date().toISOString(),
          },
        });

        console.log('✅ Assinatura sincronizada:', { tier, expiresAt: validationResult.expiresAt });

        return new Response(
          JSON.stringify({
            success: true,
            tier,
            expiresAt: validationResult.expiresAt,
          }),
          {
            headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // Se não temos purchase_token ou validação falhou, registrar falha
    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'subscription_sync_failed',
      details: {
        productId,
        tier,
        reason: 'No valid purchase token or Google Play validation failed',
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Não foi possível sincronizar a assinatura. Tente novamente mais tarde.',
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  } catch (error) {
    console.error('❌ Erro ao sincronizar assinatura:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

/**
 * Valida assinatura no Google Play usando o purchase token salvo
 */
async function validateWithGooglePlay(
  productId: string,
  purchaseToken: string
): Promise<{ valid: boolean; expiresAt?: string }> {
  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    
    if (!serviceAccountJson) {
      console.error('❌ GOOGLE_PLAY_SERVICE_ACCOUNT não configurado');
      return { valid: false };
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // IMPORTANTE: Converter \n literais em quebras de linha reais
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    if (!accessToken) {
      console.error('❌ Não foi possível obter access token');
      return { valid: false };
    }

    const packageName = 'com.gastinhosimples.app';
    const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    
    console.log('🔍 Verificando assinatura no Google Play...');
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('sync-subscription: Play API ok', {
        paymentState: data.paymentState,
        hasExpiry: !!data.expiryTimeMillis,
      });
      
      // Verificar se a assinatura está ativa
      // paymentState: 0 = pendente, 1 = recebido, 2 = free trial, 3 = deferred
      const isActive = (data.paymentState === 1 || data.paymentState === 2) && 
                       (!data.cancelReason || data.cancelReason === 0);
      
      const expiresAt = data.expiryTimeMillis 
        ? new Date(parseInt(data.expiryTimeMillis)).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Verificar se ainda não expirou
      const expiryDate = new Date(expiresAt);
      const now = new Date();
      
      if (expiryDate < now) {
        console.log('⚠️ Assinatura expirada:', expiresAt);
        return { valid: false };
      }
      
      return {
        valid: isActive,
        expiresAt,
      };
    } else {
      console.error('sync-subscription: Play API error status', response.status);
      return { valid: false };
    }
  } catch (error) {
    console.error('❌ Erro ao validar com Google Play:', error);
    return { valid: false };
  }
}

/**
 * Obtém access token do Google usando Service Account
 */
async function getGoogleAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };
    
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      return tokenData.access_token;
    } else {
      console.error('Google token endpoint error');
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao gerar access token:', error);
    return null;
  }
}

/**
 * Converte PEM para formato binário
 */
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
