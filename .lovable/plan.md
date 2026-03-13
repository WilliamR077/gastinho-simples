

## Plano: Corrigir bug de categorias em grupo + cores por membro

### Causa Raiz do Bug

Todos os componentes de agregação por categoria (`category-summary.tsx`, `category-insight-card.tsx`, `report-view-model.ts`) usam `getCategoryInfo(category_id, category_enum)` que busca o `category_id` na tabela `user_categories` **do usuário logado**.

Cada usuário tem UUIDs próprios nas suas categorias. Quando o usuário A cria uma despesa com `category_id = "abc123"` (UUID da categoria "Alimentação" de A), e o usuário B visualiza, o sistema tenta encontrar `"abc123"` nas categorias de B — não encontra — e cai no fallback para "Outros".

A despesa já tem campos denormalizados `category_name` e `category_icon` (salvos no momento da criação). O `expense-list.tsx` já usa esses campos corretamente na sua `getCategoryDisplay`, mas os componentes de agregação ignoram esses campos.

### Correção do Bug

Modificar `getCategoryInfo` em 3 arquivos para priorizar `category_name`/`category_icon` denormalizados antes de tentar lookup por UUID:

1. **`src/components/category-summary.tsx`** — Alterar `getCategoryInfo` para aceitar `category_name`/`category_icon` e usá-los como primeira opção
2. **`src/components/category-insight-card.tsx`** — Mesma correção
3. **`src/utils/report-view-model.ts`** — Mesma correção

A lógica será:
```
1. Se category_name existe → usar category_name + category_icon (dados denormalizados confiáveis)
2. Se category_id existe E pertence ao usuário logado → usar lookup (funciona para despesas pessoais)
3. Fallback: usar categoryLabels[enum] ou "Outros"
```

Agrupar por `category_name` (string) em vez de `category_id` (UUID) para que despesas de membros diferentes com mesma categoria sejam consolidadas corretamente.

### Melhoria Visual 1: Cores por membro

**`src/components/group-member-summary.tsx`**:
- Já tem `MEMBER_COLORS` mas atribui por index do array `groupMembers` (que varia com sort). 
- Corrigir: atribuir cor de forma determinística por **posição de `joined_at`** (ordem estável de entrada no grupo), não por posição no array pós-sort.
- Exportar uma função `getMemberColor(userId, groupMembers)` para reuso.

Nova paleta com melhor contraste no tema escuro:
```typescript
const MEMBER_COLORS = [
  "#22d3ee", // cyan
  "#a78bfa", // violet  
  "#fbbf24", // amber
  "#34d399", // emerald
  "#fb923c", // orange
  "#f472b6", // pink
  "#60a5fa", // blue
  "#e879f9", // fuchsia
];
```

### Melhoria Visual 2: Cor do nome nas despesas

**`src/components/expense-list.tsx`**:
- Importar `getMemberColor` 
- Aplicar `style={{ color: getMemberColor(expense.user_id, groupMembers) }}` no `<span>` do nome do membro

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/category-summary.tsx` | Priorizar category_name/icon denormalizados, agrupar por nome |
| `src/components/category-insight-card.tsx` | Mesma correção |
| `src/utils/report-view-model.ts` | Mesma correção |
| `src/components/group-member-summary.tsx` | Cores determinísticas por joined_at, exportar getMemberColor |
| `src/components/expense-list.tsx` | Aplicar cor do membro no nome |

