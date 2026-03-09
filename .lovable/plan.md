
## Plano: Tutorial Interativo com Sub-fases

### Problema Identificado
Quando o usuário clica "Ir para Cartões", ele é redirecionado mas o modal continua mostrando o mesmo botão. O tutorial precisa ter **sub-fases** dentro de cada step para guiar o usuário passo a passo.

### Solução

Reformular o onboarding para ter **fases internas** em cada step:

```
Step: add-card
├─ Fase 1: "navigate" → Mostrar botão "Ir para Cartões"
├─ Fase 2: "arrived" → Detectou que está em /cards → Guiar para clicar "+"
├─ Fase 3: "form-open" → Formulário aberto → Explicar campos
└─ Fase 4: "completed" → Cartão salvo → Perguntar se quer adicionar outro
```

### Mudanças Técnicas

**1. `src/hooks/use-onboarding-tour.tsx`**
- Adicionar `subPhase: "navigate" | "arrived" | "form-open" | "completed"` ao estado
- Detectar mudança de rota para avançar fase (ex: quando chega em `/cards` → mudar para "arrived")
- Exportar `setSubPhase` para componentes externos notificarem (ex: quando formulário abre)
- Nova função `askAddAnother()` para perguntar se quer repetir

**2. `src/components/onboarding-tour.tsx`**
- Renderização condicional baseada em `subPhase`:
  - "navigate" → Botão "Ir para Cartões"
  - "arrived" → Texto "Agora clique no botão + para adicionar" + destaque visual
  - "form-open" → Dicas sobre os campos do formulário
  - "completed" → Botões "Adicionar outro" / "Prosseguir"

**3. `src/components/card-manager.tsx`**
- Quando `showForm` muda para `true`, notificar onboarding: `setSubPhase("form-open")`
- Quando cartão é salvo com sucesso, não precisa mudar (Realtime já detecta)

**4. Detecção de rota**
- `useLocation()` no hook para detectar quando pathname muda para o `targetRoute`
- Automaticamente avançar subPhase de "navigate" → "arrived"

### Fluxo UX Final

1. Modal: "Vamos cadastrar seu primeiro cartão!" + [Ir para Cartões]
2. *Usuário clica* → Navega para /cards
3. Modal muda: "Ótimo! Agora toque no botão +" (com seta ou destaque)
4. *Usuário clica +* → Formulário abre
5. Modal muda: "Preencha os dados: Nome, Tipo, Vencimento..." (posição lateral/minimizada)
6. *Usuário salva* → Realtime detecta INSERT
7. Modal: "Cartão criado! 🎉" + [Adicionar outro] / [Prosseguir]

### Arquivos Afetados
| Arquivo | Mudança |
|---------|---------|
| `use-onboarding-tour.tsx` | Adicionar subPhase, detecção de rota, askAddAnother |
| `onboarding-tour.tsx` | UI condicional por subPhase |
| `card-manager.tsx` | Notificar quando form abre |
