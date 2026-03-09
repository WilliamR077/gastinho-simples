

# Plano: Tutorial Interativo de Configuração de Conta

## Avaliação da Ideia

**Excelente ideia!** Um tutorial interativo de onboarding que "pega pela mão" do usuário é muito mais eficaz do que apenas mostrar onde estão as funcionalidades. Isso resolve dois problemas:

1. **Engajamento inicial**: Usuários novos ficam perdidos sem dados na aplicação
2. **Aprendizado prático**: Fazer é melhor que apenas ver

## Arquitetura Proposta

Criar um **segundo sistema de tour** independente do atual:
- `use-onboarding-tour.tsx` - Hook dedicado ao onboarding
- `onboarding-tour.tsx` - Componente com lógica diferente do ProductTour
- Chave localStorage separada: `gastinho_onboarding_completed`

### Diferenças do Tour Atual

| Tour Atual (Demonstração) | Novo Tour (Onboarding) |
|---------------------------|------------------------|
| Passivo - apenas mostra | Ativo - usuário executa |
| 15 steps explicativos | 8-10 steps de ação |
| Spotlight em elementos | Modais interativos + navegação |
| Não verifica conclusão | Detecta quando tarefa foi concluída |
| Pula etapas livremente | Sequencial obrigatório |

## Fases do Tutorial Interativo

### **Fase 1: Configurar Primeiro Cartão** 🏦
- **Ação**: Navegar para /cards e adicionar cartão
- **Detecção**: Aguardar inserção na tabela `cards` 
- **Tooltip**: Modal flutuante com instruções + botão "Ir para Cartões"
- **Conteúdo**: "Para começar, vamos cadastrar seu primeiro cartão! Pode ser de crédito ou débito. Clique no botão abaixo para ir à página de cartões."

### **Fase 2: Adicionar Categorias Personalizadas** 📦
- **Ação**: Voltar para /, abrir CategoryManager (settings menu) e criar 1-2 categorias
- **Detecção**: Verificar `user_categories` > 0 (além das padrão)
- **Tooltip**: "Personalize suas categorias! Adicione uma categoria que faça sentido para você, como 'Academia' ou 'Pets'."
- **Opcional**: Pode pular se usuário preferir usar categorias padrão

### **Fase 3: Registrar Primeira Despesa** 💸
- **Ação**: Abrir FAB, adicionar despesa
- **Detecção**: Primeira entrada em `expenses`
- **Tooltip**: "Agora registre seu primeiro gasto! Toque no botão '+' e preencha os dados."

### **Fase 4: Adicionar Despesas Fixas** 🔄
- **Ação**: Tab "Despesas" → sub-tab "Fixas" → Adicionar recurring_expense
- **Detecção**: Primeira entrada em `recurring_expenses`
- **Tooltip**: "Cadastre suas contas mensais fixas (luz, internet, streaming). O app vai adicionar automaticamente todo mês!"
- **Exemplo sugerido**: "Netflix - R$ 29,90"

### **Fase 5: Registrar Primeira Entrada** 💰
- **Ação**: Tab "Entradas" → adicionar income
- **Detecção**: Primeira entrada em `incomes`
- **Tooltip**: "Registre sua primeira receita! Pode ser salário, freelance, venda..."

### **Fase 6: Definir Meta de Gastos** 🎯
- **Ação**: Tab "Metas" → adicionar budget_goal
- **Detecção**: Primeira entrada em `budget_goals`
- **Tooltip**: "Defina um limite de gastos para o mês! Isso te ajuda a não estourar o orçamento."

### **Fase 7: Configurar Segurança (PIN)** 🔐
- **Ação**: Menu → Configurações → Ativar bloqueio + definir PIN
- **Detecção**: `localStorage.getItem('gastinho_app_lock_pin')` exists
- **Tooltip**: "Proteja seus dados! Configure um PIN para bloquear o app quando estiver em segundo plano."
- **Condicional**: Só no mobile (Capacitor.isNativePlatform)

### **Fase 8: Importar Planilha** 📊
- **Ação**: Menu → Configurações → Importar Planilha
- **Detecção**: Importação bem-sucedida (expenses criados via import)
- **Tooltip**: "Se você já tem seus gastos em planilha, importe aqui! (Passo opcional)"
- **Opcional**: Botão "Pular" visível

### **Fase Final: Conclusão + CTA Premium** ✨
- **Ação**: Mostrar conquistas
- **Conteúdo**: 
  - "Parabéns! Você configurou sua conta! 🎉"
  - Lista do que foi feito (checkmarks)
  - CTA: "Quer mais? Com Premium você ganha: grupos compartilhados, relatórios avançados, exportação..."
  - Botões: "Conhecer Premium" / "Começar a usar"

## Estrutura de Dados

```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: "navigate" | "wait" | "modal";
  targetRoute?: string;
  detectionQuery?: {
    table: string;
    condition: (data: any) => boolean;
  };
  optional?: boolean;
  mobileOnly?: boolean;
}
```

## Detecção de Conclusão

Usar **Supabase Realtime** para detectar inserções:
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('onboarding-progress')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'cards' },
      () => completeStep('add-card')
    )
    .subscribe();
}, []);
```

## Fluxo de UX

1. **Gatilho**: Após completar o tour de demonstração, mostrar diálogo:
   - "Quer ajuda para configurar sua conta?"
   - Botões: "Sim, me ajude!" / "Não, vou explorar sozinho"

2. **Navegação automática**: Quando step requer outra página, mostrar modal com botão que navega

3. **Validação**: Não avança até ação ser concluída (exceto steps opcionais)

4. **Persistência**: Salvar progresso no localStorage para retomar depois

5. **Saída**: Botão "Sair do tutorial" sempre visível (confirma antes)

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/use-onboarding-tour.tsx` | Criar hook com state machine |
| `src/components/onboarding-tour.tsx` | Criar componente modal/overlay |
| `src/components/tour-premium-cta.tsx` | Reutilizar ou adaptar |
| `src/components/product-tour.tsx` | Adicionar pergunta ao final |
| `src/App.tsx` | Adicionar `<OnboardingTour />` |
| `src/pages/Index.tsx` | Listeners para eventos de conclusão |

## Considerações Técnicas

**Navegação entre páginas**: 
- Usar `useNavigate()` programaticamente
- Tooltip segue o usuário (state global)

**Detecção mobile-only**:
- Steps de segurança/PIN só aparecem se `Capacitor.isNativePlatform()`

**Gamificação**:
- Mostrar barra de progresso: "3/8 concluídas"
- Animações de confete ao completar

**Analytics**:
- Registrar qual step o usuário para
- Taxa de conclusão do onboarding

## Próximos Passos

1. Criar estrutura base (hook + componente)
2. Implementar navegação e detecção
3. Adicionar conteúdo e copy
4. Integrar com ProductTour existente
5. Testes end-to-end

