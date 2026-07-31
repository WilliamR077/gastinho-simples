import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

function copyWithFallback(text: string) {
  const textArea = document.createElement("textarea");
  const previouslyFocused = document.activeElement;

  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.inset = "0";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  try {
    if (!document.execCommand("copy")) {
      throw new Error("O navegador não permitiu copiar o texto.");
    }
  } finally {
    document.body.removeChild(textArea);
    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    }
  }
}

interface UseCopyTextOptions {
  successTitle?: string;
  successDescription?: string;
}

/**
 * Copia texto para a área de transferência com fallback para navegadores
 * que expõem, mas bloqueiam, a Clipboard API. Retorna o estado visual
 * `copiedKey` para feedback de sucesso temporário.
 */
export function useCopyText(options: UseCopyTextOptions = {}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string, key = text) => {
      try {
        let copiedWithClipboard = false;

        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            copiedWithClipboard = true;
          } catch {
            // Alguns navegadores expõem a API, mas bloqueiam seu uso.
          }
        }

        if (!copiedWithClipboard) {
          copyWithFallback(text);
        }

        setCopiedKey(key);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopiedKey(null), 2500);

        toast({
          title: options.successTitle ?? "Copiado",
          description: options.successDescription ?? "Texto copiado.",
        });
      } catch {
        setCopiedKey(null);
        toast({
          title: "Não foi possível copiar",
          description: "Selecione o texto e copie manualmente.",
          variant: "destructive",
        });
      }
    },
    [options.successTitle, options.successDescription],
  );

  return { copy, copiedKey };
}
