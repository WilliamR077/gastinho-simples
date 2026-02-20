

## Plano: Criar Landing Page, pagina Sobre e pagina de Contato

### Visao Geral

Criar 3 novas paginas publicas (sem precisar de login) que apresentam o Gastinho Simples para visitantes:

1. **Landing Page** (`/landing`) - Pagina inicial para quem nao esta logado
2. **Sobre** (`/about`) - Missao, valores e detalhes do app
3. **Contato / Links** (`/contact`) - Redes sociais, download Play Store e instrucoes PWA iPhone

### Fluxo de navegacao

Quando o usuario nao estiver logado e acessar `/`, sera redirecionado para `/landing` em vez de `/auth`. A landing page tera botoes para ir ao login, sobre e contato.

```text
Visitante acessa /
       |
       v
  /landing (publica)
   |       |       |
   v       v       v
 /auth   /about  /contact
```

---

### 1. Landing Page (`src/pages/Landing.tsx`)

Secoes da pagina:
- **Hero**: Logo, nome "Gastinho Simples", tagline, botao "Comecar Agora" (vai para /auth) e botao "Saiba Mais" (ancora para secao abaixo)
- **Funcionalidades**: Cards explicando as principais funcionalidades (controle de despesas, entradas, relatorios, metas, cartoes, grupos compartilhados)
- **Planos**: Resumo dos 3 planos (Gratis, Sem Anuncios, Premium) com precos e botao para ver mais detalhes
- **CTA final**: Chamada para acao com botao de cadastro
- **Footer**: Reutilizar o componente Footer existente (adicionando links para /about e /contact)

### 2. Pagina Sobre (`src/pages/About.tsx`)

Secoes:
- **Header**: "Sobre o Gastinho Simples"
- **Missao**: Ajudar as pessoas a terem controle financeiro de forma simples e acessivel
- **Feito no Brasil**: Destaque que e um app brasileiro
- **Valores**: Simplicidade, transparencia, acessibilidade
- **O que oferecemos**: Lista detalhada de recursos
- **Footer**

### 3. Pagina de Contato / Links (`src/pages/Contact.tsx`)

Esta e a pagina que vai no link do Instagram. Secoes:
- **Header**: Logo + nome
- **Botao Play Store**: Destaque grande para baixar no Android (link placeholder por enquanto)
- **Botao iPhone/PWA**: Ao clicar, abre um modal/dialog explicando passo a passo como instalar via Safari (Add to Home Screen), com instrucoes em texto
- **Redes sociais**: Botoes/icones para Instagram, Twitter/X, YouTube e TikTok (links placeholder)
- **Email de contato** (opcional)

### 4. Alteracoes em arquivos existentes

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar rotas `/landing`, `/about`, `/contact` |
| `src/pages/Index.tsx` | Mudar redirect de `/auth` para `/landing` quando nao logado |
| `src/components/footer.tsx` | Adicionar links para "Sobre" e "Contato" na secao Legal |

### 5. Novos arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/Landing.tsx` | Landing page completa |
| `src/pages/About.tsx` | Pagina sobre |
| `src/pages/Contact.tsx` | Pagina de contato/links |

---

### Detalhes tecnicos

- Todas as 3 paginas sao publicas (sem autenticacao)
- Usam os componentes UI existentes (Card, Button, Dialog, etc.)
- Responsivas com Tailwind CSS
- Tema escuro/claro funciona automaticamente
- Links das redes sociais ficam como placeholder (`#`) para trocar depois
- Link da Play Store fica como placeholder ate o usuario enviar
- Modal do iPhone usa o componente Dialog existente com instrucoes passo a passo em texto
- O versiculo de Romanos 11:36 continua no footer em todas as paginas

