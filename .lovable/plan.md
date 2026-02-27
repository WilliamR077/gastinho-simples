

## Plano: Redesign Premium da Tela de Relatórios

Esta é uma refatoração grande. Vou dividir em **5 blocos de implementação** ordenados por prioridade (conforme solicitado). Cada bloco pode ser implementado numa mensagem separada para economizar créditos e permitir validação incremental.

---

### Arquivos impactados

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/reports-accordion.tsx` | Reescrever ~80% (componente principal) |
| `src/pages/Reports.tsx` | Header + filtros + remover Footer |
| `src/components/period-selector.tsx` | Trocar Select por segmented control |
| `src/components/expense-charts.tsx` | Pode ser descontinuado (lógica migrada) |

---

### Bloco 1 — Insights no topo + Resumo único do período (prioridade máxima)

**`reports-accordion.tsx`**

**1A. Resumo Inteligente (3 linhas):**
- Novo bloco no topo, antes do resumo de cards
- Calcular com dados já filtrados (`filteredExpenses`, `filteredIncomes`, etc.):
  - Linha 1: "Você gastou R$ X (↑/↓ Y% vs período anterior)." — comparar `totalPeriod` atual vs período anterior (calcular `previousStartDate`/`previousEndDate` baseado no `periodType`, filtrar `expenses` para esse range)
  - Linha 2: "Sua maior categoria: Categoria A (Z%)." — pegar `categoryData[0]`
  - Linha 3: "Seu dia mais caro: dd/mm (R$ W)." — iterar `filteredExpenses` agrupando por dia, pegar o max
- Visual: card com `bg-card` e borda sutil, texto em `text-sm`, ícone de lâmpada/sparkle

**1B. Resumo do período em 1 card com 3 colunas:**
- Substituir os 3 cards separados (Entradas/Saídas/Saldo) por 1 card único
- Layout: 3 colunas internas com separadores verticais
- Abaixo: 2 linhas adicionais:
  - **Economia do período:** `saldo / totalIncomes * 100` → ex: "Você economizou 12% da renda"
  - **Comparação vs anterior:** deltas de Entradas %, Saídas %, Saldo % (se houver dados do período anterior)
- Semântica: Entradas = `text-green-500`, Saídas = `text-red-500`, Saldo = `text-blue-500` (nunca verde)

---

### Bloco 2 — Semântica de cores + Trocar pizzas por barras (prioridade alta)

**`reports-accordion.tsx`**

**2A. Gastos por Categoria → barras horizontais:**
- Substituir `PieChart` por lista de barras horizontais
- Top 5 + "Outros" (agrupar restantes)
- Cada barra: nome + ícone à esquerda, barra colorida proporcional ao max, valor R$ + % à direita
- Sem recharts — HTML/CSS puro com `div` e `width: X%` (mais leve e legível em mobile)

**2B. Gastos por Forma de Pagamento → barras horizontais:**
- Mesmo padrão: barras horizontais com cores consistentes por método
- Crédito = vermelho, Débito = azul, PIX = ciano/teal (sem semântica bom/ruim)

**2C. Gastos por Cartão:**
- Manter donut mas com labels + valores ao lado (não só %)
- Legenda limpa com `R$ X (Y%)`

**2D. Evolução dos Gastos:**
- Mudar cor da linha de `hsl(var(--primary))` (verde) para `#ef4444` (vermelho/laranja)
- Adicionar linha tracejada de média diária: `totalPeriod / diasNoPeriodo`
- Usar `ReferenceLine` do recharts com `strokeDasharray`

---

### Bloco 3 — Melhorar Fluxo de Caixa + Header + Filtros (prioridade média)

**`reports-accordion.tsx`**

**3A. Fluxo de Caixa melhorias:**
- Já usa barras — OK. Melhorias:
  - Reduzir `strokeDasharray` do grid (mais suave)
  - Adicionar toggle "Por dia | Acumulado" dentro do accordion
  - Em modo acumulado: converter dados para somas cumulativas
  - Tooltip já existe — verificar se funciona ao toque

**`src/pages/Reports.tsx`**

**3B. Header:**
- Botão de download: manter ícone + adicionar label "Exportar" visível em todas as telas (remover `hidden sm:inline`)
- Título: trocar gradiente verde saturado por `text-foreground font-bold` simples
- Remover `ThemeToggle` do header (já existe no menu principal)

**3C. Remover Footer:**
- Remover `<Footer />` da tela de Relatórios

**`src/components/period-selector.tsx`**

**3D. Filtros — segmented control:**
- Substituir `Select` por botões inline tipo segmented control: `Mês | Ano | Tri | Custom`
- Usar `ToggleGroup` do shadcn (`@radix-ui/react-toggle-group` já instalado)
- Itens premium mostram ícone de cadeado e abrem dialog de upgrade ao clicar

---

### Bloco 4 — Comparação + Top Gastos + Savings Rate (prioridade média-baixa)

**`reports-accordion.tsx`** — novos AccordionItems

**4A. Card "Comparação com período anterior":**
- Calcular período anterior (mês anterior, ano anterior, etc.)
- Filtrar `expenses`/`incomes` para o range anterior
- Mostrar tabela: Entradas, Saídas, Saldo, Economia — cada com valor atual, anterior e delta %
- Visual: mini cards ou tabela compacta

**4B. "Maiores Gastos" (Top 10):**
- Listar `filteredExpenses` + `filteredRecurringExpenses` ordenados por `amount` desc
- Top 10: descrição + valor + data (ou "Dia X" se recurring)
- Visual: lista simples com ranking numérico

**4C. "Taxa de Economia" (Savings Rate):**
- Card compacto: `(saldo / totalIncomes) * 100`
- Interpretação: < 0% = "Você gastou mais do que ganhou", 0-10% = "Reserve mais", 10-20% = "Bom ritmo", > 20% = "Excelente"
- Visual: número grande + barra de progresso + texto interpretativo

---

### Bloco 5 — Despesas Fixas + Extras opcionais (prioridade baixa)

**`reports-accordion.tsx`**

**5A. Despesas Fixas melhorias:**
- Adicionar "Próxima cobrança: dia X" ou "vence em X dias"
- Chip de status visual (se `day_of_month` < hoje → "Paga" este mês, senão "Pendente")
- CTA "Gerenciar fixas" no header do accordion linkando para a aba de fixas na Index

**5B. Recorrentes/Assinaturas card:**
- Total mensal de recorrentes (já existe parcialmente)
- Variação vs mês anterior: comparar lista de recorrentes ativas no mês atual vs anterior

---

### Ordem de implementação sugerida

1. **Bloco 1** — Insights + Resumo único (maior impacto visual, ~100 linhas)
2. **Bloco 2** — Cores + barras horizontais (~120 linhas, substitui código existente)
3. **Bloco 3** — Header + filtros + fluxo de caixa (~80 linhas em 3 arquivos)
4. **Bloco 4** — Comparação + Top gastos + savings (~150 linhas novas)
5. **Bloco 5** — Fixas + extras (~40 linhas)

Total estimado: ~490 linhas de mudança em 3-4 arquivos. Sugiro implementar **Blocos 1+2 juntos** (maior impacto) e depois **Blocos 3+4+5** numa segunda mensagem.

