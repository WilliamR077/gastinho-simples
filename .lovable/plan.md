

# Plano Final v2: Adicionar método "Dinheiro" (cash) — ajustado

## 1. Resumo executivo

Adicionar `cash` ao enum `payment_method` (apenas para despesas e despesas recorrentes), centralizando metadados e regras de negócio em `src/lib/payment-methods.ts`. **Preservar cores atuais** dos métodos existentes; adicionar lime apenas para `cash`. Implementar limpeza obrigatória de campos dependentes de cartão ao trocar para método sem cartão. Importação rejeita valores desconhecidos com erro explícito.

---

## 2. Estratégia em fases

1. **Preparação** — criar `src/lib/payment-methods.ts` com cores idênticas às atuais, helpers (`requiresCard`, `allowsInstallments`, `affectsCardBilling`), ordem explícita.
2. **Banco** — migration `ALTER TYPE … ADD VALUE 'cash'`; aguardar regeneração de `types.ts`.
3. **Forms** — Selects derivados da fonte única; aplicar regra de limpeza de campos dependentes ao trocar método.
4. **Visualizações/filtros/resumos/gráficos** — substituir maps locais por consumo da fonte única.
5. **Importação/exportação** — exportação via `paymentMethodLabel()`; importação rejeita aliases desconhecidos com erro.
6. **Testes manuais** — checklist completa, com foco em regra de limpeza e billing.

---

## 3. Fonte única da verdade — `src/lib/payment-methods.ts`

```ts
import { Banknote, CreditCard, Smartphone, type LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@/types/expense";

export interface PaymentMethodMeta {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
  color: string;            // preservado dos componentes atuais
  requiresCard: boolean;
  allowsInstallments: boolean;
  affectsCardBilling: boolean;
  importAliases: string[];  // só para parser de planilha
  displayOrder: number;     // ordem fixa nos selects/filtros/charts
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodMeta> = {
  credit: { value: "credit", label: "Crédito", icon: CreditCard, color: <cor atual em expense-charts.tsx>, requiresCard: true,  allowsInstallments: true,  affectsCardBilling: true,  importAliases: [...], displayOrder: 1 },
  debit:  { value: "debit",  label: "Débito",  icon: CreditCard, color: <cor atual em expense-charts.tsx>, requiresCard: true,  allowsInstallments: false, affectsCardBilling: false, importAliases: [...], displayOrder: 2 },
  pix:    { value: "pix",    label: "PIX",     icon: Smartphone, color: <cor atual em expense-charts.tsx>, requiresCard: false, allowsInstallments: false, affectsCardBilling: false, importAliases: [...], displayOrder: 3 },
  cash:   { value: "cash",   label: "Dinheiro", icon: Banknote,  color: "#84cc16" /* lime-500, único valor novo */, requiresCard: false, allowsInstallments: false, affectsCardBilling: false, importAliases: ["dinheiro","cash","espécie","especie","money","papel"], displayOrder: 4 },
};

// Ordem explícita — NUNCA usar Object.values diretamente em UI
export const PAYMENT_METHOD_LIST: PaymentMethodMeta[] =
  (Object.values(PAYMENT_METHODS) as PaymentMethodMeta[])
    .sort((a, b) => a.displayOrder - b.displayOrder);

// Helpers
export const paymentMethodLabel = (m: PaymentMethod) => PAYMENT_METHODS[m]?.label ?? String(m);
export const paymentMethodIcon  = (m: PaymentMethod) => PAYMENT_METHODS[m]?.icon ?? Banknote;
export const paymentMethodColor = (m: PaymentMethod) => PAYMENT_METHODS[m]?.color ?? "#6b7280";
export const requiresCard         = (m: PaymentMethod) => PAYMENT_METHODS[m]?.requiresCard ?? false;
export const allowsInstallments   = (m: PaymentMethod) => PAYMENT_METHODS[m]?.allowsInstallments ?? false;
export const affectsCardBilling   = (m: PaymentMethod) => PAYMENT_METHODS[m]?.affectsCardBilling ?? false;

// Parser de importação — sem fallback silencioso
export interface AliasParseResult {
  method: PaymentMethod | null;
  matchedAlias: string | null;
}
export function parsePaymentMethodAlias(raw: string): AliasParseResult {
  const norm = raw.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const m of PAYMENT_METHOD_LIST) {
    if (m.importAliases.some(a => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === norm)) {
      return { method: m.value, matchedAlias: raw };
    }
  }
  return { method: null, matchedAlias: null };
}

// Regra de limpeza ao trocar método — usado por todos os forms
export interface CardDependentFields {
  cardId?: string | null;
  installments?: number | null;
}
export function clearCardDependentFieldsIfNeeded(
  newMethod: PaymentMethod,
  current: CardDependentFields
): CardDependentFields {
  const next = { ...current };
  if (!requiresCard(newMethod)) next.cardId = null;
  if (!allowsInstallments(newMethod)) next.installments = 1; // ou null conforme schema do form
  return next;
}
```

