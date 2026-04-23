

# Plano: Refinar relatório "Gastos por Cartão"

## Problema atual
O gráfico inclui despesas PIX/Dinheiro (sem cartão) na categoria "Sem cartão", o que distorce o relatório — ele deveria refletir **apenas gastos em cartões**. Além disso, um mesmo cartão físico pode ser usado tanto em crédito quanto débito (ex: Banco do Brasil), e hoje aparece agrupado em uma única fatia.

## Decisão recomendada (responde à pergunta do usuário)

Vou recomendar a **opção 1 (Cartão + tipo)** ao invés de filtrar só crédito, porque:
- Preserva visibilidade do débito (que também é cartão e gera gasto real)
- Separa "Banco do Brasil - Crédito" de "Banco do Brasil - Débito" como o usuário pediu
- Não esconde dados — apenas reorganiza
- "Só crédito" perderia gastos legítimos de cartão e seria mais restritivo que o título sugere

A subdivisão crédito/débito **só aparece quando o mesmo cartão tem gastos nos dois tipos**. Cartão usado só em crédito mantém o nome simples ("Smiles - Vivi"), sem sufixo desnecessário.

## Mudanças

### 1. `src/utils/report-view-model.ts` — recalcular `cardData`

Refatorar o bloco `// Card data` (linhas 299–328):

- **Excluir** despesas com `payment_method === 'pix' | 'cash'` do agrupamento (usar helper `affectsCardBilling` não serve aqui porque débito também não afeta billing; usar lista explícita ou novo helper `usesCard(method)` que retorna `true` para credit/debit).
- **Remover** a entrada `'no-card'` do mapa inicial — não faz mais sentido.
- Agrupar por chave composta `${card_id}::${payment_method}` ao acumular.
- Após o agrupamento, para cada `card_id`, contar quantos tipos distintos (crédito/débito) tem:
  - Se **2 tipos** → nome final = `"${card.name} - Crédito"` e `"${card.name} - Débito"`, cores ligeiramente diferenciadas (cor base do cartão + opacidade/shade para débito)
  - Se **1 tipo** → nome final = `card.name` (sem sufixo)
- Ignorar despesas com `card_id` vazio mas `payment_method === 'credit' | 'debit'` (caso edge — sinal de dado inconsistente; logar `console.warn` e não somar).

Adicionar novo helper em `src/lib/payment-methods.ts`:
```ts
export function usesCard(method: PaymentMethod): boolean {
  return method === 'credit' || method === 'debit';
}
```

### 2. `src/components/reports-accordion.tsx` — adicionar texto explicativo

No bloco "Gastos por Cartão" (linhas 312–350), adicionar logo abaixo do `AccordionContent`, antes do gráfico:

```tsx
<p className="text-xs text-muted-foreground mb-3 text-center">
  Considera apenas despesas pagas com cartão de crédito ou débito.
  PIX e Dinheiro não entram nesta soma.
</p>
```

Também atualizar o subtítulo no header de `{cardData.length} cartões` para algo mais preciso quando há subdivisão — manter contagem de **cartões físicos únicos** (não de fatias do gráfico). Calcular no view-model como novo campo `uniqueCardCount`.

### 3. `src/services/pdf-export-service.ts` — espelhar UI

Na seção 6 (linha 512), adicionar a mesma frase explicativa antes da legenda do donut, garantindo paridade total UI ↔ PDF (regra do projeto).

## Lógica de cor para subdivisão crédito/débito

Quando um cartão se divide em duas fatias:
- **Crédito** mantém a cor original do cartão (`card.color`)
- **Débito** usa a mesma cor com opacidade reduzida via mistura com `#000` 30% (helper simples de manipulação de hex)

Isso preserva identidade visual do cartão e ainda permite distinguir os dois tipos no donut.

## Casos de teste obrigatórios

1. Cartão usado só em crédito → aparece como `"Smiles - Vivi"` (sem sufixo)
2. Cartão usado em crédito + débito → aparece como duas fatias `"Banco do Brasil - Crédito"` e `"Banco do Brasil - Débito"`
3. Despesa PIX/Dinheiro **não aparece** no gráfico (nem como "Sem cartão")
4. Texto explicativo visível na UI e no PDF
5. Período sem nenhuma despesa de cartão → bloco inteiro fica oculto (já tratado por `cardData.length > 0`)
6. Subtítulo do accordion mostra **número de cartões físicos únicos**, não de fatias

## Arquivos alterados

1. `src/lib/payment-methods.ts` — novo helper `usesCard`
2. `src/utils/report-view-model.ts` — refatoração do bloco `cardData` + novo campo `uniqueCardCount`
3. `src/components/reports-accordion.tsx` — texto explicativo + subtítulo dinâmico
4. `src/services/pdf-export-service.ts` — texto explicativo na seção 6

**Total:** 4 arquivos. Sem migration, sem mudança de schema.

