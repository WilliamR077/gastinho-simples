

## Estimulo Visual de Metas de Saldo + Notificacoes Motivacionais

### 1. Banner de Meta de Saldo (visual azul)

Criar componente `src/components/balance-goal-banner.tsx` seguindo o mesmo padrao do `income-goal-banner.tsx` e `budget-alert-banner.tsx`, porem com tema azul:

- Calcula saldo = entradas (mensais + recorrentes) - despesas (mensais + recorrentes)
- Exibe banner azul quando meta >= 80% atingida
- Mensagens positivas: "Quase la! Seu saldo esta em X% da meta" ou "Meta de saldo atingida!"
- Botao de fechar e click para navegar ate a aba de metas

Integrar no `src/pages/Index.tsx` logo apos o `IncomeGoalBanner`, passando as props necessarias (budgetGoals, incomes, recurringIncomes, expenses, recurringExpenses, selectedMonth).

### 2. Corrigir cron job do check-budget-goals

**Problema**: O cron job atual envia apenas o header `Authorization` com o anon key, mas a edge function valida o header `x-internal-secret`. Isso significa que as verificacoes de metas nunca funcionam via cron.

**Solucao**: Atualizar o cron job (via SQL insert tool) para incluir o header `x-internal-secret` com o valor do secret `INTERNAL_API_SECRET`. Precisarei perguntar o valor desse secret ou criar o cron com ele.

### 3. Melhorar mensagens de notificacao

Atualizar `supabase/functions/check-budget-goals/index.ts` com mensagens mais motivacionais e variadas:

**Metas de Despesa**:
- 80%: "Cuidado! Voce ja usou X% da sua meta de despesa. Fique atento aos seus gastos!"
- 95%: "Alerta! Faltam apenas R$ X.XX para estourar sua meta. Segure os gastos!"
- 100%: "Meta estourada! Voce excedeu em R$ X.XX. Hora de se reorganizar."

**Metas de Entrada**:
- 80%: "Voce esta quase la! Ja atingiu X% da sua meta de entradas. Faltam R$ X.XX, vai com tudo!"
- 100%: "Parabens! Voce bateu sua meta de entradas! Continue assim!"

**Metas de Saldo (novo)**:
- 80%: "Falta pouco para cumprir sua meta de saldo! Voce ja esta em X%, continue assim!"
- 100%: "Incrivel! Sua meta de saldo foi atingida! Seu saldo esta positivo em R$ X.XX!"

Tambem adicionar o tipo `balance_goal_alert` no campo `data.type` das notificacoes de saldo.

### 4. Agendar verificacao em horarios estrategicos

Atualmente o cron roda 1x/dia as 20h. Manter esse horario mas garantir que funcione (corrigindo o header). Opcionalmente, podemos adicionar um segundo horario (ex: 9h da manha) para dar lembretes matinais tambem.

---

### Detalhes tecnicos

**Novo arquivo `src/components/balance-goal-banner.tsx`**:
- Props: budgetGoals, incomes, recurringIncomes, expenses, recurringExpenses, selectedMonth, onNavigateToGoals
- Filtra metas do tipo `balance_target`
- Calcula saldo = soma entradas - soma despesas
- Exibe banner azul (border-blue-500/50, bg-blue-500/10) quando >= 80%
- Icones: Scale (quase la), PartyPopper (atingida)

**Arquivo `src/pages/Index.tsx`**:
- Importar BalanceGoalBanner
- Adicionar apos IncomeGoalBanner, passando expenses + recurringExpenses adicionais

**Arquivo `supabase/functions/check-budget-goals/index.ts`**:
- Atualizar mensagens para serem mais motivacionais
- Garantir que balance_target gere tipo `balance_goal_alert` no data

**SQL (via insert tool)**: Recriar o cron job com o header `x-internal-secret` correto para que as notificacoes realmente funcionem.
