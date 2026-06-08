import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DecimalInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Input para valores decimais que aceita vírgula ou ponto e
 * preserva estados intermediários da digitação (ex.: "44," ou "44.").
 *
 * Mantém um texto local não-controlado pelo valor numérico do form;
 * só propaga via onChange quando o texto é parseável para um número
 * válido, evitando que o campo "suma" ao apertar separador decimal.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onChange, className, placeholder = "0,00", ...props }, ref) => {
    const [text, setText] = React.useState<string>(() =>
      value === 0 || value == null || Number.isNaN(value)
        ? ""
        : String(value).replace(".", ",")
    );

    // Sincroniza com o valor externo quando ele muda por outro caminho
    // (ex.: form.reset). Evita sobrescrever o texto quando o usuário
    // está no meio da digitação e o número equivalente já bate.
    React.useEffect(() => {
      const currentParsed = parseFloat(text.replace(",", "."));
      if (!Number.isNaN(currentParsed) && currentParsed === value) return;
      if (text === "" && (value === 0 || value == null)) return;
      setText(
        value === 0 || value == null || Number.isNaN(value)
          ? ""
          : String(value).replace(".", ",")
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        className={cn(className)}
        value={text}
        onChange={(e) => {
          // Aceita apenas dígitos, vírgula e ponto.
          let raw = e.target.value.replace(/[^\d.,]/g, "");
          // Permite apenas um separador decimal. Mantém o último digitado.
          const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
          if (lastSep !== -1) {
            const before = raw.slice(0, lastSep).replace(/[.,]/g, "");
            const after = raw.slice(lastSep + 1).replace(/[.,]/g, "");
            raw = before + raw[lastSep] + after;
          }
          setText(raw);

          if (raw === "" || raw === "," || raw === ".") {
            onChange(0);
            return;
          }
          const num = parseFloat(raw.replace(",", "."));
          if (!Number.isNaN(num)) {
            onChange(num);
          }
        }}
        onBlur={(e) => {
          // Normaliza visual no blur: "44," -> "44"
          if (text.endsWith(",") || text.endsWith(".")) {
            setText(text.slice(0, -1));
          }
          props.onBlur?.(e);
        }}
      />
    );
  }
);
DecimalInput.displayName = "DecimalInput";
