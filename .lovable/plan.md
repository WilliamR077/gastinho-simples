

## Gerenciamento de Categorias de Entrada Personalizadas

Criar um sistema completo de categorias de entrada personalizadas, seguindo o mesmo padrao usado nas categorias de despesas.

---

### Visao Geral

Hoje as categorias de entrada (Salario, Freelance, Investimentos, etc.) sao fixas no codigo. O objetivo e permitir que o usuario crie, edite, oculte e exclua categorias de entrada, igual ja funciona para despesas.

---

### 1. Migracao SQL - Nova tabela e colunas

**Tabela `user_income_categories`** - identica em estrutura a `user_categories`, mas para entradas:

```text
user_income_categories
- id (uuid, PK)
- user_id (uuid)
- name (text)
- icon (text)
- color (text)
- is_default (boolean)
- is_active (boolean)
- display_order (integer)
- created_at, updated_at (timestamps)
```

**Colunas novas** nas tabelas `incomes` e `recurring_incomes`:
- `income_category_id` (uuid, nullable) - referencia a `user_income_categories`

**RLS policies** - mesmas regras de `user_categories` (usuarios so acessam suas proprias categorias)

**Funcoes RPC**:
- `initialize_user_income_categories(user_id_param)` - cria categorias padrao de entrada (Salario, Freelance, Investimentos, etc.)
- `migrate_income_categories(user_id_param)` - migra entradas existentes do enum para category_id

---

### 2. Novos arquivos

| Arquivo | Descricao |
|---|---|
| `src/types/user-income-category.ts` | Tipos TypeScript (UserIncomeCategory, Insert, Update) |
| `src/hooks/use-income-categories.tsx` | Context Provider + hook, igual ao `use-categories.tsx` |
| `src/components/income-category-manager.tsx` | Sheet de gerenciamento (criar, editar, ocultar, excluir) |
| `src/components/income-category-selector.tsx` | Select com categorias personalizadas + botao "Gerenciar categorias" |

---

### 3. Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/main.tsx` ou `src/App.tsx` | Adicionar `IncomeCategoriesProvider` envolvendo a app |
| `src/components/unified-income-form-sheet.tsx` | Trocar Select estatico pelo `IncomeCategorySelector` |
| `src/components/income-form-sheet.tsx` | Trocar Select estatico pelo `IncomeCategorySelector` |
| `src/components/income-edit-dialog.tsx` | Trocar Select estatico pelo `IncomeCategorySelector` |
| `src/components/recurring-income-edit-dialog.tsx` | Trocar Select estatico pelo `IncomeCategorySelector` |
| `src/components/income-category-summary.tsx` | Adaptar para buscar nome/icone das categorias personalizadas |
| `src/components/budget-goal-form-sheet.tsx` | Usar categorias personalizadas de entrada no select de metas |
| `src/components/budget-goal-edit-dialog.tsx` | Idem |
| `src/components/budget-progress.tsx` | Adaptar comparacao de categorias para usar IDs |

---

### 4. Fluxo do usuario

1. Ao abrir formulario de entrada, ve suas categorias personalizadas
2. Pode clicar em "Gerenciar categorias..." no seletor
3. Abre sheet com lista de categorias ativas, formulario para adicionar, e categorias ocultas
4. Pode editar nome/icone, ocultar, ou excluir (entradas migram para "Outros")
5. Categorias novas ficam disponiveis imediatamente em todos os formularios

---

### Detalhes tecnicos

- A tabela `user_income_categories` e separada de `user_categories` para manter os dominios independentes
- As categorias padrao de entrada sao: Salario, Freelance, Investimentos, Vendas, Bonus, Presente, Reembolso, Aluguel, Outros
- A categoria "Outros" nao pode ser excluida (mesma regra das despesas)
- Ao excluir uma categoria, entradas associadas sao movidas para "Outros"
- O Provider global garante sincronizacao em tempo real entre todos os componentes
- Compatibilidade retroativa: se `income_category_id` estiver null, usa o enum `category` como fallback

