

## Plano: Remover espaço preto abaixo do footer

**Arquivo: `src/pages/Index.tsx` linha 1515**

Reduzir `pb-44` (176px) para `pb-24` (96px) — mantém espaço suficiente para o FAB flutuante sem criar espaço preto visível abaixo do footer.

```tsx
// De:
<div className="min-h-screen bg-background pb-44">

// Para:
<div className="min-h-screen bg-background pb-24">
```

1 arquivo, 1 linha.

