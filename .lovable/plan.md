

## Plano: Paginação no histórico de notificações

### Mudança

| Arquivo | Ação |
|---|---|
| `src/pages/Admin.tsx` | Adicionar paginação com "página anterior/próxima" abaixo da lista de logs filtrados |

### Detalhes

1. **Novos states**: `logPage` (default 1), `LOGS_PER_PAGE = 15`
2. **Lógica**: Calcular `paginatedLogs = filteredLogs.slice((logPage-1)*perPage, logPage*perPage)` e `totalPages`
3. **Resetar página**: Quando `searchLog`, `statusFilter` ou `typeFilter` mudam, resetar `logPage` para 1
4. **UI**: Abaixo da lista, barra com "Página X de Y", botões Anterior/Próxima usando os componentes `Button` existentes
5. **Renderizar**: Trocar `filteredLogs.map` por `paginatedLogs.map`
6. **Contador**: Mostrar "X de Y registros" acima da lista

