

## Plano: Implementar Passo 7 — Configurações (Finalização da Conta)

### Visão Geral
Substituir os passos `setup-security` e `import-spreadsheet` por um único passo `setup-settings` que guia o usuário pela página de Configurações, cobrindo: segurança, exportação, importação de planilha, tutorial/ajuda e notificações.

### Navegação para Settings
O acesso é via Menu Drawer (hamburger). O passo precisa:
1. Abrir o menu (click no botão de menu no header)
2. Clicar em "Configurações" dentro do drawer

Isso requer `data-onboarding` no botão do menu e no item "Configurações" do drawer.

### Sequência de Substeps (~15)

| # | ID | Tipo | Target | Notas |
|---|-----|------|--------|-------|
| 1 | `settings-intro` | info | — | "Vamos finalizar sua configuração..." com botão Continuar |
| 2 | `settings-open-menu` | click | `settings-menu-button` | Destacar hamburger menu. autoAdvanceOnEvent: `menu-opened` |
| 3 | `settings-nav` | click | `settings-nav-item` | Destacar item "Configurações" no drawer. autoAdvanceOnRoute: `/settings` |
| 4 | `settings-security-section` | info | `settings-security-card` | Explicar segurança. scrollToTarget |
| 5 | `settings-lock-toggle` | click | `settings-lock-toggle` | "Toque para ativar o bloqueio." autoAdvanceOnEvent: `security-lock-toggled`. Na web, é info explicativo (security só funciona no mobile) |
| 6 | `settings-pin-info` | info | `settings-pin-dialog` | Explicar PIN. condition: DOM (dialog aberto). autoAdvanceOnEvent: `security-pin-saved` |
| 7 | `settings-biometric` | info | `settings-biometric-toggle` | Explicar biometria. condition: DOM (biometria disponível). Pular se não existir |
| 8 | `settings-timeout` | info | `settings-lock-timeout` | Explicar "Bloquear após". condition: DOM (lock ativado) |
| 9 | `settings-export` | info | `settings-export-card` | Explicar exportação + menção Premium. scrollToTarget |
| 10 | `settings-import` | info | `settings-import-card` | Explicar importação. scrollToTarget. Dois caminhos: skipLabel "Não tenho planilha" + navigateLabel "Tenho planilha" |
| 11 | `settings-import-open` | click | `settings-import-btn` | Abrir sheet de importação. autoAdvanceOnEvent: `import-sheet-opened`. condition: seenEvents não tem "settings-import-skipped" |
| 12 | `settings-import-done` | info | — | "Pronto, agora você sabe como importar." autoAdvanceOnEvent: `import-completed` OU substep info com Continuar. condition: seenEvents não tem "settings-import-skipped" |
| 13 | `settings-tutorial` | info | `settings-tutorial-card` | Explicar tutorial/ajuda. scrollToTarget |
| 14 | `settings-notifications` | info | `settings-notifications-card` | Explicar notificações. scrollToTarget |
| 15 | `settings-done` | info | — | Conclusão final do onboarding |

### Tratamento da Segurança na Web
Na web, o `SecuritySettings` mostra uma mensagem "disponível apenas no mobile". O tutorial deve:
- Mostrar substep 4 (explicar a seção) com texto adaptado: "No navegador, seus dados já são protegidos pelo login. No app mobile, você pode ativar PIN e biometria."
- Pular substeps 5-8 via `condition: DOM` (os toggles não existem na web)

### Tratamento da Importação
- No substep `settings-import`, usar `skipLabel: "Não tenho planilha"` que dispara evento `settings-import-skipped`
- Se skipado, substeps 11-12 são pulados via `condition: seenEvents`
- O skip deve ser persistido como passo resolvido (já funciona pelo engine: skipCurrentStep marca como completed)

### Mudanças por Arquivo

#### 1. `src/lib/onboarding/onboarding-steps.ts`
- Remover `setup-security` e `import-spreadsheet` do array
- Adicionar `setup-settings` como último passo (sem mobileOnly)
- Atualizar `STEP_LABELS` para refletir o novo passo

#### 2. `src/components/app-header.tsx`
- Adicionar `data-onboarding="settings-menu-button"` no botão hamburger (linha 82)

#### 3. `src/components/app-menu-drawer.tsx`
- Adicionar `data-onboarding="settings-nav-item"` no item "Configurações" (usar propriedade `dataOnboarding` no menuItems)
- Disparar evento `menu-opened` quando o drawer abrir

#### 4. `src/pages/Settings.tsx`
- Adicionar `data-onboarding` nos cards: `settings-security-card`, `settings-export-card`, `settings-import-card`, `settings-tutorial-card`, `settings-notifications-card`
- Adicionar `data-onboarding="settings-import-btn"` no botão de importar

#### 5. `src/components/security-settings.tsx`
- Adicionar `data-onboarding` nos elementos: `settings-lock-toggle` no Switch, `settings-biometric-toggle` no Switch de biometria, `settings-lock-timeout` no Select de timeout
- Disparar evento `security-lock-toggled` quando lock é ativado
- Disparar evento `security-pin-saved` quando PIN é salvo

#### 6. `src/hooks/use-onboarding-tour.tsx`
- Ajustar guided flow para suportar o menu drawer (precisa manter drawer aberto durante substep de navegação)
- Garantir que skip de import persista como step resolvido

### Resultado
- O passo 7 cobre segurança, exportação, importação, tutorial e notificações
- Funciona em desktop e mobile (segurança adapta-se)
- "Não tenho planilha" pula corretamente e persiste
- O onboarding conclui com mensagem de fechamento
- Nenhuma migração SQL

