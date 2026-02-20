

## Plano: Corrigir pagina de login

### Problemas identificados

1. **Footer na pagina de login** - O footer esta aparecendo ao lado do card de login, quebrando o layout. Deve ser removido dessa pagina.
2. **Nome errado** - O titulo mostra "AppGastos" em vez de "Gastinho Simples".
3. **Falta o icone/logo** - A pagina de login nao tem o icone do sistema.

### Correcoes

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Auth.tsx` | Remover a importacao e o uso do `<Footer />` |
| `src/pages/Auth.tsx` | Trocar "AppGastos" por "Gastinho Simples" no titulo |
| `src/pages/Auth.tsx` | Adicionar a imagem do logo acima do titulo (usando `/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png`) |
| `src/pages/Auth.tsx` | Trocar a descricao "Gerencie seus gastos de forma simples" por "Controle seus gastos de forma simples" para ficar consistente com o footer |

Sao apenas alteracoes no arquivo `Auth.tsx`. As demais paginas permanecem com o footer normalmente.

