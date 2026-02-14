
## Plano: Centralizar cards e esconder assinaturas na web

### Mudancas

**1. `src/pages/Subscription.tsx`** (linha 494)
- Mudar `lg:grid-cols-4` para `lg:grid-cols-3` para centralizar os 3 cards corretamente

**2. `src/pages/Account.tsx`** (linhas 290-316)
- Importar `Capacitor` do `@capacitor/core`
- Envolver a secao "Assinatura e Planos" (o Card + Separator abaixo) com uma condicional: so renderizar se `Capacitor.isNativePlatform()` for true
- Na web, o usuario nao vera a opcao "Ver Todos os Planos" nem o card de assinatura

### Comportamento esperado

| Plataforma | Pagina Account | Pagina Subscription |
|------------|---------------|-------------------|
| App (Android) | Mostra card de assinatura + botao "Ver Todos os Planos" | Cards centralizados (3 colunas) |
| Web | Sem secao de assinatura | Ainda acessivel via URL, mas sem link visivel |

### Detalhes tecnicos

No `Account.tsx`, a mudanca seria:

```text
import { Capacitor } from "@capacitor/core";

// No render, envolver linhas 290-318 com:
{Capacitor.isNativePlatform() && (
  <>
    <Card>...</Card>
    <Separator />
  </>
)}
```

No `Subscription.tsx`, a mudanca e simples:
```text
// Linha 494: mudar de
<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
// para
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
```

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Subscription.tsx` | Corrigir grid para 3 colunas |
| `src/pages/Account.tsx` | Esconder secao de assinatura na web |