**Cores:** durante implementação, ler os valores hex EXATOS hoje em `expense-charts.tsx` (`methodColors`) e copiar literalmente para `credit`/`debit`/`pix`. Lime `#84cc16` é o único valor novo.

---

## 4. Regra de limpeza de campos dependentes de cartão

**Onde aplicar** (criação, edição, recorrente):
- `expense-form.tsx`, `expense-form-sheet.tsx`, `unified-expense-form-sheet.tsx`
- `recurring-expense-form.tsx`, `recurring-expense-form-sheet.tsx`
- `expense-edit-dialog.tsx`, `recurring-expense-edit-dialog.tsx`

**Como aplicar:**
1. No `onChange` do Select de método, chamar `clearCardDependentFieldsIfNeeded(novo, { cardId, installments })` e aplicar o resultado ao state do form.
2. Renderização condicional: `{requiresCard(method) && <CardSelect />}` e `{allowsInstallments(method) && <InstallmentsField />}`.
3. Validação no submit: se `requiresCard(method)` e `!cardId`, bloquear com mensagem clara.
4. No payload final ao Supabase: garantir `card_id: requiresCard(method) ? cardId : null` e `installments: allowsInstallments(method) ? installments : 1` — defesa em profundidade caso o state esteja sujo.

**Casos cobertos:**
- Criar despesa em `cash` → nenhum cartão enviado, sem parcelamento.
- Editar de `credit` (com cartão X, 3 parcelas) → `cash`: `card_id` vai a null e `installments` volta a 1.
- Editar de `cash` → `credit`: campo cartão reaparece e fica obrigatório; submit sem cartão bloqueado.
- Recorrentes: idem.

---

## 5. Importação sem fallback silencioso

`src/services/spreadsheet-import-service.ts`:
- Substituir `mapPaymentMethod(value)` (que hoje retorna `pix` por padrão) por uso de `parsePaymentMethodAlias(value)`.
- Comportamento por linha:
  - Coluna método **vazia/ausente:** usar default explícito documentado (`pix`, comportamento atual) — está OK.
  - Coluna método **preenchida + alias reconhecido:** mapear normalmente.
  - Coluna método **preenchida + alias desconhecido:** marcar `isValid: false` e adicionar erro: `Forma de pagamento não reconhecida: "X". Aceitos: Crédito, Débito, PIX, Dinheiro.`
- A linha aparece na pré-visualização do `spreadsheet-import-sheet.tsx` em estado de erro, não é importada, e o usuário pode corrigir a planilha ou ignorar.

---

## 6. Pontos impactados por camada

### Banco
- Migration: `ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cash';`
- Sem backfill, sem mudança de RLS, sem mudança de índice.
- `src/integrations/supabase/types.ts` regenerado.

### Forms (obrigatórios — 7 arquivos)
- 7 arquivos listados na seção 4 — adotam `PAYMENT_METHOD_LIST`, `requiresCard`, `allowsInstallments`, `clearCardDependentFieldsIfNeeded`.

### Visualização (5 arquivos)
- `expense-charts.tsx` — remover `methodColors`/`methodLabels` locais; iterar `PAYMENT_METHOD_LIST` para acumulador e legenda; tooltip usa `paymentMethodLabel`.
- `expense-summary.tsx` — acumulador derivado de `PAYMENT_METHOD_LIST`; cash não entra em totalização por cartão (filtro continua por `card_id`, não por método).
- `expense-list.tsx`, `transaction-detail-sheet.tsx`, `recurring-expense-list.tsx` — `paymentMethodLabel` + `paymentMethodIcon`.

### Filtros (2 arquivos)
- `compact-filter-bar.tsx`, `expense-filters.tsx` — opções derivadas de `PAYMENT_METHOD_LIST`.

### Importação/Exportação (4 arquivos)
- `spreadsheet-import-service.ts` — usar `parsePaymentMethodAlias`; remover fallback silencioso.
- `spreadsheet-import-sheet.tsx` — exibir erro de método desconhecido na pré-visualização.
- `pdf-export-service.ts` — substituir ternários por `paymentMethodLabel`.
- `Settings.tsx` (CSV) — idem.

### Revisar sem alterar comportamento (5 arquivos)
- `card-limit-view-model.ts`, `credit-card-spend.ts`, `billing-period.ts`: confirmar que filtram positivamente por `=== "credit"` (correto). Onde houver comparação inevitável, **adicionar comentário** apontando que o conceito é `affectsCardBilling`.
- `report-view-model.ts`: confirmar agrupamentos derivados de `PAYMENT_METHOD_LIST`.
- `Index.tsx` (~linha 1508): se for `payment_method !== "credit"` em modo fatura, **trocar** por `!affectsCardBilling(payment_method)` para usar conceito de domínio.

---

## 7. Casos de teste obrigatórios

