

## Fix: admin-notifications 500 error

### Causa raiz
A função `admin-notifications` usa `btoa()` manual para criar o JWT do Firebase, mas o padrão JWT exige **base64url** (não base64 padrão). A função `send-notification` já funciona corretamente porque usa a biblioteca `djwt`.

### Mudança

| Arquivo | Ação |
|---|---|
| `supabase/functions/admin-notifications/index.ts` | Substituir o `getAccessToken()` manual por implementação usando `djwt` (mesmo padrão de `send-notification`) |

### Detalhe

Substituir a função `getAccessToken()` (linhas 40-89) para usar `djwt`:

1. Importar `create` e `getNumericDate` de `https://deno.land/x/djwt@v3.0.1/mod.ts`
2. Importar a private key como `CryptoKey` via `crypto.subtle.importKey`
3. Usar `create()` do djwt para gerar o JWT assinado corretamente em base64url
4. Adicionar cache do access token (como em `send-notification`)
5. Tratar `\\n` na private key (`replace(/\\n/g, '\n')`)

Essencialmente copiar o padrão já comprovado de `send-notification/index.ts`.

