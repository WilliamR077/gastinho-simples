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
            
            return (
              <div
                key={expense.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card"
              >
                {/* Linha superior - Mobile e Desktop */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full ${config.color} shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg shrink-0">{categoryIcons[expense.category]}</span>
                      <p className="font-medium text-foreground truncate">{expense.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{categoryLabels[expense.category]}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">
                        Data: {expense.expense_date.substring(0, 10).split('-').reverse().join('/')}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="whitespace-nowrap">
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
                          <span className="font-medium text-primary whitespace-nowrap">
                            {expense.installment_number}/{expense.total_installments}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Linha inferior - Mobile | Mesma linha no Desktop */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pl-11 sm:pl-0">
                  <Badge variant="outline" className={`${config.color} text-xs whitespace-nowrap`}>
                    {config.label}
                  </Badge>
                  <p className="font-bold text-base sm:text-lg text-primary whitespace-nowrap">
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