

## Plano: Melhorar footer logado e pagina de Politica de Privacidade

### 1. Footer - Remover "Sobre" e "Contato" para usuarios logados

No arquivo `src/components/footer.tsx`, na coluna "Mais" do footer autenticado (linhas 78-83), remover os botoes "Sobre" e "Contato", deixando apenas "Politica de Privacidade".

### 2. Pagina de Politica de Privacidade - Redesign completo

No arquivo `src/pages/PrivacyPolicy.tsx`:

**Header novo:**
- Substituir o header atual (logo grande + botoes "Minha Conta" e "Sair") por um header simples com:
  - Botao de voltar (seta) que navega para `/` (home)
  - Logo pequeno + titulo "Politica de Privacidade"
  - Mesmo estilo do header da pagina About

**Conteudo com melhor formatacao:**
- Envolver o conteudo em um Card com padding adequado
- Adicionar espacamento entre secoes (cada h2 com margem superior)
- Usar `space-y` e separadores visuais entre secoes para o texto nao ficar "tudo junto"
- Manter todo o texto legal exatamente como esta, apenas melhorar a apresentacao visual

**Rodape:**
- Adicionar o componente `<Footer />` no final da pagina (com `isAuthenticated={false}` ja que e uma pagina publica)

### Resumo de mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/components/footer.tsx` | Remover links "Sobre" e "Contato" da coluna "Mais" (logado) |
| `src/pages/PrivacyPolicy.tsx` | Novo header com botao voltar, conteudo em Card com espacamento, adicionar Footer |
