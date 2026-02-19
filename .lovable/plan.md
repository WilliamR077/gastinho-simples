

## Plano: Adicionar Footer com mensagem

### Mudanca

Criar um componente `Footer` reutilizavel e adiciona-lo nas paginas principais do sistema.

**1. Novo arquivo `src/components/footer.tsx`**

Componente simples com a mensagem "Toda Honra e Gloria a Jesus Cristo", estilizado de forma discreta e centralizada.

**2. Paginas que receberao o footer**

Adicionar o `<Footer />` no final do conteudo das seguintes paginas:
- `src/pages/Index.tsx` - Pagina principal
- `src/pages/Account.tsx` - Minha Conta
- `src/pages/Settings.tsx` - Configuracoes
- `src/pages/Reports.tsx` - Relatorios
- `src/pages/Subscription.tsx` - Assinaturas
- `src/pages/Cards.tsx` - Cartoes
- `src/pages/Auth.tsx` - Login

### Visual

O footer sera centralizado, com texto pequeno e discreto na cor `text-muted-foreground`, com um pequeno padding na parte inferior para nao ficar colado no conteudo.

### Resumo

| Local | Mudanca |
|-------|---------|
| `src/components/footer.tsx` | Novo componente Footer |
| 7 paginas | Importar e renderizar o Footer no final |

