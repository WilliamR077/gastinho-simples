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

interface PurchaseValidationRequest {
  productId: string;
  purchaseToken: string;
  platform: 'android' | 'ios';
  tier?: string;
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
    // Criar cliente Supabase com service role para poder atualizar subscriptions
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
      console.error('❌ Usuário não autenticado - Authorization header inválido ou ausente');
      throw new Error('Não autorizado');
    }

    // Parse do body
    const { productId, purchaseToken, platform, tier: providedTier }: PurchaseValidationRequest = await req.json();

    console.log('validate-purchase: received', {
      productId,
      platform,
      userId: user.id,
      tokenLen: purchaseToken?.length || 0,
    });

    // Verificar se temos um purchaseToken válido
    if (!purchaseToken || purchaseToken === 'restored' || purchaseToken.length < 50) {
      console.warn('validate-purchase: invalid token');
      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          error: 'purchaseToken inválido',
          errorCode: 'INVALID_PURCHASE_TOKEN',
        }),
        {
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Determinar o tier baseado no product ID
    const tier = providedTier || PRODUCT_ID_TO_TIER[productId] || 'free';
    
    if (tier === 'free') {
      throw new Error('Product ID inválido');
    }

    // Validar compra dependendo da plataforma
    let validationResult;

    if (platform === 'android') {
      validationResult = await validateGooglePlayPurchase(productId, purchaseToken);
    } else if (platform === 'ios') {
      validationResult = await validateAppStorePurchase(purchaseToken);
    } else {
      throw new Error('Plataforma não suportada');
    }

    if (!validationResult.valid) {
      throw new Error('Compra inválida');
    }

    // Verificar se o purchase_token já pertence a outro usuário (apenas registros Android)
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('purchase_token', purchaseToken)
      .eq('platform', 'android')
      .neq('user_id', user.id)
      .maybeSingle();

    if (existingSub) {
      console.warn('validate-purchase: token belongs to other user');
      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          error: 'Esta assinatura pertence a outra conta.',
          errorCode: 'TOKEN_BELONGS_TO_OTHER_USER',
        }),
        {
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Atualizar subscription no banco de dados
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        tier: tier,
        is_active: true,
        expires_at: validationResult.expiresAt,
        product_id: productId,
        platform: platform,
        purchase_token: purchaseToken,
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('❌ Erro ao atualizar subscription:', upsertError);
      throw new Error('Erro ao atualizar assinatura');
    }

    // Registrar compra no audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'purchase_validated',
      details: {
        productId,
        platform,
        tier,
        expiresAt: validationResult.expiresAt,
        validatedAt: new Date().toISOString(),
      },
    });

    console.log('✅ Compra validada e subscription atualizada:', { tier, expiresAt: validationResult.expiresAt });

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        tier,
        expiresAt: validationResult.expiresAt,
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro ao validar compra:', error);
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
 * Valida compra no Google Play usando Google Play Developer API
 * 
 * Para produção completa, implementar:
 * 1. Carregar credenciais do Service Account
 * 2. Obter access token via OAuth2
 * 3. Chamar API de verificação de assinaturas
 */
async function validateGooglePlayPurchase(
  productId: string,
  purchaseToken: string
): Promise<{ valid: boolean; expiresAt?: string; errorCode?: string; details?: any }> {
  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');

    if (!serviceAccountJson) {
      console.error('GOOGLE_PLAY_SERVICE_ACCOUNT not configured');
      return { valid: false, errorCode: 'SERVICE_ACCOUNT_NOT_CONFIGURED' };
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);

      // IMPORTANTE: Converter \n literais em quebras de linha reais
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      // Obter access token
      const accessToken = await getGoogleAccessToken(serviceAccount);

      if (!accessToken) {
        console.error('Failed to obtain Google access token');
        return { valid: false, errorCode: 'ACCESS_TOKEN_FAILED' };
      }

      // Verificar assinatura no Google Play
      const packageName = 'com.gastinhosimples.app';
      const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const isActive = data.paymentState === 1 || data.paymentState === 2;
        const expiresAt = data.expiryTimeMillis
          ? new Date(parseInt(data.expiryTimeMillis)).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        console.log('validate-purchase: Play API ok', { isActive });

        return {
          valid: isActive,
          expiresAt,
          details: {
            paymentState: data.paymentState,
            acknowledgementState: data.acknowledgementState,
            autoRenewing: data.autoRenewing,
          },
        };
      } else {
        console.error('validate-purchase: Play API error status', response.status);
        return {
          valid: false,
          errorCode: `GOOGLE_PLAY_API_ERROR_${response.status}`,
        };
      }
    } catch {
      console.error('validate-purchase: service account parse error');
      return { valid: false, errorCode: 'SERVICE_ACCOUNT_PARSE_ERROR' };
    }
  } catch {
    console.error('validate-purchase: validation failed');
    return { valid: false, errorCode: 'VALIDATION_ERROR' };
  }
}

/**
 * Obtém access token do Google usando Service Account
 */
async function getGoogleAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    // Criar JWT para autenticação
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
    
    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    // Assinar com a chave privada
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    // Importar a chave privada
    const privateKey = serviceAccount.private_key;
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToBinary(privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Assinar
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signatureInput)
    );
    
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwt = `${signatureInput}.${encodedSignature}`;
    
    // Trocar JWT por access token
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

/**
 * Valida compra na App Store
 * TODO: Implementar quando necessário para iOS
 */
async function validateAppStorePurchase(
  receiptData: string
): Promise<{ valid: boolean; expiresAt?: string }> {
  // No mock validation - App Store validation must be properly implemented
  console.error('❌ App Store validation not implemented - rejecting purchase');
  return { valid: false };
}
