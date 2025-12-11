import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ValuesVisibilityContextType {
  isHidden: boolean;
  toggleVisibility: () => void;
}

const ValuesVisibilityContext = createContext<ValuesVisibilityContextType | undefined>(undefined);

const STORAGE_KEY = "values-visibility-hidden";

export function ValuesVisibilityProvider({ children }: { children: ReactNode }) {
  const [isHidden, setIsHidden] = useState<boolean>(() => {
    // Começa oculto por padrão, mas verifica localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Se não houver preferência salva, começa oculto (true)
      return stored === null ? true : stored === "true";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isHidden));
  }, [isHidden]);

  const toggleVisibility = () => {
    setIsHidden((prev) => !prev);
  };

  return (
    <ValuesVisibilityContext.Provider value={{ isHidden, toggleVisibility }}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}

export function useValuesVisibility() {
  const context = useContext(ValuesVisibilityContext);
  if (context === undefined) {
    throw new Error("useValuesVisibility must be used within a ValuesVisibilityProvider");
  }
  return context;
}
