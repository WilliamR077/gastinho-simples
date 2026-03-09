
## Plano: Melhorias no Tutorial

### Problemas Identificados
1. **Scroll livre**: Usuário pode rolar tela durante tutorial, causando dessincronia entre spotlight e tooltip
2. **Passo "Navegue pelos meses"**: Não explica funcionalidade "Fatura" (calendário vs fatura)
3. **Passo "Organize tudo"**: Explica 3 abas genéricamente, seria melhor explicar cada uma individualmente

### Solução

**1. Travar scroll da página**
- Adicionar CSS/classe no `body` quando `isOpen=true` no `TourOverlay`
- Usar `overflow: hidden` para impedir scroll
- Remover quando tour fechar

**2. Expandir passo do navegador de mês**
- Adicionar `data-tour="view-mode-toggle"` nos botões Calendário/Fatura
- Inserir novo step explicando a funcionalidade de fatura após o step atual do month-navigator

**3. Separar explicação das abas**
- Dividir step atual "Organize tudo" em 3 steps dedicados:
  - "Despesas" → explicar divisão "Do Mês" vs "Fixas" 
  - "Entradas" → explicar categorização de receitas e entradas fixas
  - "Metas" → explicar limites de gastos e acompanhamento

### Mudanças por arquivo

| Arquivo | Ação |
|---------|------|
| `src/components/tour-overlay.tsx` | Adicionar CSS `overflow: hidden` no body quando ativo |
| `src/pages/Index.tsx` | Adicionar `data-tour="view-mode-toggle"` nos botões calendário/fatura |
| `src/hooks/use-product-tour.tsx` | Atualizar `tourSteps`: inserir step fatura, dividir step abas em 3 |

### Novos steps (posições aproximadas)

- **Step 3.5**: Modo Fatura (`view-mode-toggle`) → "Alterne entre modo Calendário e Fatura para ver gastos de cartão de crédito por período de cobrança"
- **Step 7a**: Aba Despesas (`tabs` + `TabsTrigger[value=expenses]`) → "Despesas do mês atual e suas despesas fixas recorrentes"  
- **Step 7b**: Aba Entradas (`tabs` + `TabsTrigger[value=incomes]`) → "Suas receitas mensais e entradas fixas como salário"
- **Step 7c**: Aba Metas (`tabs` + `TabsTrigger[value=goals]`) → "Defina limites de gastos e acompanhe seu orçamento"

Total: ~15 steps (era 12)
