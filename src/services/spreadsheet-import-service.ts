import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { ExpenseCategory, PaymentMethod } from "@/types/expense";

export interface ImportedRow {
  description: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  isValid: boolean;
  errors: string[];
  originalRow: Record<string, any>;
}

export interface ColumnMapping {
  description: string | null;
  amount: string | null;
  date: string | null;
  category: string | null;
  paymentMethod: string | null;
}

export interface ParseResult {
  columns: string[];
  rows: Record<string, any>[];
  suggestedMapping: ColumnMapping;
}

// Possíveis nomes para cada campo
const COLUMN_PATTERNS = {
  description: ["descricao", "descrição", "description", "nome", "item", "titulo", "título", "gasto", "despesa", "obs", "observacao", "observação"],
  amount: ["valor", "amount", "preco", "preço", "price", "total", "quantia", "custo", "cost"],
  date: ["data", "date", "dia", "expense_date", "dt", "quando"],
  category: ["categoria", "category", "tipo", "type", "classificacao", "classificação"],
  paymentMethod: ["pagamento", "payment", "forma", "metodo", "método", "forma_pagamento", "forma pagamento", "cartao", "cartão"]
};

// Mapeamento de categorias
const CATEGORY_MAPPINGS: Record<string, ExpenseCategory> = {
  // alimentacao
  "alimentacao": "alimentacao",
  "alimentação": "alimentacao",
  "comida": "alimentacao",
  "restaurante": "alimentacao",
  "mercado": "alimentacao",
  "supermercado": "alimentacao",
  "lanche": "alimentacao",
  "ifood": "alimentacao",
  "delivery": "alimentacao",
  "padaria": "alimentacao",
  // transporte
  "transporte": "transporte",
  "uber": "transporte",
  "99": "transporte",
  "gasolina": "transporte",
  "combustivel": "transporte",
  "combustível": "transporte",
  "onibus": "transporte",
  "ônibus": "transporte",
  "metro": "transporte",
  "metrô": "transporte",
  "taxi": "transporte",
  "táxi": "transporte",
  "estacionamento": "transporte",
  // lazer
  "lazer": "lazer",
  "entretenimento": "lazer",
  "netflix": "lazer",
  "spotify": "lazer",
  "cinema": "lazer",
  "viagem": "lazer",
  "diversao": "lazer",
  "diversão": "lazer",
  "streaming": "lazer",
  "jogo": "lazer",
  "jogos": "lazer",
  // saude
  "saude": "saude",
  "saúde": "saude",
  "farmacia": "saude",
  "farmácia": "saude",
  "medico": "saude",
  "médico": "saude",
  "hospital": "saude",
  "academia": "saude",
  "remedio": "saude",
  "remédio": "saude",
  // educacao
  "educacao": "educacao",
  "educação": "educacao",
  "escola": "educacao",
  "faculdade": "educacao",
  "curso": "educacao",
  "livro": "educacao",
  "livros": "educacao",
  "material": "educacao",
  // moradia
  "moradia": "moradia",
  "aluguel": "moradia",
  "casa": "moradia",
  "condominio": "moradia",
  "condomínio": "moradia",
  "luz": "moradia",
  "agua": "moradia",
  "água": "moradia",
  "internet": "moradia",
  "gas": "moradia",
  "gás": "moradia",
  // vestuario
  "vestuario": "vestuario",
  "vestuário": "vestuario",
  "roupa": "vestuario",
  "roupas": "vestuario",
  "calcado": "vestuario",
  "calçado": "vestuario",
  "sapato": "vestuario",
  "tenis": "vestuario",
  "tênis": "vestuario",
  // servicos
  "servicos": "servicos",
  "serviços": "servicos",
  "servico": "servicos",
  "serviço": "servicos",
  "assinatura": "servicos",
  "mensalidade": "servicos",
  // outros
  "outros": "outros",
  "outro": "outros",
  "other": "outros",
  "misc": "outros",
  "diversos": "outros",
};

