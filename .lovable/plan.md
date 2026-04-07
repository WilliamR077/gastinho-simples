

## Plano: Dashboard mais limpo com indicador de configuração no header

### Resumo
Remover os dois banners (SetupProgressBanner e UpsellBanner) da home e criar um indicador compacto no header que, ao ser tocado, abre um painel dropdown/popover com o progresso de configuração da conta.

### Mudanças

#### 1. `src/pages/Index.tsx`
- Remover imports de `SetupProgressBanner` e `UpsellBanner`
- Remover os dois componentes `<SetupProgressBanner />` e `<UpsellBanner />` do JSX (linhas ~1957-1960)

#### 2. `src/components/app-header.tsx` — Indicador de configuração
- Importar `useOnboardingTour` e `useAuth`
- Adicionar estado para controlar abertura do painel (`popoverOpen`)
- Entre o logo e os botões da direita (ou junto aos botões da direita, antes do botão de relatórios), renderizar condicionalmente um botão-ícone compacto:
  - Ícone: `Sparkles` (consistente com o onboarding existente) com um pequeno dot/badge verde pulsante
  - Aparece apenas quando `progress.percentage < 100`
  - Ao atingir 100%, desaparece silenciosamente
- Usar `Popover` (do shadcn/ui) como container do painel — abre abaixo do botão, alinhado à direita
- O `PopoverContent` contém:
  - Título "Configure sua conta"
  - Barra de progresso (`Progress`) com percentual
  - Lista de pendências (emoji + label) — máximo 4 itens
  - Botão CTA "Continuar configuração" que chama `startOnboarding()` e fecha o popover
- Estilo: `bg-card border border-border rounded-xl shadow-lg`, sem cores gritantes, tom neutro/verde sutil

#### 3. Estilo do indicador no header
- Botão ghost com `relative` para posicionar o dot
- Dot: `absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse`
- Quando popover está aberto: highlight sutil no botão (`bg-primary/10`)
- Touch area mínima de 44x44px (mesmo padrão dos outros botões)

#### 4. Comportamento
- O `getSetupProgress()` é chamado uma vez ao montar o header (com cache via `useEffect`)
- Se progresso = 100% → botão não renderiza (cleanup visual completo)
- Se onboarding está ativo (`isOpen`) → botão não renderiza (evitar conflito)
- Ao clicar "Continuar configuração" → fecha popover, chama `startOnboarding()`

#### 5. Arquivos que podem ser removidos (dead code)
- `src/components/setup-progress-banner.tsx` — não é mais usado em lugar nenhum
- `src/components/upsell-banner.tsx` — não é mais usado em lugar nenhum

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Remover imports e uso dos 2 banners |
| `src/components/app-header.tsx` | Adicionar indicador + popover de progresso |
| `src/components/setup-progress-banner.tsx` | Remover arquivo |
| `src/components/upsell-banner.tsx` | Remover arquivo |

Nenhuma migração SQL.

