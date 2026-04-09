

## Plano: Layout adaptativo no Resumo do Mês para nunca truncar valores

### Problema
Com `grid-cols-3` fixo, quando o usuário tem zoom alto ou fonte grande no celular (ou tela muito estreita como Galaxy Z Fold dobrado), os valores monetários ficam com "..." porque o grid força 3 colunas independentemente do espaço disponível. O `break-all` ajuda mas não resolve quando o container inteiro é estreito demais.

### Solução
Trocar o `grid grid-cols-3` por `flex flex-wrap` com largura mínima por card. Assim:
- Em telas normais: os 3 cards ficam lado a lado (comportamento atual)
- Em telas muito estreitas ou com zoom: Entradas e Saídas ficam na primeira linha, Saldo desce para uma segunda linha centralizada
- Os valores nunca são truncados

### Mudança em `src/components/balance-summary.tsx`

Substituir:
```
<div className="grid grid-cols-3 gap-2 sm:gap-3">
```

Por:
```
<div className="flex flex-wrap justify-center gap-2 sm:gap-3">
```

E em cada card filho, adicionar `flex-1 min-w-[90px]` para que:
- `flex-1` permite crescer e ocupar espaço igual quando cabem 3
- `min-w-[90px]` garante largura mínima — se não couber 3 cards com 90px cada, o terceiro desce automaticamente

Também remover `overflow-hidden` e qualquer `truncate` residual dos valores, garantindo que o texto sempre quebre em vez de ser cortado.

### Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/balance-summary.tsx` | `grid-cols-3` → `flex flex-wrap` com `min-w-[90px]` nos cards |

