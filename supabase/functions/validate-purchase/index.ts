import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
      throw new Error('Não autorizado');
    }

    // Parse do body
    const { productId, purchaseToken, platform, tier: providedTier }: PurchaseValidationRequest = await req.json();

    console.log('📦 Validando compra:', { productId, platform, userId: user.id });

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro ao validar compra:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
): Promise<{ valid: boolean; expiresAt?: string }> {
  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    
    if (serviceAccountJson) {
      // Implementação real com Service Account
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        
        // Obter access token
        const accessToken = await getGoogleAccessToken(serviceAccount);
        
        if (accessToken) {
          // Verificar assinatura no Google Play
          const packageName = 'app.lovable.gastinhosimples';
          const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
          
          const response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('📦 Resposta do Google Play:', data);
            
            // Verificar se a assinatura está ativa
            // paymentState: 0 = pendente, 1 = recebido, 2 = free trial, 3 = deferred
            // expiryTimeMillis: timestamp de expiração
            const isActive = data.paymentState === 1 || data.paymentState === 2;
            const expiresAt = data.expiryTimeMillis 
              ? new Date(parseInt(data.expiryTimeMillis)).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            
            return {
              valid: isActive,
              expiresAt,
            };
          } else {
            const errorData = await response.text();
            console.error('❌ Erro na API do Google Play:', response.status, errorData);
          }
        }
      } catch (parseError) {
        console.error('❌ Erro ao processar Service Account:', parseError);
      }
    }
    
    // Fallback: Validação mock para desenvolvimento
    // IMPORTANTE: Remover em produção ou quando Service Account estiver configurado
    console.warn('⚠️ VALIDAÇÃO MOCK - Service Account não configurado ou erro na validação');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    return {
      valid: true,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('❌ Erro ao validar compra Google Play:', error);
    return { valid: false };
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
      const errorText = await tokenResponse.text();
      console.error('❌ Erro ao obter access token:', errorText);
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
  console.warn('⚠️ Validação App Store não implementada');
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  return {
    valid: true,
    expiresAt: expiresAt.toISOString(),
  };
}
