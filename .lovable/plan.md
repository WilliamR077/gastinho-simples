

## Plano: Reorganizar Onboarding em 7 Passos Principais + 2 Opcionais

### Visão Geral

Reestruturar o onboarding de configuração de conta para seguir 7 passos práticos baseados no uso real, com 2 etapas complementares fora da contagem de progresso.

### Arquitetura dos Passos

```text
CONTAGEM PRINCIPAL (7 passos):
1. add-card          → Cartão (já funciona bem)
2. add-expense       → Despesa do mês (com categorias integradas)
3. add-recurring-expense → Despesa fixa
4. add-income        → Entradas (3 tipos: mês, fixa, parcelada)
5. add-budget-goal   → Metas
6. view-reports      → Relatórios (NOVO)
7. setup-security    → Segurança (mobileOnly)

FORA DA CONTAGEM:
8. import-spreadsheet → Importar planilha (optional)
9. Completion dialog  → CTA Premium
```

---

### 1. Passo 1 — Cartão (sem mudanças)

Mantém os substeps existentes (navegar, clicar, nome, tipo, vencimento, fechamento, limite, cor, submit, completion). Já funciona.

### 2. Passo 2 — Despesa do Mês (expandido)

**`src/lib/onboarding/onboarding-steps.ts`**

Expandir `add-expense` com substeps guiados campo a campo:

```
substeps: [
  { id: "expense-intro", actionType: "info", title: "Registre seu Primeiro Gasto",
    description: 'Qual foi a última coisa que você gastou? Vamos registrar! Toque no "+" para abrir o formulário.',
    emoji: "💸", navigateLabel: "Continuar" },
  { id: "expense-description", actionType: "fill", targetSelector: "expense-description",
    title: "Descrição", description: "O que você comprou? Ex: Almoço, Uber, Mercado...",
    emoji: "📝", requiresValidation: true, focusTarget: true, scrollToTarget: true },
  { id: "expense-amount", actionType: "fill", targetSelector: "expense-amount",
    title: "Valor", description: "Quanto custou?",
    emoji: "💵", requiresValidation: true, focusTarget: true, scrollToTarget: true },
  { id: "expense-date", actionType: "optional-group", targetSelector: "expense-date",
    title: "Data do Gasto", description: "Quando foi esse gasto? A data de hoje já vem preenchida.",
    emoji: "📅", skipLabel: "Manter hoje", scrollToTarget: true },
  { id: "expense-category", actionType: "select", targetSelector: "expense-category-field",
    title: "Escolha a Categoria",
    description: "Essas são as categorias padrão. Escolha uma ou, se quiser, gerencie suas categorias pelo botão no final da lista.",
    emoji: "📦", requiresValidation: true, scrollToTarget: true },
  { id: "expense-payment", actionType: "select", targetSelector: "expense-payment",
    title: "Forma de Pagamento", description: "Como você pagou? PIX, débito ou crédito.",
    emoji: "💳", requiresValidation: true, scrollToTarget: true },
  { id: "expense-submit", actionType: "submit", targetSelector: "expense-submit-btn",
    title: "Salvar Despesa", description: 'Clique em "Adicionar" para salvar.',
    emoji: "✅", autoAdvanceOnEvent: "expense-submitted", scrollToTarget: true },
  { id: "expense-done", actionType: "completion", title: "Despesa Registrada! 🎉",
    description: "Sua primeira despesa foi cadastrada!",
    emoji: "🎉", proceedLabel: "Prosseguir" },
]
```

### 3. Passo 3 — Despesa Fixa (expandido)

Novo substep flow guiado:

```
substeps: [
  { id: "recurring-intro", actionType: "info",
    title: "Cadastre uma Despesa Fixa",
    description: "Pense em algo que você paga todo mês: aluguel, academia, internet, streaming...",
    emoji: "🔄", navigateLabel: "Continuar", skipLabel: "Pular esta etapa" },
]
```

Manter simples por enquanto — um info step que orienta. O step é marcado como concluído ao detectar dados reais via `detectionTable`.

### 4. Passo 4 — Entradas (com seletor de tipo)

**Nova abordagem com substeps:**

```
substeps: [
  { id: "income-intro", actionType: "info",
    title: "Como você recebe dinheiro?",
    description: "Você pode registrar 3 tipos de entrada:\n\n💰 Entrada do mês — freelance, venda, bônus\n🔄 Entrada fixa — salário mensal\n📑 Entrada parcelada — projeto/venda parcelada\n\nEscolha o tipo que mais combina com você no formulário.",
    emoji: "💰", navigateLabel: "Continuar", skipLabel: "Pular esta etapa" },
]
```

### 5. Passo 5 — Metas

