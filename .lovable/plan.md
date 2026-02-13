

## Plano: Fazer Login com Google Funcionar no App Android

### O Problema
No app nativo (Android), ao clicar em "Entrar com Google", o navegador abre, o usuario faz login, mas depois o navegador vai para `gastinho-simples.lovable.app` em vez de voltar para o aplicativo. Falta configurar o **deep linking** para que o Android saiba redirecionar de volta ao app.

### O que precisa ser feito

**Sao 3 mudancas:**

---

### 1. Adicionar Deep Link no AndroidManifest.xml
Adicionar um `intent-filter` na Activity principal para que o Android reconheca URLs com o esquema `com.gastinhosimples.app://` e abra o app automaticamente.

```text
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.gastinhosimples.app" />
</intent-filter>
```

### 2. Alterar o `redirectTo` no Auth.tsx para usar o esquema do app no Android
No codigo do `handleGoogleSignIn`, detectar se esta rodando no app nativo e usar `com.gastinhosimples.app://` como redirect, em vez de `window.location.origin` (que aponta para o site).

```text
import { Capacitor } from "@capacitor/core";

const redirectTo = Capacitor.isNativePlatform()
  ? 'com.gastinhosimples.app://'
  : window.location.origin;
```

### 3. Tratar o deep link no App.tsx
Quando o app recebe o deep link de volta (com o token na URL), precisamos extrair a sessao do Supabase. Usaremos o plugin `@capacitor/app` para escutar eventos `appUrlOpen` e chamar `supabase.auth.setSession()` ou `supabase.auth.exchangeCodeForSession()`.

---

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `android/app/src/main/AndroidManifest.xml` | Adicionar intent-filter para deep link `com.gastinhosimples.app://` |
| `src/pages/Auth.tsx` | Usar esquema nativo no `redirectTo` quando no Capacitor |
| `src/App.tsx` | Adicionar listener para `appUrlOpen` que extrai sessao do Supabase |

### O que VOCE precisa fazer (Supabase Dashboard)

Confirme que `com.gastinhosimples.app://` esta adicionado nas **Redirect URLs** em:
https://supabase.com/dashboard/project/jaoldaqvbdllowepzwbr/auth/url-configuration

Se ja adicionou no passo anterior do Google OAuth, esta tudo certo.

### Apos as mudancas
1. Faca `git pull` no projeto
2. Rode `npx cap sync`
3. Rode `npx cap run android` para testar

