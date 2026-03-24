

## Plano: Corrigir Interação Bloqueada no Spotlight do Onboarding

### Causa Raiz

O overlay em `onboarding-overlay.tsx` (linha 108) usa um `div` full-screen com `pointer-events-auto` no `z-[55]`. O SVG mask cria um buraco **visual**, mas **não** um buraco de pointer-events. O elemento-alvo recebe `z-index: 60`, mas como seu container pai (ex: FAB) tem `z-40`, o stacking context impede que o z-60 do filho supere o z-55 do overlay. Resultado: cliques são capturados pelo overlay, nunca chegam ao alvo.

### Solução

Substituir o div único full-screen com pointer-events por **4 painéis de bloqueio** ao redor do recorte + SVG visual sem pointer-events. Assim, a área do spotlight naturalmente permite cliques passarem para o elemento abaixo.

```text
┌──────────────────────────────┐
│      PAINEL TOPO (block)     │
├──────┬──────────┬────────────┤
│ LEFT │ SPOTLIGHT│   RIGHT    │
│(block)│ (pass)  │  (block)   │
├──────┴──────────┴────────────┤
│     PAINEL BAIXO (block)     │
└──────────────────────────────┘
```

### Mudanças

**`src/components/onboarding/onboarding-overlay.tsx`**

1. Manter o SVG intacto para o visual (escurecimento + máscara) mas setar `pointer-events-none` no div container principal
2. Adicionar 4 divs posicionados absolutamente ao redor do `targetRect` com `pointer-events-auto` para bloquear cliques fora do alvo
3. Remover a elevação forçada de z-index no elemento-alvo (linhas 49-56) — não é mais necessária pois o buraco agora é real
4. Manter o highlight border como `pointer-events-none`

**Nenhum outro arquivo precisa mudar.** A correção é sistêmica no componente de overlay.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/onboarding/onboarding-overlay.tsx` | Trocar pointer-events-auto por 4 painéis de bloqueio + SVG pointer-events-none |

