

## Plano: Footer profissional com links rapidos e identidade visual

### O que sera feito

Redesenhar o componente `Footer` para ter um layout profissional com:

- Logo do Gastinho Simples (usando a imagem ja existente em `/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png`)
- Links rapidos para as paginas principais (Inicio, Relatorios, Cartoes, Configuracoes, Minha Conta, Assinatura)
- Link para a Politica de Privacidade
- A mensagem "Toda Honra e Gloria a Jesus Cristo" mantida na parte inferior
- Ano atual com copyright

### Layout do footer

```text
+--------------------------------------------------+
|  [Logo] Gastinho Simples                         |
|  Controle seus gastos de forma simples           |
|                                                  |
|  Links Rapidos          Conta                    |
|  - Inicio               - Minha Conta            |
|  - Relatorios            - Assinatura             |
|  - Cartoes               - Configuracoes          |
|                                                  |
|  Politica de Privacidade                         |
|                                                  |
|  ──────────────────────────────────────────       |
|  Toda Honra e Gloria a Jesus Cristo              |
|  (c) 2025 Gastinho Simples                       |
+--------------------------------------------------+
```

### Mudancas tecnicas

| Arquivo | Mudanca |
|---------|---------|
| `src/components/footer.tsx` | Redesenhar com logo, links rapidos organizados em colunas, separador e mensagem final |

O componente usara `useNavigate` do React Router para os links internos. Sera responsivo: em telas pequenas as colunas ficam empilhadas, em telas maiores ficam lado a lado. O estilo seguira o tema do app usando cores `muted-foreground`, `border`, e `primary`.

Nenhuma outra pagina precisa ser alterada pois todas ja importam e renderizam o `<Footer />`.

