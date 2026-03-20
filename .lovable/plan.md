

## Plano Revisado: Reordenar Tutoriais + Botão "Configurar Conta" com Progresso

### Visão Geral

Reordenar a sequência de tutoriais (Tour → Onboarding → Premium CTA), adicionar botão "Configurar Conta" com progresso na Settings, e banner de progresso na tela principal.

---

### Parte 1 — Reordenar sequência: Tour → Onboarding → Premium CTA

**`src/hooks/use-product-tour.tsx`**
- `completeTour()`: em vez de `setShowPremiumCta(true)`, setar um novo state `showOnboardingPrompt` (mover essa lógica do product-tour.tsx para o hook)

**`src/components/product-tour.tsx`**
- Após o tour terminar: mostrar prompt de onboarding (se não concluído)
- Se pular onboarding: **agora** mostrar Premium CTA
- Se aceitar onboarding: ao final do onboarding, o completion dialog já tem Premium CTA embutido
- Fluxo: `Tour termina → onboarding prompt → (aceita: onboarding → completion com CTA) | (recusa: Premium CTA)`

### Parte 2 — `getSetupProgress()` no hook de onboarding

**`src/hooks/use-onboarding-tour.tsx`**

Expor nova função no contexto:
```ts
getSetupProgress: () => Promise<{
  completed: number;
  total: number;
  percentage: number;
  completedSteps: string[];
  pendingSteps: { id: string; label: string; emoji: string }[];
}>
```

Implementação:
- Reutilizar `checkExistingData()` que já existe
- **Reforço 1**: Filtrar `availableSteps` (que já exclui `mobileOnly` no desktop) para calcular o `total` correto por dispositivo
- Excluir `import-spreadsheet` (opcional, sempre "concluído") do cálculo de progresso para não inflar
- Retornar `pendingSteps` como array de `{ id, label, emoji }` para uso no banner

### Parte 3 — Botão "Configurar Conta" na Settings

**`src/pages/Settings.tsx`**

No card de "Tutorial" existente (linhas 457-484), adicionar abaixo do botão "Ver tutorial novamente":
- Separator
- Botão "Me ajude a configurar minha conta" com ícone `Sparkles`
- Barra `Progress` com `X de Y etapas (Z%)`
- Lista de etapas pendentes (máx 3) com ícone/emoji

**Reforço 3**: O botão estará **sempre visível**, independente de o onboarding ter sido pulado, fechado ou parcialmente concluído. Ele chama `startOnboarding()` que já faz skip automático de etapas com dados existentes.

Se progresso = 100%: mostrar "Conta configurada! ✅" em verde em vez da barra.

### Parte 4 — Banner de progresso na Index

**`src/components/setup-progress-banner.tsx`** (novo)

Banner discreto que:
- Mostra porcentagem e até **2-3 itens faltantes** (Reforço 2): `"Faltam: Cartões, Metas"`
- Botão "Continuar configuração" → `startOnboarding()`
- Botão X para dismiss → salvar `{ dismissed: true, timestamp: Date.now() }` em localStorage
- Reaparece após 7 dias do dismiss

Condições de exibição (**Reforço 4**):
- `isOpen === false` (não mostrar enquanto onboarding estiver rodando)
- `percentage < 100` (não mostrar se conta 100% configurada)
- Não foi dismissido nos últimos 7 dias
- Usuário logado

**`src/pages/Index.tsx`**

Adicionar `<SetupProgressBanner />` acima do `UpsellBanner`, passando o progresso como dados.

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/use-product-tour.tsx` | Ajustar `completeTour` para não mostrar Premium CTA diretamente |
| `src/components/product-tour.tsx` | Reordenar: tour → onboarding prompt → Premium CTA (se pular) |
| `src/hooks/use-onboarding-tour.tsx` | Expor `getSetupProgress()` com total correto por dispositivo |
| `src/pages/Settings.tsx` | Botão "Configurar conta" + barra de progresso no card Tutorial |
| `src/components/setup-progress-banner.tsx` | Novo: banner de progresso na Index |
| `src/pages/Index.tsx` | Adicionar `SetupProgressBanner` |

Nenhuma migração SQL necessária.

