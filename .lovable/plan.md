
## Plano: Corrigir Visualização de Despesas em Grupos Compartilhados

### Problema Principal
Quando um membro do grupo visualiza despesas criadas por outro membro:
- A categoria aparece como "Outros" em vez da categoria correta
- O cartão aparece apenas como "Crédito" sem o nome do cartão
- Isso acontece porque as categorias e cartões são privados de cada usuário (RLS)

### Solução: Desnormalizar Dados de Exibição

A solução mais simples e eficiente é **armazenar o nome e ícone da categoria, e o nome do cartão diretamente na despesa** no momento da criação. Assim, qualquer membro do grupo pode ver as informações corretas.

---

### Mudanças no Banco de Dados

**Migração SQL - Adicionar colunas de exibição:**

```text
ALTER TABLE expenses 
  ADD COLUMN category_name TEXT,
  ADD COLUMN category_icon TEXT DEFAULT '📦',
  ADD COLUMN card_name TEXT;

ALTER TABLE recurring_expenses 
  ADD COLUMN category_name TEXT,
  ADD COLUMN category_icon TEXT DEFAULT '📦',
  ADD COLUMN card_name TEXT;
```

---

### Mudanças no Código

**1. Formulário de Despesa (`src/pages/Index.tsx`)**

Ao criar uma despesa, buscar e salvar os dados de exibição:

```text
// Quando inserir despesa, incluir:
category_name: selectedCategory?.name || 'Outros',
category_icon: selectedCategory?.icon || '📦',
card_name: selectedCard?.name || null,
```

**2. Lista de Despesas (`src/components/expense-list.tsx`)**

Modificar `getCategoryDisplay` para priorizar os campos desnormalizados:

```text
const getCategoryDisplay = (expense: Expense) => {
  // Se tiver dados desnormalizados (para despesas de grupo)
  if (expense.category_name) {
    return { 
      icon: expense.category_icon || '📦', 
      label: expense.category_name 
    };
  }
  
  // Fallback para categoria do usuário atual
  if (expense.category_id) {
    const userCategory = categories.find(c => c.id === expense.category_id);
    if (userCategory) {
      return { icon: userCategory.icon, label: userCategory.name };
    }
  }
  
  // Fallback final
  return { icon: '📦', label: 'Outros' };
};
```

**3. Exibição do Cartão (`src/components/expense-list.tsx`)**

Usar `card_name` quando `card` não estiver disponível:

```text
// No Badge de pagamento:
{config.label}
{expense.card?.name 
  ? ` - ${expense.card.name}` 
  : expense.card_name 
    ? ` - ${expense.card_name}` 
    : ''}
```

**4. Mesmas mudanças em:**
- `src/components/recurring-expense-list.tsx`
- `src/types/expense.ts` (adicionar campos no tipo)

---

### Sobre a Exclusão de Despesas em Grupo

Atualmente, a política RLS só permite o criador apagar a despesa. Temos duas opções:

**Opção A - Manter como está (mais seguro):**
- Apenas o criador pode apagar suas despesas
- Outros membros podem ver mas não apagar

**Opção B - Permitir membros do grupo apagarem (mais flexível):**
- Qualquer membro do grupo pode apagar despesas do grupo
- Útil para correções rápidas

Qual opção você prefere?

---

### Sobre Cartões de Grupo

Para resolver a questão de "cada um ter que cadastrar o cartão do Walter":

**Solução Simples (recomendada):**
- Manter sistema atual onde cada um cadastra seus cartões
- A visualização mostrará o nome do cartão para todos (com a correção acima)
- Quando não tiver cartão cadastrado, pode selecionar só "Crédito" e digitar descrição

**Solução Avançada (futura):**
- Criar conceito de "cartões compartilhados do grupo"
- Todos os membros veem e podem usar os mesmos cartões
- Mais complexo de implementar

---

### Arquivos a Modificar

1. **Migração SQL** - adicionar colunas `category_name`, `category_icon`, `card_name`
2. `src/types/expense.ts` - adicionar tipos
3. `src/pages/Index.tsx` - popular campos ao criar despesa
4. `src/components/expense-list.tsx` - usar campos desnormalizados
5. `src/components/recurring-expense-list.tsx` - mesma lógica

---

### Resultado Esperado

- Quando você criar uma despesa com "Alimentação" e "Cartão Smiles-Walter"
- Sua mãe verá "🍔 Alimentação" e "Crédito - Cartão Smiles-Walter"
- Mesmo sem ter esses itens cadastrados na conta dela