```
substeps: [
  { id: "budget-intro", actionType: "info",
    title: "Controle seus Gastos com Metas",
    description: "Defina um limite de gastos para o mês! Você pode criar uma meta geral ou por categoria. Recomendamos começar com um limite mensal total.",
    emoji: "🎯", navigateLabel: "Continuar", skipLabel: "Pular esta etapa" },
]
```

### 6. Passo 6 — Relatórios (NOVO)

**Novo step `view-reports`:**

```
{
  id: "view-reports",
  label: "Relatórios",
  emoji: "📊",
  substeps: [
    { id: "reports-intro", actionType: "info",
      title: "Conheça seus Relatórios",
      description: "Aqui você acompanha sua vida financeira com clareza: gastos por categoria, fluxo de caixa, evolução dos gastos e muito mais.",
      emoji: "📊" },
    { id: "reports-navigate", actionType: "navigate",
      title: "Vamos conhecer?",
      description: "Quer conhecer a página de relatórios ou prefere explorar sozinho depois?",
      emoji: "📊", navigateTo: "/reports", navigateLabel: "Conhecer Relatórios",
      skipLabel: "Explorar depois" },
  ],
}
```

Detecção: sem `detectionTable` — marcado como concluído quando o step completa no onboarding (sem verificação de dados). Adicionar propriedade `noDetection: true` ou simplesmente omitir `detectionTable`.

### 7. Passo 7 — Segurança (mobileOnly, expandido)

```
substeps: [
  { id: "security-intro", actionType: "info",
    title: "Proteja seu App",
    description: "Recomendamos fortemente ativar a segurança! Configure um PIN de 4 a 6 dígitos ou use biometria para proteger seus dados financeiros.",
    emoji: "🔐", skipLabel: "Ativar depois" },
  { id: "security-navigate", actionType: "navigate",
    title: "Vamos configurar?",
    description: "Acesse as configurações de segurança para proteger seu app.",
    emoji: "🔐", navigateTo: "/settings", navigateLabel: "Ir para Segurança",
    autoAdvanceOnRoute: "/settings" },
]
```

### 8. Importar Planilha (optional, fora da contagem)

Manter como está, com `optional: true`.

```
substeps: [
  { id: "import-intro", actionType: "info",
    title: "Importar Planilha (Opcional)",
    description: "Você já controla suas finanças em planilha? Podemos importar seus dados automaticamente!",
    emoji: "📊", navigateLabel: "Importar", skipLabel: "Não tenho planilha" },
]
```

---

### Arquivos e Mudanças

**`src/lib/onboarding/onboarding-steps.ts`**
- Reescrever `ONBOARDING_STEPS` com os 7+1 passos acima
- Adicionar `view-reports` como novo step
- Expandir `add-expense` com substeps campo a campo
- Expandir `setup-security` com intro + navigate
- Atualizar `STEP_LABELS` para incluir `view-reports`

**`src/components/expense-form-sheet.tsx`** e **`src/components/unified-expense-form-sheet.tsx`**
- Adicionar `data-onboarding` nos campos: description, amount, date, payment, submit
- Garantir que cada campo tenha seu seletor para o spotlight funcionar

**`src/components/onboarding-tour.tsx`**
- Atualizar `ALL_STEP_IDS` para os 7 novos IDs
- Remover `add-category` de `ALL_STEP_IDS`
- Adicionar `view-reports` e `setup-security`

**`src/hooks/use-onboarding-tour.tsx`**
- Em `checkExistingData()`: não verificar `view-reports` (step sem detectionTable)
- Marcar `view-reports` como concluído apenas via progresso do onboarding (localStorage)
- Em `getSetupProgress()`: para `view-reports`, verificar localStorage se o onboarding já passou por esse step

**`src/pages/Settings.tsx`**
- Nenhuma mudança estrutural (já usa `getSetupProgress()`)

**`src/components/setup-progress-banner.tsx`**
- Nenhuma mudança estrutural (já usa `getSetupProgress()`)

---

### Detecção de Progresso para `view-reports`

Como `view-reports` não tem tabela no banco, a detecção será feita assim:
- Quando o step for completado durante o onboarding, `completedSteps` já inclui `view-reports`
- Em `checkExistingData()`: verificar se `localStorage.getItem(PROGRESS_KEY)` contém `view-reports` nos completed, OU se `localStorage.getItem(STORAGE_KEY) === "true"` (onboarding completo)
- Isso garante que ao retomar, o progresso reflita corretamente

---

### Resumo de Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Reescrever steps: 7 principais + 1 optional |
| `src/components/expense-form-sheet.tsx` | Adicionar `data-onboarding` nos campos |
| `src/components/unified-expense-form-sheet.tsx` | Adicionar `data-onboarding` nos campos |
| `src/components/onboarding-tour.tsx` | Atualizar `ALL_STEP_IDS` |
| `src/hooks/use-onboarding-tour.tsx` | Ajustar `checkExistingData` para `view-reports` |

Nenhuma migração SQL.

