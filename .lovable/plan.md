

## Plano: Redesenhar `/auth` priorizando Google Sign-In

### Objetivo
Priorizar Google Sign-In como CTA principal; formulário de email/senha fica oculto atrás de um link-toggle discreto. Nenhum handler, lógica Supabase ou redirect muda.

### Mudanças em `src/pages/Auth.tsx`

**Novo layout do `CardContent`:**

```text
[Logo + Título + Descrição]  ← mantido

[ 🟢 Entrar com Google ]     ← botão grande destacado (h-12)

  Prefiro usar meu email →   ← link-toggle discreto

─ (ao clicar, expande suavemente) ─

  ── ou ──
  [Login] [Cadastro]         ← Tabs internas
  Email / Senha / Botão
  Esqueceu sua senha?        ← apenas na aba Login

  ✕ Fechar                   ← mesmo link-toggle (texto alterna)
```

### Implementação

1. **Novo estado:** `const [showEmailForm, setShowEmailForm] = useState(false);`

2. **Botão Google único no topo** (remover duplicação que hoje existe dentro de cada `TabsContent`):
   - `className="w-full h-12 text-base font-medium"` para presença
   - Mantém `onClick={handleGoogleSignIn}`, `disabled={isGoogleLoading}`, SVG e textos atuais

3. **Link-toggle discreto** (sempre visível, texto alterna conforme estado):
   ```tsx
   <button
     type="button"
     onClick={() => setShowEmailForm(prev => !prev)}
     className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
   >
     {showEmailForm ? "✕ Fechar" : "Prefiro usar meu email →"}
   </button>
   ```

4. **Container colapsável** usando Radix `Collapsible` (`src/components/ui/collapsible.tsx` já existe) controlado por `showEmailForm`:
   - `<Collapsible open={showEmailForm}>` envolvendo separador "ou" + `<Tabs>` + forms
   - Animação suave via `data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up` (keyframes já existem no `tailwind.config.ts`)

5. **`<Tabs>` interno** (dentro do Collapsible):
   - Remover o botão Google duplicado de cada `TabsContent` (Google já está fixo no topo)
   - Remover o separador "ou" interno de cada aba (separador único fica antes das Tabs)
   - `TabsContent value="signin"`: email + senha + "Entrar" + Dialog "Esqueceu sua senha?" (intactos)
   - `TabsContent value="signup"`: email + senha + confirmar senha + password strength + "Criar conta" (intactos)

6. **Ordem final dentro do `CardContent`:**
   1. Botão Google (topo, sempre visível)
   2. Link-toggle (sempre visível, texto alterna)
   3. `<Collapsible>`: separador "ou" → `<Tabs>` com Login/Cadastro

### O que NÃO muda
- `handleSignIn`, `handleSignUp`, `handleGoogleSignIn`, `handleForgotPassword`, `handlePasswordChange`
- `useEffect` de sessão, `onAuthStateChange`, navegação
- Validações (`isEmailValid`, `validatePasswordStrength`, `sanitizeErrorMessage`)
- Dialog de recuperação de senha (estrutura e handler)
- Toggles de visibilidade de senha (Eye/EyeOff)
- Estilo do Card externo, logo, títulos, cores, tipografia

### Arquivo afetado
| Arquivo | Mudança |
|---|---|
| `src/pages/Auth.tsx` | Reestruturação do JSX do `CardContent`: Google fixo no topo, link-toggle com texto alternante, Collapsible envolvendo Tabs internas. Handlers e estados de auth inalterados. |

### Critérios de aceite
1. Estado inicial: logo + Google + link "Prefiro usar meu email →". ✅
2. Clique no link expande formulário com animação suave e texto vira "✕ Fechar". ✅
3. Clique em "✕ Fechar" recolhe formulário com mesma animação e texto volta. ✅
4. Google permanece fixo no topo, independente do estado do formulário. ✅
5. Tabs Login/Cadastro aparecem apenas dentro do Collapsible. ✅
6. "Esqueceu sua senha?" permanece apenas na aba Login. ✅
7. Nenhum handler de auth ou redirect alterado. ✅
8. Identidade visual (cores, tipografia, card escuro, logo) preservada. ✅

