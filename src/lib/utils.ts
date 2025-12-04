import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza uma data para meio-dia no horário local, evitando problemas de timezone
 * onde meia-noite UTC pode virar o dia anterior em fusos negativos (ex: Brasil UTC-3).
 */
export function normalizeToLocalDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

/**
 * Converte uma string de data do banco para Date local corretamente.
 * Funciona com formato YYYY-MM-DD e timestamps completos.
 */
export function parseLocalDate(dateString: string): Date {
  // Se está em formato YYYY-MM-DD, criar data como local (não UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  // Se tem timestamp completo (ISO), extrair apenas a data
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }
  // Fallback: tentar parse normal e normalizar
  const date = new Date(dateString);
  return normalizeToLocalDate(date);
}

/**
 * Formata uma Date para string YYYY-MM-DD preservando o dia local.
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
