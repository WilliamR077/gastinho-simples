

## Plano: Corrigir navegacao apos Login com Google no App Nativo

### Problema raiz
Analisando os logs do Supabase, o login com Google **esta funcionando** no backend -- o code PKCE e trocado por sessao com sucesso (status 200). O problema e que, apos o `exchangeCodeForSession` completar, o app continua na tela de login porque nada forca a navegacao para a tela principal.

O `Auth.tsx` so verifica a sessao **uma vez** quando monta o componente (no `useEffect` com `getSession`). Quando o deep link retorna e a sessao e criada, o Auth.tsx ja esta montado e nao re-verifica.

### Solucao

Duas mudancas simples:

**1. `src/App.tsx` - Forcar navegacao apos login bem-sucedido**

Apos `exchangeCodeForSession` retornar com sucesso, forcar `window.location.href = '/'` para que o app recarregue na tela principal ja com a sessao ativa:

```text
if (code) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Erro ao trocar code por sessao:', error);
  } else {
    // Forcar navegacao para a tela principal apos login
    window.location.href = '/';
  }
  return;
}
```

**2. `src/pages/Auth.tsx` - Escutar mudancas de autenticacao**

Adicionar um listener `onAuthStateChange` no Auth.tsx para que, se o usuario for autenticado enquanto esta na tela de login (por qualquer metodo), o app navegue automaticamente:

```text
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      navigate("/");
    }
  });

  return () => subscription.unsubscribe();
}, [navigate]);
```

### Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar `window.location.href = '/'` apos `exchangeCodeForSession` bem-sucedido |
| `src/pages/Auth.tsx` | Adicionar listener `onAuthStateChange` para navegar ao fazer login |

### Apos as mudancas
1. Faca `git pull`
2. Rode `npx cap sync`
3. Rode `npx cap run android`
4. Teste o login com Google -- agora deve voltar ao app e ir direto para a tela principal

