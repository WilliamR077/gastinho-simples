

## Plano: Melhorias no Tutorial

### Resumo das Mudanças

| Arquivo | Ação |
|---------|------|
| `src/components/tour-overlay.tsx` | Adicionar `overflow: hidden` no body quando tour ativo |
| `src/pages/Index.tsx` | Adicionar `data-tour="view-mode-toggle"` no container dos botões Calendário/Fatura |
| `src/hooks/use-product-tour.tsx` | Atualizar `tourSteps`: inserir step fatura, dividir step abas em 3 dedicados |

---

### Detalhes Técnicos

**1. Travar Scroll (tour-overlay.tsx)**
- Adicionar `useEffect` que aplica `document.body.style.overflow = "hidden"` quando `isVisible=true`
- Cleanup restaura `overflow = ""` quando tour fechar

**2. Atributo data-tour (Index.tsx)**
- Linha 1585: adicionar `data-tour="view-mode-toggle"` no `<div>` que envolve os botões Calendário/Fatura

**3. Novos Steps (use-product-tour.tsx)**

Steps atualizados:
1. Bem-vindo ao Gastinho
2. Grupos compartilhados
3. Navegue pelos meses
4. **NOVO:** Modo Fatura (`[data-tour='view-mode-toggle']`) → "Alterne entre Calendário e Fatura para visualizar gastos de cartão por período de cobrança"
5. Filtros poderosos
6. Suas categorias
7. Resumo por forma de pagamento
8. **Aba Despesas** (`[data-tour='tabs'] [value='expenses']`) → "Despesas do mês e despesas fixas recorrentes"
9. **Aba Entradas** (`[data-tour='tabs'] [value='incomes']`) → "Suas receitas mensais e entradas fixas"
10. **Aba Metas** (`[data-tour='tabs'] [value='goals']`) → "Defina limites de gastos e acompanhe seu orçamento"
11. Relatórios detalhados
12. Mostrar/Esconder valores
13. Menu lateral
14. Adicione gastos rapidamente
15. Tudo pronto!

**Total:** 15 steps (era 12)

