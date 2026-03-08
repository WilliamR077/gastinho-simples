

## Plano: Unificar abas Assinaturas + Usuários e melhorar UX

### Resumo
Juntar as abas "Assinaturas" e "Usuários" numa aba única "Usuários". A listagem ocupa a tela toda. Ao clicar num usuário, abre um Dialog/modal com detalhes e ações (incluindo gerenciar assinatura inline). Adicionar filtros por plano e ordenação.

### Mudanças

| Arquivo | Ação |
|---|---|
| `src/pages/Admin.tsx` | Refatorar para 4 abas (remover "Assinaturas"), unificar lógica |

### Detalhes

**1. Tabs: de 5 para 4**
- Remover aba "Assinaturas"
- Manter: Visão Geral, Usuários, Notificações, Logs
- `grid-cols-5` → `grid-cols-4`

**2. Listagem full-height**
- Remover `max-h-96` da lista de usuários
- Usar `min-h-[calc(100vh-16rem)]` no container da lista para preencher a tela

**3. Filtros na aba Usuários**
- Filtro por email (já existe)
- Filtro por plano: Select com opções "Todos", "Premium", "Sem Anúncios", "Gratuito"
- Ordenação: Select com "Mais recentes", "Mais antigos", "A-Z", "Z-A"
- Barra de filtros horizontal acima da lista

**4. Modal ao clicar no usuário**
- Substituir o card inline de detalhes por um `Dialog`
- Modal mostra: email, data cadastro, plano, stats (despesas/receitas/cartoes/grupos), últimas transações
- Botões de ação: "Gerenciar Assinatura", "Excluir Conta"

**5. Gerenciar Assinatura dentro do modal**
- Ao clicar "Gerenciar Assinatura" no modal, mostrar inline (dentro do mesmo modal) o formulário de conceder/revogar plano (Select de tier + botão)
- Reutilizar a lógica de `handleAction` que chama `SUBS_API`
- Após ação, atualizar a lista de usuários e refresh dashboard

**6. Remover `SubscriptionsTab`**
- Toda a lógica de subscribers e gerenciamento migra para dentro do `UsersTab` + modal

