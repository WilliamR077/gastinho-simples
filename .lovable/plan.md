

## Plano: Corrigir Login com Google no App Android

### Problema identificado
O login com Google nao funciona no app porque o Supabase usa o fluxo **PKCE** por padrao. Nesse fluxo, a URL de retorno contem um parametro `code` (e nao `access_token`/`refresh_token` como o codigo atual espera). O codigo precisa trocar esse `code` por uma sessao usando `exchangeCodeForSession()`.

### O que vamos corrigir

**1. Corrigir o handler de deep link no `src/App.tsx`**
O listener `appUrlOpen` atualmente procura `access_token` e `refresh_token` na URL, mas o Supabase envia um `code`. Vamos atualizar para:
- Extrair o parametro `code` da URL de retorno
- Chamar `supabase.auth.exchangeCodeForSession(code)` para obter a sessao
- Manter compatibilidade com o fluxo antigo (caso tokens venham direto)

**2. Sobre abrir no proprio app (sem ir pro navegador)**
Infelizmente, o fluxo OAuth do Google **exige** abrir um navegador externo por questoes de seguranca -- o Google nao permite que apps mostrem a tela de login dentro de um WebView embutido (e uma regra do Google). Porem, no Android, o Capacitor ja usa **Chrome Custom Tabs**, que e uma aba do Chrome que aparece "por cima" do app (sem sair completamente dele). O comportamento atual ja deveria ser esse. Se esta abrindo o Chrome completo, pode ser um problema de configuracao do `launchMode` -- que ja esta como `singleTask`, entao esta correto.

### Detalhes tecnicos

**Arquivo: `src/App.tsx`** - Atualizar o listener de deep link:

```text
CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
  // PKCE flow: Supabase retorna ?code=xxx
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Erro ao trocar code por sessao:', error);
    }
    return;
  }

  // Fallback: fluxo implicit (access_token no hash)
  const hashPart = url.includes('#') ? url.split('#')[1] : null;
  if (hashPart) {
    const params = new URLSearchParams(hashPart);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }
});
```

**Arquivo: `src/integrations/supabase/client.ts`** - Garantir que o cliente Supabase esta configurado para detectar sessao na URL e usar PKCE:

```text
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});
```

### Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Corrigir listener para usar `exchangeCodeForSession(code)` em vez de procurar tokens direto |
| `src/integrations/supabase/client.ts` | Adicionar `flowType: 'pkce'` e `detectSessionInUrl: true` |

### Apos as mudancas
1. Faca `git pull`
2. Rode `npx cap sync`
3. Rode `npx cap run android`
4. Teste o login com Google -- agora deve voltar ao app e logar automaticamente

