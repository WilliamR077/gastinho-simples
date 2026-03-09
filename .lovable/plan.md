
## Plano: Corrigir Spotlight das Abas no Tutorial

### Problema
Os seletores `[data-tour='tabs'] [value='expenses']` não funcionam porque o atributo `value` é um prop React que não aparece no DOM. O Radix UI renderiza como `data-value`, mas usar seletor próprio é mais confiável.

### Solução
Adicionar `data-tour` específico em cada TabsTrigger e atualizar os seletores.

### Mudanças

| Arquivo | Ação |
|---------|------|
| `src/pages/Index.tsx` | Adicionar `data-tour="tab-expenses"`, `data-tour="tab-incomes"`, `data-tour="tab-goals"` nos TabsTrigger (linhas 1721-1730) |
| `src/hooks/use-product-tour.tsx` | Atualizar seletores: `[data-tour='tab-expenses']`, `[data-tour='tab-incomes']`, `[data-tour='tab-goals']` |

### Código

**Index.tsx (linhas 1721-1730):**
```tsx
<TabsTrigger value="expenses" data-tour="tab-expenses" className="...">Despesas</TabsTrigger>
<TabsTrigger value="incomes" data-tour="tab-incomes" className="...">Entradas</TabsTrigger>
<TabsTrigger value="goals" data-tour="tab-goals" className="...">Metas...</TabsTrigger>
```

**use-product-tour.tsx (steps 8-10):**
```tsx
{ target: "[data-tour='tab-expenses']", ... },
{ target: "[data-tour='tab-incomes']", ... },
{ target: "[data-tour='tab-goals']", ... },
```

Isso fará o quadrado verde de destaque aparecer corretamente em cada aba individual durante o tutorial.
