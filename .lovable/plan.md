

## Plano: Login e Cadastro com Google

### O que vamos fazer
Adicionar um botao "Entrar com Google" nas telas de Login e Cadastro, permitindo que o usuario faca login ou crie conta com um unico toque, sem precisar digitar email e senha.

### O que EU vou fazer (codigo)

**Arquivo: `src/pages/Auth.tsx`**
- Adicionar uma funcao `handleGoogleSignIn` que chama `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`
- Adicionar um botao "Entrar com Google" com icone do Google, visivel tanto na aba de Login quanto na aba de Cadastro
- O botao ficara separado por um divisor "ou" entre ele e o formulario de email/senha
- Layout: botao do Google no topo, divisor "ou", formulario tradicional abaixo

### O que VOCE precisa fazer (configuracao no Google e Supabase)

Sao 3 passos que voce precisa fazer no Google Cloud Console e no Supabase Dashboard:

**Passo 1 - Google Cloud Console (criar credenciais OAuth)**
1. Acesse https://console.cloud.google.com
2. Selecione o projeto do Gastinho Simples (o mesmo vinculado ao Google Play)
3. Va em "APIs e Servicos" > "Tela de consentimento OAuth"
   - Configure a tela com nome do app, email de suporte etc.
   - Em "Dominios autorizados", adicione: `jaoldaqvbdllowepzwbr.supabase.co`
4. Va em "APIs e Servicos" > "Credenciais"
   - Clique "Criar credenciais" > "ID do cliente OAuth"
   - Tipo: "Aplicativo da Web"
   - Em "Origens JavaScript autorizadas", adicione:
     - `https://gastinho-simples.lovable.app`
     - `http://localhost:5173` (para testes locais)
   - Em "URIs de redirecionamento autorizados", adicione:
     - `https://jaoldaqvbdllowepzwbr.supabase.co/auth/v1/callback`
   - Copie o **Client ID** e o **Client Secret** gerados

**Passo 2 - Supabase Dashboard (ativar provider Google)**
1. Acesse https://supabase.com/dashboard/project/jaoldaqvbdllowepzwbr/auth/providers
2. Encontre "Google" na lista e ative
3. Cole o **Client ID** e **Client Secret** do passo anterior
4. Salve

**Passo 3 - Supabase Dashboard (verificar URLs)**
1. Acesse https://supabase.com/dashboard/project/jaoldaqvbdllowepzwbr/auth/url-configuration (Authentication > URL Configuration)
2. Confirme que o **Site URL** esta como: `https://gastinho-simples.lovable.app`
3. Em **Redirect URLs**, adicione (se nao existir):
   - `https://gastinho-simples.lovable.app/**`
   - `com.gastinhosimples.app://` (para o app Android fazer deep link apos login)

---

### Detalhes tecnicos

**Mudancas no codigo (`src/pages/Auth.tsx`):**

```text
// Nova funcao:
const handleGoogleSignIn = async () => {
  setIsLoading(true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) {
    toast({ title: "Erro", description: "Falha ao conectar com Google", variant: "destructive" });
  }
  setIsLoading(false);
};

// Novo botao (em ambas as abas, Login e Cadastro):
<Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
  <svg ...Google icon... />
  Entrar com Google
</Button>

// Divisor visual:
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">ou</span>
  </div>
</div>
```

**Nenhuma mudanca no banco de dados** -- o Supabase cuida de tudo automaticamente. Se o usuario logar com Google e ja tiver uma conta com o mesmo email, o Supabase vincula as contas.

### Resultado esperado

1. Na tela de Login: botao "Entrar com Google" no topo, divisor "ou", e abaixo o formulario de email/senha
2. Na tela de Cadastro: mesmo botao "Entrar com Google" no topo, divisor "ou", e abaixo o formulario de cadastro
3. Ao clicar no botao, abre a tela de selecao de conta Google
4. Apos selecionar, o usuario e logado/cadastrado automaticamente e redirecionado para a pagina principal
