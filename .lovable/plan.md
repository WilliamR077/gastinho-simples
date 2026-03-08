

## Plano: Adicionar link "Admin" no menu lateral (apenas para o admin)

O menu lateral (`AppMenuDrawer`) não tem nenhum item que leve à página `/admin`. Vamos adicionar um item condicional que só aparece quando o email do usuário logado é `gastinhosimples@gmail.com`.

### Mudança

| Arquivo | Ação |
|---|---|
| `src/components/app-menu-drawer.tsx` | Importar `useAuth` e `Shield` (lucide). Adicionar item "Admin" no `menuItems` condicionalmente, visível apenas para `gastinhosimples@gmail.com`. |

### Detalhes

- Importar `useAuth` de `@/hooks/use-auth` e o ícone `Shield` de `lucide-react`
- Dentro do componente, chamar `const { user } = useAuth()`
- Adicionar ao array `menuItems` (no final, antes dos Lembretes ou após Conta):
  ```
  { icon: Shield, label: "Admin", onClick: () => handleNavigate("/admin") }
  ```
  Apenas se `user?.email === "gastinhosimples@gmail.com"`
- Nenhuma outra mudança necessária — a rota `/admin` e a página já existem

