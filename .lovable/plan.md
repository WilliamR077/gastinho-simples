

## Plano: Corrigir erro de build do PWA e otimizar cache

### Problema atual

O build esta falhando porque um arquivo JS tem 2.43 MB, acima do limite padrao de 2 MB do Workbox. Precisamos aumentar esse limite e tambem melhorar a estrategia de cache para uma experiencia mais rapida no iPhone.

### Mudancas no `vite.config.ts`

**1. Corrigir o erro de build** adicionando `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024` (3 MB) na configuracao do workbox.

**2. Otimizar cache com runtime caching** para que o app carregue mais rapido em acessos futuros:

- **Imagens**: Cache com estrategia `CacheFirst` (busca no cache primeiro, so vai na rede se nao tiver). Expira em 30 dias, maximo 50 imagens.
- **Google Fonts**: `CacheFirst` com expiracao de 1 ano (fontes raramente mudam).
- **API do Supabase**: `NetworkFirst` (tenta a rede primeiro para dados frescos, mas se estiver offline usa o cache). Expiracao de 1 dia.

### Resultado para o usuario iPhone

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Build | Falhando (erro de tamanho) | Funcionando |
| Abertura do app | Carrega tudo da rede | JS/CSS cacheados, abre quase instantaneo |
| Imagens | Baixa toda vez | Cacheadas por 30 dias |
| Dados (gastos, etc) | Sem cache | Cache de fallback quando offline |
| Offline | Tela em branco | App abre com dados do ultimo acesso |

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `vite.config.ts` | Adicionar `maximumFileSizeToCacheInBytes` e `runtimeCaching` |

