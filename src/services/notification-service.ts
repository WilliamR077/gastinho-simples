import { LocalNotifications } from '@capacitor/local-notifications';
import { RecurringExpense } from '@/types/recurring-expense';
import { Toast } from '@capacitor/toast';

export class NotificationService {
  /**
   * Solicita permissões do usuário para enviar notificações
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissões de notificação:', error);
      return false;
    }
  }

  /**
   * Verifica e atualiza o status das permissões
   * Se permissões negadas, mostra mensagem explicativa
   */
  static async checkAndUpdatePermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.checkPermissions();
      
      if (result.display !== 'granted') {
        const requestResult = await this.requestPermissions();
        
        if (!requestResult) {
          // Mostra toast nativo explicando que permissões são necessárias
          await Toast.show({
            text: 'Ative as notificações nas configurações do dispositivo para receber lembretes de despesas',
            duration: 'long',
            position: 'bottom',
          });
          return false;
        }
        
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  }

  /**
   * Calcula a próxima data de vencimento baseada no dia do mês
   * Trata meses com menos de 31 dias (ajusta para o último dia do mês)
   */
  private static getNextDueDate(dayOfMonth: number, offsetDays: number = 0): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera as horas para comparação correta
    
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Tenta criar a data para o mês atual
    let dueDate = new Date(currentYear, currentMonth, dayOfMonth);
    
    // Se a data já passou, usa o próximo mês
    if (dueDate <= today) {
      dueDate = new Date(currentYear, currentMonth + 1, dayOfMonth);
    }
    
    // Ajusta para meses com menos dias (ex: dia 31 em fevereiro)
    // Se o dia não corresponde ao solicitado, é porque o mês não tem esse dia
    if (dueDate.getDate() !== dayOfMonth) {
      // Define para o último dia do mês anterior ao que foi criado
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth();
      dueDate = new Date(year, month, 0); // Dia 0 = último dia do mês anterior
    }
    
    // Aplica o offset (para notificações de 3 dias antes, 1 dia antes, etc)
    const finalDate = new Date(dueDate);
    finalDate.setDate(finalDate.getDate() + offsetDays);
    
