
## Plano: Botao de Compartilhar codigo de convite via Share nativo

### O que sera feito

Adicionar um botao "Compartilhar" ao lado do botao de copiar no `GroupManagementSheet`. Esse botao usara a API `navigator.share()` (Web Share API / Capacitor Share) para abrir o menu nativo de compartilhamento do celular com uma mensagem pre-formatada.

### Como funciona

1. Ao clicar no botao "Compartilhar", o app monta uma mensagem como:
   `Entre no meu grupo "Viagem SP" no Gastinho Simples! Codigo: ABC123`
2. Chama `Share.share()` do `@capacitor/share` (ja instalado no projeto) que abre o share nativo do celular (WhatsApp, Telegram, SMS, etc.)
3. Como fallback para navegadores web, usa `navigator.share()` se disponivel, senao copia para a area de transferencia

### Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/components/group-management-sheet.tsx` | Adicionar import do `Share` do `@capacitor/share`. Criar funcao `handleShareCode` que monta a mensagem e chama `Share.share({ text, dialogTitle })`. Adicionar botao com icone `Share2` ao lado do botao de copiar. Fallback para `navigator.share()` ou copiar. |

### Visual

A area do codigo de convite ficara assim:

```text
+------------------------------------------+
|  Codigo de Convite                       |
|  [   A B C 1 2 3   ]  [Copiar] [Share]  |
|  Compartilhe este codigo para convidar.  |
+------------------------------------------+
```

Dois botoes lado a lado: o de copiar (ja existe) e o novo de compartilhar.

### Mensagem de compartilhamento

```text
Entre no meu grupo "Viagem SP" no Gastinho Simples! Use o codigo: ABC123
```

### Detalhes tecnicos

- O pacote `@capacitor/share` ja esta instalado (`^7.0.2`)
- No ambiente nativo (Android/iOS), `Share.share()` abre o menu nativo automaticamente
- No ambiente web, usa `navigator.share()` como fallback, e se nao disponivel, copia o texto e mostra toast
- Nenhuma mudanca no banco de dados necessaria