// Mapeamento de formas de pagamento
const PAYMENT_MAPPINGS: Record<string, PaymentMethod> = {
  "credito": "credit",
  "crédito": "credit",
  "credit": "credit",
  "cartao credito": "credit",
  "cartão crédito": "credit",
  "cartao de credito": "credit",
  "cartão de crédito": "credit",
  "cc": "credit",
  "debito": "debit",
  "débito": "debit",
  "debit": "debit",
  "cartao debito": "debit",
  "cartão débito": "debit",
  "cartao de debito": "debit",
  "cartão de débito": "debit",
  "cd": "debit",
  "pix": "pix",
  "transferencia": "pix",
  "transferência": "pix",
  "ted": "pix",
  "doc": "pix",
  "dinheiro": "pix",
  "boleto": "pix",
};

// Detectar coluna automaticamente
function detectColumn(columns: string[], patterns: string[]): string | null {
  for (const col of columns) {
    const normalizedCol = col.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const pattern of patterns) {
      const normalizedPattern = pattern.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedCol.includes(normalizedPattern) || normalizedPattern.includes(normalizedCol)) {
        return col;
      }
    }
  }
  return null;
}

// Parse de arquivo Excel/CSV
export async function parseSpreadsheet(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });
        
        // Pegar primeira planilha
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
          raw: false,
          defval: ""
        });
        
        if (jsonData.length === 0) {
          throw new Error("Planilha vazia ou formato inválido");
        }
        
        // Pegar nomes das colunas
        const columns = Object.keys(jsonData[0]);
        
        // Sugerir mapeamento automático
        const suggestedMapping: ColumnMapping = {
          description: detectColumn(columns, COLUMN_PATTERNS.description),
          amount: detectColumn(columns, COLUMN_PATTERNS.amount),
          date: detectColumn(columns, COLUMN_PATTERNS.date),
          category: detectColumn(columns, COLUMN_PATTERNS.category),
          paymentMethod: detectColumn(columns, COLUMN_PATTERNS.paymentMethod),
        };
        
        resolve({
          columns,
          rows: jsonData,
          suggestedMapping,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsBinaryString(file);
  });
}

// Converter valor monetário para número
export function parseMoneyValue(value: any): number | null {
  if (typeof value === "number") return value;
  if (!value) return null;
  
  let str = String(value).trim();
  
  // Remover símbolo de moeda
  str = str.replace(/R\$\s*/gi, "").replace(/\$/g, "").trim();
  
  // Detectar formato brasileiro (1.234,56) ou americano (1,234.56)
  const hasBrazilianFormat = str.includes(",") && (str.lastIndexOf(",") > str.lastIndexOf(".") || !str.includes("."));
  
  if (hasBrazilianFormat) {
    // Formato brasileiro: trocar . por nada e , por .
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // Formato americano: remover vírgulas
    str = str.replace(/,/g, "");
  }
  
  // Remover caracteres não numéricos (exceto . e -)
  str = str.replace(/[^\d.\-]/g, "");
  
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.abs(num);
}

// Converter data para formato ISO
export function parseDateValue(value: any): string | null {
  if (!value) return null;
  
  // Se já é Date
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  
  const str = String(value).trim();
  
  // Tentar formato dd/mm/yyyy ou dd-mm-yyyy
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  
  // Tentar formato yyyy-mm-dd
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  
  // Tentar parse genérico
  const genericDate = new Date(str);
  if (!isNaN(genericDate.getTime())) {
    return genericDate.toISOString().split("T")[0];
  }
  
  return null;
}

// Mapear categoria
export function mapCategory(value: any): ExpenseCategory {
  if (!value) return "outros";
  
  const normalized = String(value).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const [key, category] of Object.entries(CATEGORY_MAPPINGS)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return category;
    }
  }
  
  return "outros";
}

