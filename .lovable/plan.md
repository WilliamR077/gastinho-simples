

## Plano: Ajuste do FAB e truncamento de método

Apenas UI/posicionamento — sem alterar lógica, dados ou rotas.

---

### 1. FAB — reposicionar para não sobrepor conteúdo

**Arquivo: `src/components/floating-action-button.tsx`**

- Linha 37: trocar `bottom-20` por `bottom-24` (96px, mais afastado da borda inferior, respeitando safe-area)
- Adicionar `pb-safe` via `safe-area-inset-bottom` se disponível (Capacitor): `bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)]`

**Arquivo: `src/pages/Index.tsx`**

- Linha 1486: trocar `pb-36` por `pb-44` (176px), garantindo que o último item fique 100% visível com o FAB em `bottom-24` + margem

### 2. Método de pagamento — formato curto e consistente

Criar helper para abreviar nome do cartão e formatar como `Crédito • BB` em vez de `Crédito - Banco do Brasil`.

**Arquivo: `src/components/expense-list.tsx`**

- Linha 109: substituir `const methodLabel = cardName ? \`${config.label} - ${cardName}\` : config.label;` por:
```ts
const shortCardName = cardName 
  ? cardName.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 3)
  : null;
const methodLabel = shortCardName 
  ? `${config.label} • ${shortCardName}` 
  : config.label;
```
Isso transforma "Banco do Brasil" → "BDB" (3 chars max), "Nubank" → "N", "Inter" → "I". Formato final: `Crédito • BDB`, `PIX`.

Alternativa mais legível (preferida): usar as 2-3 primeiras letras do nome ao invés de iniciais:
```ts
const shortCardName = cardName ? cardName.slice(0, 6) : null;
const methodLabel = shortCardName 
  ? `${config.label} • ${shortCardName}` 
  : config.label;
```
"Banco do Brasil" → `Crédito • Banco `, "Nubank" → `Crédito • Nubank`. Melhor: truncar em 5 chars:
```ts
const shortCardName = cardName 
  ? (cardName.length > 5 ? cardName.slice(0, 5) + '…' : cardName) 
  : null;
const methodLabel = shortCardName 
  ? `${config.label} • ${shortCardName}` 
  : config.label;
```
Resultado: `Crédito • Banco…`, `Crédito • Nuban…`, `Crédito • Inter`.

**Arquivo: `src/components/recurring-expense-list.tsx`**

- Linha 76: mesma alteração no `methodLabel`.

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `floating-action-button.tsx` | `bottom-20` → `bottom-24` com safe-area |
| `Index.tsx` | `pb-36` → `pb-44` |
| `expense-list.tsx` | methodLabel: `Crédito - Banco do Brasil` → `Crédito • Banco…` (5 chars + …) |
| `recurring-expense-list.tsx` | Mesmo ajuste de methodLabel |

4 arquivos, ~8 linhas alteradas. Sem alteração de lógica.

