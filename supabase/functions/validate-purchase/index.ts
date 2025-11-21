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
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase
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
    const { productId, purchaseToken, platform }: PurchaseValidationRequest = await req.json();

    console.log('Validando compra:', { productId, platform, userId: user.id });

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

    // Registrar compra no banco de dados (audit log)
    await supabaseClient.from('audit_log').insert({
      user_id: user.id,
      action: 'purchase_validated',
      details: {
        productId,
        platform,
        expiresAt: validationResult.expiresAt,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        expiresAt: validationResult.expiresAt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao validar compra:', error);
    
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
 * IMPORTANTE: Requer configuração de Service Account no Google Cloud Console
 */
async function validateGooglePlayPurchase(
  productId: string,
  purchaseToken: string
): Promise<{ valid: boolean; expiresAt?: string }> {
  try {
    // TODO: Implementar validação real com Google Play Developer API
    // Requer:
    // 1. Service Account configurado no Google Cloud Console
    // 2. API do Google Play Developer habilitada
    // 3. Chave JSON do Service Account armazenada em secrets
    
    // Por enquanto, retorna válido (APENAS PARA TESTE - NÃO USE EM PRODUÇÃO)
    console.warn('⚠️ VALIDAÇÃO MOCK - Implementar Google Play API em produção');
    
    // Calcular data de expiração (30 dias para assinaturas mensais)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    return {
      valid: true,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Erro ao validar compra Google Play:', error);
    return { valid: false };
  }
}

/**
 * Valida compra na App Store usando Apple's App Store Server API
 * IMPORTANTE: Requer configuração de App Store Connect API
 */
async function validateAppStorePurchase(
  receiptData: string
): Promise<{ valid: boolean; expiresAt?: string }> {
  try {
    // TODO: Implementar validação real com App Store Server API
    // Requer:
    // 1. App Store Connect API key configurada
    // 2. Shared Secret da App Store Connect
    
    // Por enquanto, retorna válido (APENAS PARA TESTE - NÃO USE EM PRODUÇÃO)
    console.warn('⚠️ VALIDAÇÃO MOCK - Implementar App Store API em produção');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    return {
      valid: true,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Erro ao validar compra App Store:', error);
    return { valid: false };
  }
}
