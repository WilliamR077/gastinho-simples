

## Plano Revisado: Corrigir e Refinar Passo de Relatórios

### Ajustes incorporados

1. **Navegação de período**: Novo substep `reports-month-nav` após `reports-period`, destacando o `MonthNavigator` (setas + período atual). O `PeriodSelector` já contém as setas e o label do mês internamente, então o `data-onboarding` será colocado na div que envolve as setas de navegação dentro do `PeriodSelector`. Alternativa mais simples: como o `reports-period-selector` já envolve todo o `PeriodSelector` (incluindo toggle de tipo + setas), podemos separar: o substep `reports-period` explica os tipos (Mês, Ano, Trimestre, Personalizado) e o substep `reports-month-nav` destaca a área de navegação (setas + label). Isso requer adicionar um `data-onboarding="reports-month-nav"` na div de navegação dentro do `PeriodSelector`.

2. **`reports-context` mantido**: Fica na posição atual (após `reports-nav`, antes de `reports-period`) com `condition` de DOM check, como já está implementado.

---

### Sequência final (~18 substeps)

| # | ID | Tipo | Target | Notas |
|---|-----|------|--------|-------|
| 1 | `reports-nav` | click | `reports-nav-button` | Texto combinado intro + ação. autoAdvanceOnRoute: `/reports`. Sem "Continuar" |
| 2 | `reports-context` | info | `reports-context-selector` | condition: DOM. Seletor pessoal vs grupo |
| 3 | `reports-period` | info | `reports-period-selector` | Tipos de período (Mês/Ano/Trimestre/Custom) + menção premium |
| 4 | `reports-month-nav` | info | `reports-month-nav` | **NOVO**. Setas + período atual. "Aqui você navega entre meses ou períodos. Use as setas para ver períodos anteriores ou futuros." |
| 5 | `reports-summary` | info | `reports-period-summary` | Resumo Entradas/Saídas/Saldo |
| 6 | `reports-smart-summary` | info | `reports-smart-summary` | condition: DOM |
| 7 | `reports-category` | info | `reports-category` | scrollToTarget |
| 8 | `reports-payment` | info | `reports-payment-method` | scrollToTarget |
| 9 | `reports-cards` | info | `reports-cards` | condition: DOM. scrollToTarget |
| 10 | `reports-cashflow` | info | `reports-cashflow` | Premium text. scrollToTarget |
| 11 | `reports-evolution` | info | `reports-evolution` | Premium text. scrollToTarget |
| 12 | `reports-top` | info | `reports-top-expenses` | scrollToTarget |
| 13 | `reports-comparison` | info | `reports-comparison` | condition: DOM. scrollToTarget |
| 14 | `reports-savings` | info | `reports-savings-rate` | condition: DOM. scrollToTarget |
| 15 | `reports-members` | info | `reports-members` | condition: DOM. scrollToTarget |
| 16 | `reports-recurring` | info | `reports-recurring` | scrollToTarget |
| 17 | `reports-export` | info | `reports-export-btn` | **NOVO**. Botão exportar PDF + menção premium |
| 18 | `reports-done` | info | — | Conclusão |

### Mudanças por arquivo

#### 1. `src/lib/onboarding/onboarding-steps.ts`
- Remover `reports-intro` (unificar texto com `reports-nav`)
- Manter `reports-context` com condition (já existe, posição correta)
- Adicionar `reports-month-nav` (substep novo entre `reports-period` e `reports-summary`)
- Adicionar `reports-export` (substep novo antes de `reports-done`)
- Atualizar textos do `reports-nav` para combinar intro + ação

#### 2. `src/components/period-selector.tsx`
- Adicionar `data-onboarding="reports-month-nav"` na div que contém as setas de navegação e o label do período (linhas ~130-160, a div com `ChevronLeft`, label, `ChevronRight`)

#### 3. `src/pages/Reports.tsx`
- Adicionar `data-onboarding="reports-export-btn"` no botão de exportar PDF (linha ~264)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Reescrever substeps: remover intro, adicionar month-nav e export |
| `src/components/period-selector.tsx` | `data-onboarding="reports-month-nav"` na área de navegação |
| `src/pages/Reports.tsx` | `data-onboarding="reports-export-btn"` no botão exportar |

Nenhuma migração SQL.

