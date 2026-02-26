

## Plano: Remover padrões web e otimizar para mobile

Apenas UI/estilo/layout — sem alterar backend, dados ou rotas.

---

### 1. Substituir paginação por "Carregar mais"

**Arquivo: `src/components/expense-list.tsx`**

- Remover imports de Pagination (linhas 8-16): `PaginationContent`, `PaginationEllipsis`, `PaginationItem`, `PaginationLink`, `PaginationNext`, `PaginationPrevious`
- Trocar `currentPage` state por `visibleCount` state, iniciando em 10
- Em vez de `currentExpenses = expenses.slice(startIndex, endIndex)`, usar `currentExpenses = expenses.slice(0, visibleCount)`
- Substituir bloco de paginação (linhas 204-239) por botão "Carregar mais":
```tsx
{visibleCount < expenses.length && (
  <div className="py-4 px-4">
    <Button
      variant="outline"
      size="sm"
      className="w-full touch-manipulation"
      onClick={() => setVisibleCount(v => Math.min(v + 10, expenses.length))}
    >
      Carregar mais ({expenses.length - visibleCount} restantes)
    </Button>
  </div>
)}
```
- Remover lógica `totalPages`, `startIndex`, `endIndex`, `currentPage > totalPages`

**Arquivo: `src/components/income-list.tsx`**

- Mesmo padrão: trocar `currentPage` por `visibleCount` (início 10)
- Remover imports de `ChevronLeft`, `ChevronRight` (linha 15)
- Substituir paginação com setas (linhas 143-164) por botão "Carregar mais"
- Remover `totalPages`, `startIndex`

---

### 2. Remover footer longo do mobile (autenticado)

**Arquivo: `src/components/footer.tsx`**

Para usuários autenticados, simplificar drasticamente o footer — remover grid de links (Início, Relatórios, Cartões, Conta, Assinatura, Configurações) que já estão no menu drawer. Manter apenas:

- Versículo bíblico
- Copyright
- Link "Política de Privacidade" (único link útil que não está no drawer)

Trocar o bloco autenticado (linhas 52-82) por:
```tsx
{isAuthenticated ? (
  <div className="space-y-2 text-center">
    <button onClick={() => navigate("/privacy")} className="text-xs text-muted-foreground hover:text-foreground">
      Política de Privacidade
    </button>
  </div>
) : (
  // manter bloco visitor como está
)}
```

Reduzir padding: `pt-10` → `pt-6`, `space-y-8` → `space-y-4`, remover logo duplicada (já está no header).

---

### 3. FAB não sobrepor conteúdo — padding nas páginas com footer

O `pb-44` no `Index.tsx` já cobre o FAB. Porém, o `<Footer>` fica APÓS o container `pb-44`, então não há problema. O FAB só existe no Index.tsx. Sem alteração adicional necessária.

---

### 4. Texto duplicado "Restam R$" no card Limite Mensal Total

**Arquivo: `src/components/budget-progress.tsx`**

No `renderExpenseGoal`, quando `alertLevel !== 'safe'`, há duplicação:
- Linha 311: `Restam {formatCurrency(remaining)}` (texto abaixo da barra)
- Linha 322: `Restam {formatCurrency(remaining)}` (banner slim)

Solução: quando o banner slim está visível (alertLevel !== 'safe'), ocultar a linha 302-314 ("Restam/Excedeu" abaixo da barra de progresso), pois o banner já comunica a mesma informação com CTA.

Substituir linhas 302-314 por:
```tsx
{alertLevel === 'safe' && (
  <div className="flex items-center justify-between text-xs">
    <div className="flex items-center gap-1 text-muted-foreground">
      <TrendingDown className="h-3.5 w-3.5" />
      <span>Restam {formatCurrency(remaining)}</span>
    </div>
  </div>
)}
```

Assim: quando safe → mostra "Restam" abaixo da barra; quando warning/danger/critical → mostra apenas o banner slim com "Restam/Estourou" + botão Ajustar, sem duplicação.

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `expense-list.tsx` | Paginação → "Carregar mais" com `visibleCount` |
| `income-list.tsx` | Paginação → "Carregar mais" com `visibleCount` |
| `footer.tsx` | Remover grid de links para autenticados, manter só privacidade + copyright |
| `budget-progress.tsx` | Remover texto "Restam" duplicado quando banner slim está visível |

4 arquivos. Sem alteração de lógica ou dados.

