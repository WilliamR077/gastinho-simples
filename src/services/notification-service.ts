import { LocalNotifications } from '@capacitor/local-notifications';
import { RecurringExpense } from '@/types/recurring-expense';

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
   */
  static async checkAndUpdatePermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.checkPermissions();
      if (result.display !== 'granted') {
        return await this.requestPermissions();
      }
      return true;
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  }

  /**
   * Calcula a próxima data de vencimento baseada no dia do mês
   */
  private static getNextDueDate(dayOfMonth: number, offsetDays: number = 0): Date {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Tenta criar a data para o mês atual
    let dueDate = new Date(currentYear, currentMonth, dayOfMonth);
    
    // Se a data já passou, usa o próximo mês
    if (dueDate <= today) {
      dueDate = new Date(currentYear, currentMonth + 1, dayOfMonth);
    }
    
    // Ajusta para meses com menos dias (ex: fevereiro com dia 31)
    if (dueDate.getDate() !== dayOfMonth) {
      // Define para o último dia do mês
      dueDate = new Date(currentYear, currentMonth + 2, 0);
    }
    
    // Aplica o offset (para notificações de 3 dias antes, 1 dia antes, etc)
    const finalDate = new Date(dueDate);
    finalDate.setDate(finalDate.getDate() + offsetDays);
    
    return finalDate;
  }

  /**
   * Agenda notificações para uma despesa fixa específica
   */
  static async scheduleNotificationsForExpense(expense: RecurringExpense): Promise<void> {
    try {
      const hasPermission = await this.checkAndUpdatePermissions();
      if (!hasPermission) {
        console.warn('Permissões de notificação não concedidas');
        return;
      }

      const notifications = [];
      
      // Notificação 3 dias antes (9h da manhã)
      const threeDaysBefore = this.getNextDueDate(expense.day_of_month, -3);
      threeDaysBefore.setHours(9, 0, 0, 0);
      
      if (threeDaysBefore > new Date()) {
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
      
      if (oneDayBefore > new Date()) {
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
      
      if (today > new Date()) {
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
   */
  static async rescheduleAllNotifications(expenses: RecurringExpense[]): Promise<void> {
    try {
      // Cancela todas as notificações pendentes
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }

      // Agenda notificações para todas as despesas ativas
      const activeExpenses = expenses.filter(e => e.is_active);
      
      for (const expense of activeExpenses) {
        await this.scheduleNotificationsForExpense(expense);
      }

      console.log(`Total de ${activeExpenses.length} despesas com notificações reagendadas`);
    } catch (error) {
      console.error('Erro ao reagendar notificações:', error);
    }
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
