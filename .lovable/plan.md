

## Plano: Corrigir caracteres corrompidos e melhorar gráficos no PDF

### Causa raiz

jsPDF usa fonte `helvetica` que **não suporta** emojis nem caracteres Unicode especiais (✨, 📦, ↑, ↓, 🎉). Esses caracteres aparecem como símbolos corrompidos no PDF gerado.

### Mudanças — apenas `src/services/pdf-export-service.ts`

**1. Criar helper `stripEmoji(text)`** para remover emojis/caracteres fora do range Latin básico:
```ts
const stripEmoji = (text: string) => text.replace(/[\u{1F000}-\u{1FFFF}]|[\u2700-\u27BF]|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
```

**2. Aplicar nos pontos problemáticos:**

| Linha | Atual | Corrigido |
|---|---|---|
| 370 | `'✨ Resumo Inteligente'` | `'Resumo Inteligente'` |
| 290 | `↑` / `↓` em `formatDeltaWithAbsolute` | `+` / `-` (ex: `+12% (+R$ 150)`) |
| 430 | `${cat.icon} ${cat.name}` | `cat.name` (sem ícone) |
| 680 | `"Excelente! 🎉"` | `"Excelente!"` |

**3. `formatDeltaWithAbsolute` — trocar setas por sinais texto:**
```ts
const sign = delta >= 0 ? "+" : "-";
return `${sign}${Math.abs(delta).toFixed(0)}% (${diffStr})`;
```

**4. Melhorar gráfico "Evolução dos Gastos" — label "Média" cortada:**
- Aumentar `padding.top` de 20 para 30 no `createLineChartCanvas`
- Mover label "Média: R$..." para dentro da área do gráfico com offset seguro (`avgY - 10` com clamp para não sair do canvas)
- Aumentar resolução: canvas width/height 2x (1000x440) e manter mesmo tamanho em `addImage`

**5. Aumentar resolução de todos os canvas helpers** (createPieChartCanvas, createDualBarChartCanvas, createLineChartCanvas):
- Duplicar width/height do canvas (scale 2x)
- Usar `ctx.scale(2, 2)` para manter coordenadas
- Resultado: gráficos mais nítidos no PDF

### Resumo

| O que | Onde |
|---|---|
| Remover emojis dos títulos | Linhas 370, 680 |
| Remover ícones das categorias | Linha 430 |
| Trocar ↑↓ por +/- | Função `formatDeltaWithAbsolute` (linha 290) |
| Label "Média" não cortada | `createLineChartCanvas` padding |
| Gráficos 2x resolução | 3 canvas helpers |

1 arquivo modificado, sem mudanças em cálculos/dados/UI.

