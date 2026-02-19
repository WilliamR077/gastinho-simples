

## Plano: Corrigir link da Política de Privacidade no footer

### Problema

A página já existe e está registrada na rota `/privacy`, mas o footer aponta para `/privacy-policy`, causando um 404.

### Correção

| Arquivo | Mudança |
|---------|---------|
| `src/components/footer.tsx` | Alterar o link de `/privacy-policy` para `/privacy` (linha 68) |

Apenas uma linha precisa ser alterada. Nenhuma página nova é necessária.

