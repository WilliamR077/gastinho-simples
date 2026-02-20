

## Plano: Melhorias na Landing Page e Footer

### Resumo das mudancas

4 alteracoes principais:

1. **Header de navegacao na Landing** com botoes para Sobre, Contato e Entrar
2. **Footer condicional** (links diferentes para logado vs nao logado)
3. **Corrigir precos e detalhes dos planos** copiando da pagina de assinaturas
4. **Landing como pagina principal** (rota `/` mostra Landing quando nao logado)

---

### 1. Header de navegacao na Landing Page

Adicionar uma barra de navegacao no topo da landing com:
- Logo + nome "Gastinho Simples" (esquerda)
- Botoes: "Sobre", "Contato", "Entrar" (direita)

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Landing.tsx` | Adicionar header com navegacao |

---

### 2. Footer condicional (logado vs nao logado)

O Footer vai receber uma prop `isAuthenticated` (opcional, padrao `true` para nao quebrar nada).

**Quando NAO logado**, mostra:
- Links Rapidos: Inicio, Sobre, Contato
- Mais: Politica de Privacidade, Criar Conta (leva para /auth)

**Quando logado** (comportamento atual):
- Links Rapidos: Inicio, Relatorios, Cartoes
- Conta: Minha Conta, Assinatura, Configuracoes
- Mais: Sobre, Contato, Politica de Privacidade

| Arquivo | Mudanca |
|---------|---------|
| `src/components/footer.tsx` | Adicionar prop `isAuthenticated` e renderizar links diferentes |
| `src/pages/Landing.tsx` | Passar `isAuthenticated={false}` ao Footer |
| `src/pages/About.tsx` | Passar `isAuthenticated={false}` ao Footer (pagina publica) |
| `src/pages/Contact.tsx` | Passar `isAuthenticated={false}` ao Footer (pagina publica) |

---

### 3. Corrigir precos e features dos planos

Copiar os dados exatos da pagina de assinaturas (`SUBSCRIPTION_FEATURES`):

| Plano | Preco correto | Features |
|-------|---------------|----------|
| Gratuito | R$ 0 | Ate 2 cartoes, 1 meta, relatorios do mes atual, participar de grupos, com anuncios |
| Sem Anuncios | R$ 4,90/mes | Ate 2 cartoes, 1 meta, relatorios do mes atual, participar de grupos, sem anuncios |
| Premium | R$ 14,90/mes | Cartoes e metas ilimitados, todos os periodos, criar ate 3 grupos, exportar PDF/Excel, sem anuncios |

A ordem dos cards sera: Gratuito, Sem Anuncios, Premium (igual a pagina de assinaturas).

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Landing.tsx` | Corrigir array `plans` com precos e features corretos |

---

### 4. Landing como pagina principal

Quando o usuario nao esta logado e acessa `/`, a pagina Index ja redireciona para `/landing`. A mudanca aqui e fazer a rota `/` renderizar a Landing diretamente quando nao logado, sem redirect. Isso evita o flash de redirecionamento.

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Trocar rota `/` para renderizar um componente que decide entre Index (logado) e Landing (nao logado) |

Alternativa mais simples: manter o redirect atual no `Index.tsx` que ja faz `navigate("/landing")`, mas mudar para que a landing fique na rota `/` e o dashboard fique em `/dashboard` ou mantenha em `/`. Vou usar a abordagem mais simples: a rota `/` continua apontando para Index, que redireciona para `/landing` (ja funciona assim). Nenhuma mudanca necessaria aqui pois ja esta implementado.

---

### Arquivos afetados

| Arquivo | Tipo de mudanca |
|---------|----------------|
| `src/pages/Landing.tsx` | Header de navegacao + corrigir planos |
| `src/components/footer.tsx` | Prop `isAuthenticated` para links condicionais |
| `src/pages/About.tsx` | Passar `isAuthenticated={false}` ao Footer |
| `src/pages/Contact.tsx` | Passar `isAuthenticated={false}` ao Footer |