**Criação/edição:**
- [ ] Criar despesa avulsa em `cash` (sem campo de cartão visível, sem parcelas).
- [ ] Criar despesa recorrente em `cash`.
- [ ] Editar despesa `credit` (com cartão + 3 parcelas) para `cash` → cartão e parcelas somem da UI; payload salva `card_id=null`, `installments=1`.
- [ ] Editar despesa `debit` (com cartão) para `pix` → `card_id` limpo.
- [ ] Editar despesa `cash` para `credit` → seletor de cartão reaparece e bloqueia submit sem cartão.
- [ ] Editar despesa `cash` para `credit` com 3 parcelas → série criada normalmente.
- [ ] Mesma sequência para despesas recorrentes.

**Visualização:**
- [ ] Listas mostram ícone Banknote + "Dinheiro" para `cash`; cores de `pix`/`credit`/`debit` permanecem idênticas às atuais.
- [ ] Card "Gastos por Método" inclui linha "Dinheiro" lime; soma das fatias = total.
- [ ] Tooltip do gráfico exibe "Dinheiro" e valor correto.

**Filtros:**
- [ ] Filtro tem opção "Dinheiro" na ordem definida (4ª posição).
- [ ] Filtrar por `cash` retorna apenas despesas em dinheiro; filtrar por `credit` não inclui `cash`.

**Importação:**
- [ ] Planilha com "Dinheiro"/"cash"/"espécie" mapeia para `cash`.
- [ ] Planilha com "carteira virtual" (alias desconhecido) gera linha inválida com mensagem clara, **não** importa como `pix`.
- [ ] Planilha com coluna método vazia continua usando default `pix` (comportamento atual preservado).

**Exportação:**
- [ ] PDF exibe "Dinheiro" para `cash` (não "PIX").
- [ ] CSV em Settings exibe "Dinheiro".

**Billing/fatura:**
- [ ] Despesa em `cash` não aparece na fatura nem decrementa limite de cartão.
- [ ] Modo fatura no `Index` ignora `cash` (via `!affectsCardBilling`).

**Regressão:**
- [ ] Fluxo de `pix`, `credit`, `debit` idêntico ao anterior, com cores preservadas.

---

## 8. Critérios de aceite (revisados)

1. ✅ Migration aplicada; `types.ts` regenerado contém `"cash"`.
2. ✅ `src/lib/payment-methods.ts` existe e exporta `PAYMENT_METHODS`, `PAYMENT_METHOD_LIST` (ordenado), helpers e `parsePaymentMethodAlias`.
3. ✅ Cores de `credit`/`debit`/`pix` na fonte central são **idênticas** às que estavam em `expense-charts.tsx` antes da refatoração.
4. ✅ **Nenhum** componente possui map local de `methodColors`/`methodLabels`/`methodIcons` — todos consomem a fonte única. (Strings `"credit"`/`"debit"`/`"pix"` podem permanecer como valores de domínio em forms, queries e filtros.)
5. ✅ **Nenhum** ternário de fallback do tipo `=== "credit" ? ... : === "debit" ? ... : "PIX"` em código de exportação ou exibição.
6. ✅ Forms aplicam `clearCardDependentFieldsIfNeeded` no onChange do método e validam `requiresCard` no submit.
7. ✅ Payload final ao Supabase nunca grava `card_id` para método sem cartão nem `installments > 1` para método sem parcelamento.
8. ✅ Importação rejeita aliases desconhecidos com erro explícito; não há fallback silencioso para `pix` em valores preenchidos.
9. ✅ Lógica de billing/fatura usa `affectsCardBilling()` quando aplicável; comparações diretas remanescentes (ex.: `=== "credit"` em queries de fatura) têm comentário explicando o motivo.
10. ✅ Ordem dos métodos em selects/filtros/charts segue `displayOrder` (Crédito → Débito → PIX → Dinheiro).
11. ✅ Sem regressão visual em `pix`/`credit`/`debit`.

---

## 9. Lista final de arquivos

**Novo (1):** `src/lib/payment-methods.ts`
**Migration (1):** `supabase/migrations/<ts>_add_cash_payment_method.sql`
**Auto-regenerado (1):** `src/integrations/supabase/types.ts`
**Forms (7):** `expense-form.tsx`, `expense-form-sheet.tsx`, `unified-expense-form-sheet.tsx`, `recurring-expense-form.tsx`, `recurring-expense-form-sheet.tsx`, `expense-edit-dialog.tsx`, `recurring-expense-edit-dialog.tsx`
**Visualização (5):** `expense-charts.tsx`, `expense-summary.tsx`, `expense-list.tsx`, `transaction-detail-sheet.tsx`, `recurring-expense-list.tsx`
**Filtros (2):** `compact-filter-bar.tsx`, `expense-filters.tsx`
**Importação/Exportação (4):** `spreadsheet-import-service.ts`, `spreadsheet-import-sheet.tsx`, `pdf-export-service.ts`, `Settings.tsx`
**Revisar (5):** `card-limit-view-model.ts`, `credit-card-spend.ts`, `billing-period.ts`, `report-view-model.ts`, `Index.tsx`

**Total:** 1 novo + 1 migration + 18 modificados + 5 revisados.