    return finalDate;
  }

  /**
   * Agenda notificações para uma despesa fixa específica
   * Ignora notificações de datas que já passaram
   */
  static async scheduleNotificationsForExpense(expense: RecurringExpense): Promise<void> {
    if (!expense.is_active) {
      return;
    }

    try {
      const hasPermission = await this.checkAndUpdatePermissions();
      if (!hasPermission) {
        return;
      }

      const now = new Date();
      const notifications = [];
      
      // Notificação 3 dias antes (9h da manhã)
      const threeDaysBefore = this.getNextDueDate(expense.day_of_month, -3);
      threeDaysBefore.setHours(9, 0, 0, 0);
      
      // Só agenda se a data é futura
      if (threeDaysBefore > now) {
        notifications.push({
          id: this.getNotificationId(expense.id, '3days'),
          title: '🔔 Lembrete de Despesa',
          body: `${expense.description} vence em 3 dias (R$ ${Number(expense.amount).toFixed(2)})`,
          schedule: { at: threeDaysBefore },
          sound: 'default',
          attachments: undefined,
          actionTypeId: '',
          extra: {
            expenseId: expense.id,
            type: '3days'
          }
        });
      }

      // Notificação 1 dia antes (18h - fim da tarde)
      const oneDayBefore = this.getNextDueDate(expense.day_of_month, -1);
      oneDayBefore.setHours(18, 0, 0, 0);
      
      // Só agenda se a data é futura
      if (oneDayBefore > now) {
        notifications.push({
          id: this.getNotificationId(expense.id, '1day'),
          title: '⚠️ Atenção: Vencimento Próximo',
          body: `${expense.description} vence amanhã (R$ ${Number(expense.amount).toFixed(2)})`,
          schedule: { at: oneDayBefore },
          sound: 'default',
          attachments: undefined,
          actionTypeId: '',
          extra: {
            expenseId: expense.id,
            type: '1day'
          }
        });
      }

      // Notificação no dia (8h da manhã)
      const today = this.getNextDueDate(expense.day_of_month, 0);
      today.setHours(8, 0, 0, 0);
      
      // Só agenda se a data é futura
      if (today > now) {
        notifications.push({
          id: this.getNotificationId(expense.id, 'today'),
          title: '❗ Cobrança Hoje',
          body: `${expense.description} será cobrado hoje (R$ ${Number(expense.amount).toFixed(2)})`,
          schedule: { at: today },
          sound: 'default',
          attachments: undefined,
          actionTypeId: '',
          extra: {
            expenseId: expense.id,
            type: 'today'
          }
        });
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`${notifications.length} notificações agendadas para: ${expense.description}`);
      }
    } catch (error) {
      console.error('Erro ao agendar notificações:', error);
    }
  }

  /**
   * Cancela todas as notificações de uma despesa específica
   */
  static async cancelNotificationsForExpense(expenseId: string): Promise<void> {
    try {
      const notificationIds = [
        this.getNotificationId(expenseId, '3days'),
        this.getNotificationId(expenseId, '1day'),
        this.getNotificationId(expenseId, 'today')
      ];

      await LocalNotifications.cancel({ notifications: notificationIds.map(id => ({ id })) });
      console.log(`Notificações canceladas para despesa: ${expenseId}`);
    } catch (error) {
      console.error('Erro ao cancelar notificações:', error);
    }
  }

  /**
   * Reagenda todas as notificações baseadas na lista atual de despesas
   * Agrupa múltiplas despesas no mesmo dia em uma única notificação
   */
  static async rescheduleAllNotifications(expenses: RecurringExpense[]): Promise<void> {
    try {
      const hasPermission = await this.checkAndUpdatePermissions();
      if (!hasPermission) {
        return;
      }

      // Cancela todas as notificações pendentes
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }

      // Filtra despesas ativas
      const activeExpenses = expenses.filter(e => e.is_active);
      
      // Agrupa despesas por dia do mês
      const expensesByDay = this.groupExpensesByDay(activeExpenses);
      
      const now = new Date();
      const notifications = [];
      
      for (const [dayStr, expensesOnDay] of Object.entries(expensesByDay)) {
        const dayOfMonth = parseInt(dayStr);
        
        if (expensesOnDay.length === 1) {
          // Uma única despesa neste dia - agenda individualmente
          await this.scheduleNotificationsForExpense(expensesOnDay[0]);
        } else {
          // Múltiplas despesas no mesmo dia - agrupa em uma notificação
          const totalAmount = expensesOnDay.reduce((sum, exp) => sum + Number(exp.amount), 0);
          const count = expensesOnDay.length;
          const expensesList = expensesOnDay.map(e => e.description).join(', ');
          
          // Notificação 3 dias antes
          const threeDaysBefore = this.getNextDueDate(dayOfMonth, -3);
          threeDaysBefore.setHours(9, 0, 0, 0);
          
          if (threeDaysBefore > now) {
            notifications.push({
              id: this.getNotificationId(`grouped_${dayOfMonth}`, '3days'),
              title: `🔔 ${count} despesas vencem em 3 dias`,
              body: `Total: R$ ${totalAmount.toFixed(2)} (${expensesList})`,
              schedule: { at: threeDaysBefore },
              sound: 'default',
              attachments: undefined,
              actionTypeId: '',
              extra: {
                type: 'grouped_3days',
                dayOfMonth,
                count
              }
            });
          }
          
          // Notificação 1 dia antes
          const oneDayBefore = this.getNextDueDate(dayOfMonth, -1);
          oneDayBefore.setHours(18, 0, 0, 0);
          
          if (oneDayBefore > now) {
            notifications.push({
              id: this.getNotificationId(`grouped_${dayOfMonth}`, '1day'),
              title: `⚠️ ${count} despesas vencem amanhã`,
              body: `Total: R$ ${totalAmount.toFixed(2)} (${expensesList})`,
              schedule: { at: oneDayBefore },
              sound: 'default',
              attachments: undefined,
              actionTypeId: '',
              extra: {
                type: 'grouped_1day',
                dayOfMonth,
                count
              }
            });
          }
          
          // Notificação no dia
          const today = this.getNextDueDate(dayOfMonth, 0);
          today.setHours(8, 0, 0, 0);
          
          if (today > now) {
            notifications.push({
              id: this.getNotificationId(`grouped_${dayOfMonth}`, 'today'),
              title: `❗ ${count} despesas vencem hoje`,
              body: `Total: R$ ${totalAmount.toFixed(2)} (${expensesList})`,
              schedule: { at: today },
              sound: 'default',
              attachments: undefined,
              actionTypeId: '',
              extra: {
                type: 'grouped_today',
                dayOfMonth,
                count
              }
            });
          }
        }
      }
      
      // Agenda todas as notificações agrupadas
      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }

      console.log(`Total de ${activeExpenses.length} despesas com notificações reagendadas`);
    } catch (error) {
      console.error('Erro ao reagendar notificações:', error);
    }
  }

  /**
   * Agrupa despesas pelo dia do mês
   */
  private static groupExpensesByDay(expenses: RecurringExpense[]): Record<string, RecurringExpense[]> {
    const grouped: Record<string, RecurringExpense[]> = {};
    
    for (const expense of expenses) {
      const day = expense.day_of_month.toString();
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(expense);
    }
    
    return grouped;
  }

  /**
   * Gera um ID único para cada notificação
   */
  private static getNotificationId(expenseId: string, type: '3days' | '1day' | 'today'): number {
    // Cria um hash simples do UUID + type para gerar um número inteiro único
    const str = `${expenseId}-${type}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Lista todas as notificações pendentes (útil para debug)
   */
  static async listPendingNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      console.log('Notificações pendentes:', pending.notifications.length);
      pending.notifications.forEach(n => {
        console.log(`ID: ${n.id}, Título: ${n.title}, Agendada para: ${n.schedule}`);
      });
    } catch (error) {
      console.error('Erro ao listar notificações:', error);
    }
  }
}
