

## Plano: Redesenhar pagina de assinaturas para usuarios com plano ativo

### Problema atual
Quando o usuario ja tem o plano mais alto (Premium Plus), a pagina ainda mostra todos os 4 planos com botoes ativos para assinar planos inferiores. Isso confunde o usuario e permite que ele tente comprar um plano menor sem sentido.

### Solucao
Dividir a pagina em dois modos:
1. **Usuario com plano pago** -- mostra apenas o plano atual com detalhes e opcoes de gerenciamento (cancelar/alterar via Google Play)
2. **Usuario gratuito** -- mostra todos os planos disponiveis como esta hoje

### Comportamento por tier

| Tier atual | O que mostra |
|------------|-------------|
| `free` | Todos os 4 planos com botoes de compra (como hoje) |
| `no_ads` | Card do plano atual + opcao de upgrade para Premium/Premium Plus + botao gerenciar no Google Play |
| `premium` | Card do plano atual + opcao de upgrade para Premium Plus + botao gerenciar no Google Play |
| `premium_plus` | Apenas card do plano atual + botao gerenciar no Google Play |

### Layout para usuario com plano pago

1. **Header** com botao voltar e restaurar compras (igual hoje)
2. **Card principal grande** com:
   - Icone e nome do plano atual
   - Preco atual
   - Lista de todos os recursos incluidos (com checks verdes)
   - Data de validade
   - Botao "Gerenciar no Google Play" (para cancelar ou alterar)
3. **Se nao for Premium Plus**: secao "Fazer upgrade" mostrando apenas os planos superiores ao atual
4. **Card informativo** sobre compra segura via Google Play

### Detalhes tecnicos

**Arquivo: `src/pages/Subscription.tsx`**

Adicionar logica condicional no render:

```text
// Se o usuario tem plano pago, mostrar visao simplificada
if (tier !== "free") {
  return (
    // Card grande com plano atual
    // + planos superiores para upgrade (se houver)
    // + botao gerenciar no Google Play
  );
}

// Se gratuito, mostrar todos os planos (como hoje)
return (
  // Layout atual com os 4 cards
);
```

A logica de filtro dos planos superiores:
- Ordem dos tiers: `free` < `no_ads` < `premium` < `premium_plus`
- Mostrar apenas planos com indice maior que o tier atual

### Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Subscription.tsx` | Renderizar visao simplificada para usuarios com plano pago, mostrando apenas plano atual e opcoes de upgrade/gerenciamento |

Nenhum outro arquivo precisa ser alterado.
