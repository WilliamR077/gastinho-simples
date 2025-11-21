import { CardManager } from "@/components/card-manager";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Cards() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Meus Cartões</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie seus cartões de crédito e débito
          </p>
        </div>

        {/* Card Manager */}
        <CardManager />
      </div>
    </div>
  );
}
