

## Plano: Corrigir erro ao adicionar despesa quando categorias nao estao inicializadas

### Problema

Quando um usuario entra em um grupo compartilhado mas nunca teve suas categorias personalizadas criadas no banco de dados, o seletor de categorias faz um fallback para as categorias estaticas (enum). O problema e que nesse caso o **valor selecionado e o nome do enum** (ex: `"moradia"`) em vez de um **UUID**. Esse valor e enviado como `category_id` para o Supabase, que espera um UUID, causando o erro `invalid input syntax for type uuid: "moradia"`.

### Causa raiz

No arquivo `src/components/category-selector.tsx`, linha 42:

```
const useStaticCategories = loading || activeCategories.length === 0;
```

Quando `activeCategories` esta vazio (usuario sem categorias inicializadas), o select mostra os itens estaticos com `value={key}` (ex: `"moradia"`). Esse valor vai parar no campo `categoryId` do formulario, que e enviado como `category_id` (tipo UUID) no insert.

### Solucao

Duas mudancas complementares:

**1. `src/pages/Index.tsx` - Validar categoryId antes de enviar**

Na funcao `addExpense`, antes de montar o objeto de insert, verificar se `categoryId` e realmente um UUID valido. Se nao for (ex: `"moradia"`), usar o valor como campo `category` (enum) em vez de `category_id`.

Isso garante que mesmo com o fallback estatico, a despesa e salva corretamente.

**2. `src/components/category-selector.tsx` - Inicializar categorias automaticamente**

Quando `activeCategories.length === 0` e o loading terminou, chamar automaticamente a funcao `initialize_user_categories` do banco para criar as categorias do usuario. Isso garante que na proxima vez o seletor ja mostra as categorias corretas com UUIDs.

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Index.tsx` | Na funcao `addExpense`: validar se `categoryId` e UUID antes de usar como `category_id`. Se for string enum, colocar no campo `category` e omitir `category_id` |
| `src/components/category-selector.tsx` | Adicionar `useEffect` para chamar `initialize_user_categories` via Supabase RPC quando categorias estao vazias apos o loading |

### Validacao de UUID

Usar regex simples para verificar se o valor e UUID:

```typescript
const isUUID = (value: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
```

Se `categoryId` nao passar nessa validacao, tratar como nome de enum e colocar no campo `category` do insert.

