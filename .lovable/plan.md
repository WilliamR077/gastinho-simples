

## Plano: Remover Product Tour e manter apenas Onboarding de Configuração

### Resumo
Remover o tour de UI ("Product Tour") que mostra onde cada botão está, e fazer com que novos usuários entrem direto no onboarding "Configure sua conta". O banner Premium já aparece ao final do onboarding — nada muda nessa parte.

### Mudanças

#### 1. `src/pages/Index.tsx`
- Remover import e uso de `<ProductTour />`

#### 2. `src/hooks/use-onboarding-tour.tsx`
- No `startOnboarding` (ou no useEffect de auto-start), marcar `gastinho_tour_completed = true` no localStorage para que o product tour nunca tente abrir caso algum resquício de código o referencie
- Auto-iniciar o onboarding para novos usuários: se `gastinho_onboarding_completed` não existir no localStorage E o usuário estiver logado, iniciar automaticamente após 1s de delay (mesma lógica que o product tour usava)

#### 3. `src/pages/Settings.tsx`
- Onde hoje existe o botão "Rever tour" que faz `localStorage.removeItem(TOUR_STORAGE_KEY)` e navega para `/`, mudar para resetar o onboarding de configuração ao invés do product tour
- Usar `startOnboarding()` do hook de onboarding

#### 4. Arquivos que podem ser removidos (dead code)
- `src/components/product-tour.tsx`
- `src/components/tour-overlay.tsx`
- `src/components/tour-step.tsx`
- `src/components/tour-premium-cta.tsx`
- `src/hooks/use-product-tour.tsx`

Os `data-tour=` attributes espalhados nos componentes podem ficar (são inofensivos) ou ser removidos para limpeza — preferência por deixar para minimizar diff.

### Fluxo do novo usuário
1. Usuário faz login pela primeira vez
2. Após 1s, o onboarding "Configure sua conta" inicia automaticamente
3. Ao finalizar todos os 7 passos, aparece o dialog de conclusão com botão "Conhecer Premium"
4. Usuário usa o app normalmente

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Remover `<ProductTour />` e import |
| `src/hooks/use-onboarding-tour.tsx` | Auto-start para novos usuários |
| `src/pages/Settings.tsx` | Botão "Rever tour" → resetar onboarding |
| `src/components/product-tour.tsx` | Remover arquivo |
| `src/components/tour-overlay.tsx` | Remover arquivo |
| `src/components/tour-step.tsx` | Remover arquivo |
| `src/components/tour-premium-cta.tsx` | Remover arquivo |
| `src/hooks/use-product-tour.tsx` | Remover arquivo |

Nenhuma migração SQL.

