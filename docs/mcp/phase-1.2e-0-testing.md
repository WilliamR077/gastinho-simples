# MCP 1.2E-0 — versionamento de categorias de receita

`user_income_categories.updated_at` possuía `DEFAULT now()`, mas não tinha
trigger de atualização. O frontend atualiza a tabela sem enviar esse campo,
portanto o timestamp não era uma versão confiável para concorrência otimista.

A migration desta etapa adiciona somente:

```sql
CREATE TRIGGER update_user_income_categories_updated_at
BEFORE UPDATE ON public.user_income_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

A função reutilizada já define `NEW.updated_at = now()` e retorna `NEW`. Não há
backfill: as linhas existentes permanecem intactas até que sofram um `UPDATE`.

Validação estática:

```text
npm run test:mcp:1.2e-0
```

Docker não estava disponível durante a implementação. A validação runtime do
avanço do timestamp deverá ser executada em banco local ou após a aplicação
controlada da migration, antes da futura Fase MCP 1.2E-A.
