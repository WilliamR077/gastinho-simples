

## Plano: Overlay escuro + tooltip posicionado + detecção de conclusão

### Problemas atuais
1. O banner fica no rodapé da tela, longe do botão destacado
2. Não tem overlay escuro bloqueando o resto da tela — o usuário pode clicar em qualquer lugar
3. Após adicionar cartão, o tutorial não muda para "Deseja adicionar outro?" (a fase "completed" não está sendo acionada corretamente)

### Solução

**1. Overlay escuro com recorte (spotlight)**

Adicionar um overlay `fixed inset-0` com `bg-black/70 z-[55]` que escurece toda a tela. O elemento alvo (botão "+", campo do formulário) fica com `z-[60]` acima do overlay, criando o efeito de "spotlight" onde só o alvo é clicável.

**2. Tooltip flutuante posicionado próximo ao alvo**

Em vez de banner fixo no bottom, calcular a posição do elemento alvo via `getBoundingClientRect()` e renderizar o tooltip logo abaixo (ou acima) dele. O tooltip tem `z-[65]` para ficar acima do overlay.

**3. Corrigir detecção de conclusão**

O Realtime pode falhar por latência. Adicionar detecção complementar: no `handleSubmit` do `card-manager.tsx`, após o INSERT com sucesso, chamar `setSubPhase("completed")` diretamente (sem depender apenas do Realtime).

### Mudanças por arquivo

**`src/components/onboarding-tour.tsx`**
- Nas fases `arrived` e `form-open`: renderizar overlay escuro (`fixed inset-0 bg-black/70 z-[55]`)
- Calcular posição do elemento `[data-onboarding="..."]` via `getBoundingClientRect()` e posicionar tooltip próximo a ele
- O tooltip fica com `z-[65]`, o alvo com `z-[60]`
- Usar `useEffect` + `ResizeObserver`/`setInterval` para recalcular posição se a tela rolar ou redimensionar

**`src/components/card-manager.tsx`**
- No `handleSubmit`, após INSERT bem-sucedido (não editando), chamar `setSubPhase("completed")` diretamente
- Adicionar `data-onboarding="card-form"` no formulário para a fase `form-open`

**`src/hooks/use-onboarding-tour.tsx`**
- Sem grandes mudanças, apenas garantir que a fase "completed" mostra o Dialog com "Adicionar outro" / "Prosseguir" (já funciona no código atual)

### Layout visual

```text
┌─────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░ Meus Cartões ░░░░░ [+] ← SPOTLIGHT ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░┌──────────────┐░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░│ 👆 Passo 1/7 │░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░│ Clique no +  │░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░│ para adicionar│░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░└──────────────┘░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────────┘
  ░ = overlay escuro (não clicável)
```

### Arquivos afetados
| Arquivo | Mudança |
|---------|---------|
| `onboarding-tour.tsx` | Overlay escuro + tooltip posicionado por getBoundingClientRect |
| `card-manager.tsx` | Chamar setSubPhase("completed") após INSERT bem-sucedido |

