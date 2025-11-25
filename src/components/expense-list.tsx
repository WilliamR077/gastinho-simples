import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Smartphone, Trash2, Receipt, MoreVertical, Pencil } from "lucide-react"
import { Expense, categoryLabels, categoryIcons } from "@/types/expense"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface ExpenseListProps {
  expenses: Expense[]
  onDeleteExpense: (id: string) => void
  onEditExpense: (expense: Expense) => void
}

const paymentMethodConfig = {
  pix: { label: "PIX", icon: Smartphone, color: "bg-success text-success-foreground" },
  debit: { label: "Débito", icon: CreditCard, color: "bg-info text-info-foreground" },
  credit: { label: "Crédito", icon: CreditCard, color: "bg-warning text-warning-foreground" }
}

// Helper para parsear data sem problemas de timezone
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function ExpenseList({ expenses, onDeleteExpense, onEditExpense }: ExpenseListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const totalPages = Math.ceil(expenses.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentExpenses = expenses.slice(startIndex, endIndex)

  // Reset to page 1 when expenses change
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1)
  }

  if (expenses.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma despesa registrada ainda.
            <br />
            Comece adicionando sua primeira despesa!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-primary">Suas Despesas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {currentExpenses.map((expense) => {
            const config = paymentMethodConfig[expense.payment_method]
            const Icon = config.icon
            const cardColor = expense.card?.color || (expense.payment_method === 'credit' ? '#FFA500' : expense.payment_method === 'debit' ? '#3B82F6' : undefined)
            
            return (
              <div
                key={expense.id}
                className="flex flex-col p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card"
              >
                {/* Linha 1 - Cabeçalho com ícone, categoria e nome */}
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-full shrink-0" 
                    style={{ backgroundColor: cardColor || '#6B7280' }}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg shrink-0">{categoryIcons[expense.category]}</span>
                    <p className="font-medium text-foreground truncate">{expense.description}</p>
                    {expense.total_installments > 1 && (
                      <span className="text-sm font-medium text-primary whitespace-nowrap">
                        {expense.installment_number}/{expense.total_installments}x
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Linha 2 - Categoria e Data da Despesa */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 ml-11">
                  <span>{categoryLabels[expense.category]}</span>
                  <span>•</span>
                  <span>{parseLocalDate(expense.expense_date).toLocaleDateString('pt-BR')}</span>
                </div>
                
                {/* Linha 3 - Criado em */}
                <div className="text-xs text-muted-foreground mt-1 ml-11">
                  Criado em: {new Date(expense.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).replace(',', ' às')}
                </div>
                
                {/* Linha 4 - Badge da forma de pagamento */}
                <div className="mt-2 ml-11">
                  <Badge 
                    className="text-xs text-white"
                    style={{ backgroundColor: cardColor || '#6B7280' }}
                  >
                    {config.label}
                    {expense.card && ` - ${expense.card.name}`}
                  </Badge>
                </div>
                
                {/* Linha 5 - Preço (esquerda) e Menu (direita) */}
                <div className="flex items-center justify-between mt-3">
                  <p className="font-bold text-lg text-primary">
                    R$ {expense.amount.toFixed(2).replace('.', ',')}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background">
                      <DropdownMenuItem onClick={() => onEditExpense(expense)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteExpense(expense.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Apagar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  const showPage = 
                    page === 1 || 
                    page === totalPages || 
                    Math.abs(page - currentPage) <= 1

                  if (!showPage) {
                    // Show ellipsis
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )
                    }
                    return null
                  }

                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  )
}