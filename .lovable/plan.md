

## Plano: Configurar PWA para iPhone

O app atualmente **nao tem nenhuma configuracao PWA**. Quando um usuario de iPhone adiciona a tela inicial, aparece sem icone, sem nome correto e abre como uma aba do Safari. Vamos configurar tudo.

### O que sera feito

**1. Criar `public/manifest.json`**

Arquivo de manifesto com:
- `name`: "Gastinho Simples"
- `short_name`: "Gastinho"
- `start_url`: "/"
- `display`: "standalone" (abre como app, sem barra do Safari)
- `background_color` e `theme_color` com as cores do app
- Icones usando a imagem `Gastinho_Simples_icone.png` que ja existe no projeto

**2. Atualizar `index.html`**

Adicionar as meta tags necessarias para iOS:
- `<link rel="manifest">` apontando para o manifest.json
- `<meta name="apple-mobile-web-app-capable" content="yes">` (abre em tela cheia)
- `<meta name="apple-mobile-web-app-status-bar-style">` (estilo da barra de status)
- `<meta name="apple-mobile-web-app-title" content="Gastinho Simples">` (nome na tela inicial)
- `<link rel="apple-touch-icon">` apontando para o icone (isso e o que define o icone no iPhone)
- `<meta name="theme-color">` para a cor da barra do navegador

**3. Instalar e configurar `vite-plugin-pwa`**

- Instalar o pacote
- Configurar no `vite.config.ts` com:
  - Service worker para cache offline
  - `navigateFallbackDenylist` com `/~oauth` (obrigatorio para nao quebrar login)
  - Manifest com dados do app

### Resultado final

Quando o usuario de iPhone seguir os passos do tutorial na pagina de Contato:
- O icone do Gastinho Simples aparece na tela inicial
- O nome "Gastinho Simples" aparece embaixo do icone
- Ao abrir, o app funciona em tela cheia (sem barra do Safari)
- Funciona offline com cache basico

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| `public/manifest.json` | Novo - manifesto PWA |
| `index.html` | Adicionar meta tags Apple e link do manifest |
| `vite.config.ts` | Adicionar plugin vite-plugin-pwa |
| `package.json` | Adicionar dependencia vite-plugin-pwa |