// Mapear forma de pagamento
export function mapPaymentMethod(value: any): PaymentMethod {
  if (!value) return "pix";
  
  const normalized = String(value).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const [key, method] of Object.entries(PAYMENT_MAPPINGS)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return method;
    }
  }
  
  return "pix";
}

// Converter linhas para formato de despesas
export function mapRowsToExpenses(rows: Record<string, any>[], mapping: ColumnMapping): ImportedRow[] {
  const today = new Date().toISOString().split("T")[0];
  
  return rows.map((row) => {
    const errors: string[] = [];
    
    // Descrição
    const description = mapping.description ? String(row[mapping.description] || "").trim() : "";
    if (!description) {
      errors.push("Descrição é obrigatória");
    }
    
    // Valor
    let amount = 0;
    if (mapping.amount) {
      const parsedAmount = parseMoneyValue(row[mapping.amount]);
      if (parsedAmount === null || parsedAmount <= 0) {
        errors.push("Valor inválido");
      } else {
        amount = parsedAmount;
      }
    } else {
      errors.push("Valor é obrigatório");
    }
    
    // Data
    let date = today;
    if (mapping.date) {
      const parsedDate = parseDateValue(row[mapping.date]);
      if (parsedDate) {
        date = parsedDate;
      }
    }
    
    // Categoria
    const category = mapping.category ? mapCategory(row[mapping.category]) : "outros";
    
    // Forma de pagamento
    const paymentMethod = mapping.paymentMethod ? mapPaymentMethod(row[mapping.paymentMethod]) : "pix";
    
    return {
      description,
      amount,
      date,
      category,
      paymentMethod,
      isValid: errors.length === 0,
      errors,
      originalRow: row,
    };
  });
}

// Importar despesas para o banco
export async function importExpenses(
  expenses: ImportedRow[],
  userId: string,
  sharedGroupId?: string | null
): Promise<{ success: number; failed: number; errors: string[] }> {
  const validExpenses = expenses.filter((e) => e.isValid);
  const errors: string[] = [];
  let success = 0;
  let failed = 0;
  
  // Inserir em lotes de 50
  const batchSize = 50;
  for (let i = 0; i < validExpenses.length; i += batchSize) {
    const batch = validExpenses.slice(i, i + batchSize);
    
    const insertData = batch.map((e) => ({
      user_id: userId,
      description: e.description,
      amount: e.amount,
      expense_date: e.date,
      category: e.category,
      payment_method: e.paymentMethod,
      shared_group_id: sharedGroupId || null,
    }));
    
    const { error } = await supabase.from("expenses").insert(insertData);
    
    if (error) {
      errors.push(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      failed += batch.length;
    } else {
      success += batch.length;
    }
  }
  
  return { success, failed, errors };
}

// Gerar template de exemplo
export function generateTemplateSpreadsheet(): void {
  const templateData = [
    {
      "Descrição": "Mercado Pão de Açúcar",
      "Valor": "R$ 250,00",
      "Data": "15/01/2025",
      "Categoria": "Alimentação",
      "Pagamento": "Crédito"
    },
    {
      "Descrição": "Uber - trabalho",
      "Valor": "R$ 35,50",
      "Data": "16/01/2025",
      "Categoria": "Transporte",
      "Pagamento": "PIX"
    },
    {
      "Descrição": "Netflix mensalidade",
      "Valor": "R$ 55,90",
      "Data": "17/01/2025",
      "Categoria": "Lazer",
      "Pagamento": "Crédito"
    },
    {
      "Descrição": "Farmácia Drogasil",
      "Valor": "R$ 89,00",
      "Data": "18/01/2025",
      "Categoria": "Saúde",
      "Pagamento": "Débito"
    },
  ];
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateData);
  
  // Ajustar largura das colunas
  ws["!cols"] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "modelo-importacao-gastinho.xlsx");
}
