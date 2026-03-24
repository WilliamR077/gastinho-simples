
Objetivo: corrigir a causa raiz do PASSO 2 para que o formulário de despesa permaneça aberto e o onboarding só avance quando o próximo campo realmente existir dentro dele.

### Diagnóstico real
A causa principal não está no scroll em si. O problema é de orquestração do estado:

- o substep `expense-click-btn` avança por timer/evento (`expense-form-opened`) disparado em `Index.tsx` logo após `setExpenseSheetOpen(true)`, antes de garantir que o `Sheet` está montado e estável
- o `OnboardingTour` trata `info` com target (`expense-type-info`) como passo interativo normal, então ao clicar em “Continuar” ele já tenta avançar
- o engine não valida se o formulário ainda está aberto antes de migrar para `expense-description`
- `UnifiedExpenseFormSheet` já tem suporte a `preventClose`, mas `Index.tsx` não está usando isso no passo 2
- hoje, se o Sheet fechar por clique fora/escape/re-render/transição, o onboarding continua mesmo sem contexto

### Implementação

#### 1. Travar o formulário em modo guiado durante o passo 2
**Arquivos:** `src/hooks/use-onboarding-tour.tsx`, `src/pages/Index.tsx`, `src/components/unified-expense-form-sheet.tsx`

Adicionar no hook um estado/derivado público para indicar quando o onboarding está no fluxo guiado da despesa, por exemplo:
- `isExpenseFormGuidedFlow`
- verdadeiro quando `isOpen && currentStep?.id === "add-expense"` e o substep já passou da abertura do formulário

Em `Index.tsx`:
- usar esse estado para passar `preventClose` ao `UnifiedExpenseFormSheet`
- no `onOpenChange`, se estiver em guided flow e `open === false`, bloquear o fechamento normal
- só permitir fechar quando:
  - a despesa for salva com sucesso
  - o usuário pular/cancelar explicitamente o onboarding

#### 2. Trocar o evento “form opened” precoce por detecção real de formulário montado
**Arquivos:** `src/pages/Index.tsx`, `src/components/unified-expense-form-sheet.tsx`

Hoje o evento `expense-form-opened` é disparado por `setTimeout(300)` no clique do FAB. Isso é frágil.

Ajuste:
- remover o dispatch antecipado em `Index.tsx`
- disparar `expense-form-opened` dentro de `UnifiedExpenseFormSheet` via `useEffect` quando:
  - `open === true`
  - o formulário estiver renderizado
  - o container com `data-onboarding="expense-type-selector"` existir no DOM

Assim o onboarding só sai de “Despesas” quando o formulário estiver realmente pronto.

#### 3. Não avançar para substeps de campo sem contexto válido
**Arquivo:** `src/hooks/use-onboarding-tour.tsx`

Antes de avançar para o próximo substep:
- verificar se o próximo substep tem `targetSelector`
- se tiver, confirmar:
  - que o target existe
  - que está visível
  - e, no caso do passo `add-expense`, que o formulário está aberto

Se não estiver pronto:
- não mostrar o próximo tooltip ainda
- aguardar via observer até o target aparecer
- se o formulário tiver fechado indevidamente, reabrir ou voltar ao substep anterior de abertura do formulário

Na prática, `advanceSubstepInternal()` precisa ficar mais defensivo para o passo 2.

#### 4. Adicionar “guard” explícito de formulário aberto no passo 2
**Arquivos:** `src/lib/onboarding/onboarding-steps.ts`, `src/hooks/use-onboarding-tour.tsx`

Adicionar uma condição/contexto para os substeps de formulário (`expense-type-info` em diante), exigindo que o formulário esteja aberto.

Exemplo conceitual:
- `expense-type-info`, `expense-description`, `expense-amount`, etc. só são válidos se existir `expense-type-selector` no DOM
- se esse contexto sumir, o onboarding não continua

Isso transforma o passo 2 em um guided form flow de verdade, em vez de depender só de sequência linear.

#### 5. Tratar fechamento acidental de forma robusta
**Arquivos:** `src/pages/Index.tsx`, `src/hooks/use-onboarding-tour.tsx`

Cobrir os cenários:
- click outside
- escape
- mudança de substep
- re-render/reset que limpe `expenseInitialData` ou `expenseDefaultAmount`
- qualquer `onOpenChange(false)` durante o guided flow

Comportamento:
- durante o passo 2, click outside e escape já serão bloqueados por `preventClose`
- se ainda assim o sheet fechar por algum motivo, o hook detecta perda do target do formulário e:
  - pausa o avanço
  - restaura o contexto reabrindo o sheet
  - ou retorna ao substep “Selecione Despesa”

#### 6. Manter o restante do app intacto
Escopo controlado:
- nenhuma mudança no passo 1
- nenhuma mudança estrutural no formulário fora do onboarding
- o `preventClose` só fica ativo no fluxo guiado da despesa
- a lógica de scroll container-aware continua útil, mas deixa de ser o mecanismo principal para mascarar perda de contexto

### Arquivos afetados
- `src/hooks/use-onboarding-tour.tsx`
- `src/pages/Index.tsx`
- `src/components/unified-expense-form-sheet.tsx`
- `src/lib/onboarding/onboarding-steps.ts`

### Resultado esperado
Depois dessa correção:
- o formulário abre e entra em modo guiado real
- continua aberto durante todo o passo 2
- “Descrição” só aparece quando o campo existir de fato no formulário aberto
- o onboarding não avança mais para targets inexistentes
- click outside / escape / fechamento acidental deixam de quebrar o fluxo
