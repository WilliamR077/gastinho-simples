
## Fix: CORS blocking DELETE on admin-subscriptions

### Causa
Os `corsHeaders` não incluem `Access-Control-Allow-Methods`. O navegador envia um preflight OPTIONS e, ao não encontrar `DELETE` na lista de métodos permitidos, bloqueia a requisição.

### Mudança

| Arquivo | Ação |
|---|---|
| `supabase/functions/admin-subscriptions/index.ts` | Adicionar `Access-Control-Allow-Methods` aos headers CORS |

### Detalhe

Linha 5-9: adicionar ao objeto `corsHeaders`:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
```

Isso resolve o bloqueio CORS para o método DELETE. Redeploy automático.
