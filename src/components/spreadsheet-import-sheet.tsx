import { useState, useCallback, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { supabase } from "@/integrations/supabase/client";
import { 
  parseSpreadsheet, 
  mapRowsToExpenses, 
  importExpenses, 
  generateTemplateSpreadsheet,
  ParseResult, 
  ColumnMapping, 
  ImportedRow 
} from "@/services/spreadsheet-import-service";
import { categoryLabels, ExpenseCategory } from "@/types/expense";
import { PaymentMethod } from "@/types/expense";
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  X, 
  AlertCircle, 
  Download,
  Loader2,
  Crown,
  Pencil
} from "lucide-react";

interface SpreadsheetImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "upload" | "mapping" | "preview" | "result";

export function SpreadsheetImportSheet({ open, onOpenChange, onSuccess }: SpreadsheetImportSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canImportSpreadsheet, importLimit, tier } = useSubscription();
  
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    description: null,
    amount: null,
    date: null,
    category: null,
    paymentMethod: null,
  });
  const [mappedExpenses, setMappedExpenses] = useState<ImportedRow[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  
  // Reset state when sheet closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep("upload");
      setParseResult(null);
      setMapping({
        description: null,
        amount: null,
        date: null,
        category: null,
        paymentMethod: null,
      });
      setMappedExpenses([]);
      setImportResult(null);
    }
    onOpenChange(newOpen);
  };
  
  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!validTypes.includes(file.type) && !hasValidExtension) {
      toast({
        title: "Formato inválido",
        description: "Use arquivos .xlsx, .xls ou .csv",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const result = await parseSpreadsheet(file);
      
      if (result.rows.length === 0) {
        toast({
          title: "Planilha vazia",
          description: "O arquivo não contém dados para importar",
          variant: "destructive",
        });
        return;
      }
      
      // Check import limit
      if (result.rows.length > importLimit) {
        toast({
          title: "Limite excedido",
          description: `Seu plano permite importar até ${importLimit} itens. A planilha tem ${result.rows.length} linhas.`,
          variant: "destructive",
        });
        return;
      }
      
      setParseResult(result);
      setMapping(result.suggestedMapping);
      setStep("mapping");
      
    } catch (error: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message || "Não foi possível processar a planilha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      // Reset input
      e.target.value = "";
    }
  }, [importLimit, toast]);
  
  // Apply mapping and go to preview
  const handleApplyMapping = useCallback(() => {
    if (!parseResult) return;
    
    if (!mapping.description || !mapping.amount) {
      toast({
        title: "Mapeamento incompleto",
        description: "Descrição e Valor são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    
    const expenses = mapRowsToExpenses(parseResult.rows, mapping);
    setMappedExpenses(expenses);
    setStep("preview");
  }, [parseResult, mapping, toast]);
  
  // Import expenses
  const handleImport = useCallback(async () => {
    if (!user?.id) return;
    
    const validExpenses = mappedExpenses.filter(e => e.isValid);
    if (validExpenses.length === 0) {
      toast({
        title: "Nenhum item válido",
        description: "Corrija os erros antes de importar",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const result = await importExpenses(validExpenses, user.id);
      setImportResult(result);
      
      // Log audit action
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "spreadsheet_imported",
        details: {
          total_rows: mappedExpenses.length,
          valid_rows: validExpenses.length,
          imported: result.success,
          failed: result.failed,
        },
        user_agent: navigator.userAgent,
      });
      
      setStep("result");
      
      if (result.success > 0) {
        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message || "Falha ao salvar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [mappedExpenses, user?.id, toast, onSuccess]);
  
  // Update expense at index
  const updateExpense = useCallback((index: number, field: keyof ImportedRow, value: any) => {
    setMappedExpenses(prev => {
      const updated = [...prev];
      const expense = { ...updated[index] };
      
      // Update field
      (expense as any)[field] = value;
      
      // Re-validate
      const errors: string[] = [];
      if (!expense.description?.trim()) errors.push("Descrição obrigatória");
      if (!expense.amount || expense.amount <= 0) errors.push("Valor inválido");
      expense.errors = errors;
      expense.isValid = errors.length === 0;
      
      updated[index] = expense;
      return updated;
    });
  }, []);
  
  // Stats for preview
  const previewStats = useMemo(() => {
    const valid = mappedExpenses.filter(e => e.isValid).length;
    const invalid = mappedExpenses.length - valid;
    const total = mappedExpenses.reduce((sum, e) => e.isValid ? sum + e.amount : sum, 0);
    return { valid, invalid, total };
  }, [mappedExpenses]);
  
  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Available categories
  const categories: ExpenseCategory[] = [
    "alimentacao", "transporte", "lazer", "saude", 
    "educacao", "moradia", "vestuario", "servicos", "outros"
  ];

  // Available payment methods
  const paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: "pix", label: "PIX" },
    { value: "credit", label: "Crédito" },
    { value: "debit", label: "Débito" },
  ];
  
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha
          </SheetTitle>
          <SheetDescription>
            {step === "upload" && "Carregue uma planilha Excel ou CSV com seus gastos"}
            {step === "mapping" && "Mapeie as colunas da sua planilha"}
            {step === "preview" && "Revise os dados antes de importar"}
            {step === "result" && "Resultado da importação"}
          </SheetDescription>
        </SheetHeader>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-2 py-4">
          <div className={`h-2 w-2 rounded-full ${step === "upload" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-0.5 flex-1 ${step !== "upload" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 w-2 rounded-full ${step === "mapping" ? "bg-primary" : step !== "upload" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-0.5 flex-1 ${step === "preview" || step === "result" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 w-2 rounded-full ${step === "preview" ? "bg-primary" : step === "result" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-0.5 flex-1 ${step === "result" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 w-2 rounded-full ${step === "result" ? "bg-primary" : "bg-muted"}`} />
        </div>
        
        <div className="flex-1 overflow-hidden">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-4">
              {!canImportSpreadsheet ? (
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Crown className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Recurso Premium</h3>
                  <p className="text-muted-foreground max-w-sm">
                    A importação de planilhas está disponível para assinantes Premium e Premium Plus.
                  </p>
                  <Button onClick={() => window.location.href = "/subscription"}>
                    Ver planos
                  </Button>
                </div>
              ) : (
                <>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 w-full max-w-md text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="spreadsheet-input"
                      disabled={loading}
                    />
                    <Button asChild disabled={loading}>
                      <label htmlFor="spreadsheet-input" className="cursor-pointer">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Selecionar Arquivo
                          </>
                        )}
                      </label>
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      Formatos: .xlsx, .xls, .csv (máx. 5MB, {importLimit} itens)
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <Button variant="ghost" size="sm" onClick={generateTemplateSpreadsheet}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar modelo de planilha
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Step 2: Column Mapping */}
          {step === "mapping" && parseResult && (
            <div className="space-y-4 p-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {parseResult.rows.length} linhas encontradas. Mapeie as colunas abaixo.
                </AlertDescription>
              </Alert>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Descrição *</Label>
                  <Select
                    value={mapping.description || ""}
                    onValueChange={(v) => setMapping({ ...mapping, description: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Valor *</Label>
                  <Select
                    value={mapping.amount || ""}
                    onValueChange={(v) => setMapping({ ...mapping, amount: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Data (opcional)</Label>
                  <Select
                    value={mapping.date || ""}
                    onValueChange={(v) => setMapping({ ...mapping, date: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Usar data de hoje" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Usar data de hoje</SelectItem>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Categoria (opcional)</Label>
                  <Select
                    value={mapping.category || ""}
                    onValueChange={(v) => setMapping({ ...mapping, category: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Usar 'Outros'" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Usar "Outros"</SelectItem>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Forma de Pagamento (opcional)</Label>
                  <Select
                    value={mapping.paymentMethod || ""}
                    onValueChange={(v) => setMapping({ ...mapping, paymentMethod: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Usar PIX" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Usar PIX</SelectItem>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={handleApplyMapping} className="flex-1">
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="flex flex-col h-full">
              <div className="flex gap-4 p-4 border-b">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-green-600">{previewStats.valid}</div>
                  <div className="text-xs text-muted-foreground">Válidos</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-red-600">{previewStats.invalid}</div>
                  <div className="text-xs text-muted-foreground">Com erros</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold">{formatCurrency(previewStats.total)}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
              
              <Alert className="mx-4 mb-2">
                <Pencil className="h-4 w-4" />
                <AlertDescription>
                  Clique nas células para editar os dados antes de importar
                </AlertDescription>
              </Alert>
              
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right w-28">Valor</TableHead>
                      <TableHead className="w-28">Data</TableHead>
                      <TableHead className="w-32">Categoria</TableHead>
                      <TableHead className="w-24">Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedExpenses.slice(0, 100).map((expense, index) => (
                      <TableRow key={index} className={expense.isValid ? "" : "bg-red-50 dark:bg-red-950/20"}>
                        <TableCell>
                          {expense.isValid ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={expense.description}
                            onChange={(e) => updateExpense(index, "description", e.target.value)}
                            className={`h-8 text-sm ${!expense.description?.trim() ? "border-red-500" : ""}`}
                            placeholder="Digite a descrição"
                          />
                          {expense.errors.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">{expense.errors.join(", ")}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expense.amount || ""}
                            onChange={(e) => updateExpense(index, "amount", parseFloat(e.target.value) || 0)}
                            className={`h-8 text-sm text-right ${!expense.amount || expense.amount <= 0 ? "border-red-500" : ""}`}
                            placeholder="0,00"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={expense.date}
                            onChange={(e) => updateExpense(index, "date", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={expense.category}
                            onValueChange={(v) => updateExpense(index, "category", v as ExpenseCategory)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {categoryLabels[cat]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={expense.paymentMethod}
                            onValueChange={(v) => updateExpense(index, "paymentMethod", v as PaymentMethod)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethods.map((pm) => (
                                <SelectItem key={pm.value} value={pm.value}>
                                  {pm.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {mappedExpenses.length > 100 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Mostrando 100 de {mappedExpenses.length} itens
                  </p>
                )}
              </ScrollArea>
              
              <div className="flex gap-2 p-4 border-t">
                <Button variant="outline" onClick={() => setStep("mapping")} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={loading || previewStats.valid === 0}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      Importar {previewStats.valid} itens
                      <Check className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 4: Result */}
          {step === "result" && importResult && (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-4">
              {importResult.success > 0 ? (
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <X className="h-8 w-8 text-red-600" />
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">
                  {importResult.success > 0 ? "Importação concluída!" : "Falha na importação"}
                </h3>
                <p className="text-muted-foreground">
                  {importResult.success} {importResult.success === 1 ? "gasto importado" : "gastos importados"} com sucesso
                  {importResult.failed > 0 && `, ${importResult.failed} falharam`}
                </p>
              </div>
              
              {importResult.errors.length > 0 && (
                <Alert variant="destructive" className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {importResult.errors.slice(0, 3).join("; ")}
                    {importResult.errors.length > 3 && ` e mais ${importResult.errors.length - 3} erros`}
                  </AlertDescription>
                </Alert>
              )}
              
              <Button onClick={() => handleOpenChange(false)} className="min-w-32">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
