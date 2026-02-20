

## Plano: Atualizar links reais na pagina de Contato

### Mudancas no arquivo `src/pages/Contact.tsx`

**1. Atualizar URLs das redes sociais (linhas 25-50)**

| Rede | URL atual | URL nova |
|------|-----------|----------|
| Instagram | `#` | `https://www.instagram.com/gastinhosimples/` |
| YouTube | `#` | `https://www.youtube.com/@GastinhoSimples` |
| Twitter / X | `#` | Manter `#` (placeholder) |
| TikTok | `#` | Manter `#` (placeholder) |

**2. Atualizar link do Google Play (linha 107)**

Trocar `window.open("#", "_blank")` por `window.open("https://play.google.com/store/apps/details?id=com.gastinhosimples.app", "_blank")`

**3. Dialog do iPhone (PWA) - ja funciona**

O dialog com passo a passo ja existe e abre corretamente ao clicar no botao. Nenhuma mudanca necessaria aqui por enquanto. Futuramente, pode-se adicionar um link para um video do YouTube com o tutorial.

---

Apenas 1 arquivo alterado: `src/pages/Contact.tsx`. Mudancas em 3 pontos (Instagram URL, YouTube URL, Google Play URL).

