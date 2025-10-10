import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Smartphone, Trash2, Receipt } from "lucide-react"
import { Expense, categoryLabels, categoryIcons } from "@/types/expense"
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
}

const paymentMethodConfig = {
  pix: { label: "PIX", icon: Smartphone, color: "bg-success text-success-foreground" },
  debit: { label: "Débito", icon: CreditCard, color: "bg-info text-info-foreground" },
  credit: { label: "Crédito", icon: CreditCard, color: "bg-warning text-warning-foreground" }
}

export function ExpenseList({ expenses, onDeleteExpense }: ExpenseListProps) {
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
            
            return (
              <div
                key={expense.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card"
              >
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                  <div className={`p-2 rounded-full ${config.color} shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryIcons[expense.category]}</span>
                      <p className="font-medium text-foreground truncate">{expense.description}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{categoryLabels[expense.category]}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        Data: {expense.expense_date.substring(0, 10).split('-').reverse().join('/')}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        Criado: {new Date(expense.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {expense.total_installments > 1 && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="font-medium text-primary">
                            {expense.installment_number}/{expense.total_installments}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`${config.color} text-xs`}>
                      {config.label}
                    </Badge>
                    <p className="font-bold text-base sm:text-lg text-primary whitespace-nowrap">
                      R$ {expense.amount.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteExpense(expense.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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