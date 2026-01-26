
## Plano: Corrigir Bug de Sincronização de Categorias

### Problema Identificado
Quando você cria uma nova categoria (ex: "Viagem") e imediatamente adiciona uma despesa com ela, a despesa é salva com categoria "Outros" porque:

1. Cada componente que usa `useCategories()` tem sua **própria cópia** do estado de categorias
2. `CategoryManager` cria a categoria e atualiza seu estado local
3. `CategorySelector` atualiza seu estado via `refresh()`
4. **MAS** `Index.tsx` continua com o estado antigo (sem a nova categoria)
5. Quando `addExpense()` roda, ele busca a categoria pelo ID mas não encontra (porque está na lista desatualizada)
6. Resultado: `selectedCategory` é `null`, então usa fallback "Outros"

### Prova no Banco
As despesas foram salvas corretamente com o `category_id` da categoria "Viagem":
- `category_id`: `3fa32cb7-4682-4e38-9223-812c6064f2ae` (ID correto da categoria Viagem)
- Porém `category_name`: "Outros" e `category_icon`: "📦" (dados errados do fallback)

---

### Solução: Usar React Context para Compartilhar Estado

Transformar o hook `useCategories` em um **Context Provider** para que todos os componentes compartilhem a mesma instância do estado.

**Arquivos a modificar:**

#### 1. Criar Context Provider (`src/hooks/use-categories.tsx`)

```text
// Criar CategoriesContext e CategoriesProvider
// Todos os componentes usarão o mesmo estado

const CategoriesContext = createContext<CategoriesContextType | null>(null);

export function CategoriesProvider({ children }) {
  // Todo o estado atual fica aqui
  const [categories, setCategories] = useState([]);
  // ...resto da lógica
  
  return (
    <CategoriesContext.Provider value={...}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories deve ser usado dentro de CategoriesProvider");
  }
  return context;
}
```

#### 2. Adicionar Provider no App (`src/App.tsx`)

```text
<CategoriesProvider>
  <App />
</CategoriesProvider>
```

#### 3. Remover chamadas individuais do hook

Nenhuma mudança necessária nos componentes que usam `useCategories()` - eles automaticamente passarão a usar o contexto compartilhado.

---

### Benefícios

- Todos os componentes veem as mesmas categorias
- Quando uma categoria é criada, todos os componentes são atualizados instantaneamente
- O `addExpense()` no `Index.tsx` terá acesso à categoria recém-criada

---

### Resultado Esperado

1. Você cria a categoria "Viagem" com ícone ✈️
2. Seleciona "Viagem" no formulário de despesa
3. A despesa é salva com:
   - `category_id`: ID da categoria Viagem
   - `category_name`: "Viagem"
   - `category_icon`: "✈️"
