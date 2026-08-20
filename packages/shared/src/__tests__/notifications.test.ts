import { describe, it, expect } from 'vitest';
import { InAppNotification, InAppNotificationType } from '../types';

describe('In-App Notification Engine (Uber-style)', () => {
  it('should create valid in-app notification objects', () => {
    const notif: InAppNotification = {
      id: 'notif-123',
      title: 'Custódia Ativa no Serviço',
      message: 'Seu pagamento de R$ 150,00 foi retido com segurança.',
      type: 'payment',
      time: 'Agora',
      isRead: false,
      actionTab: 'orders',
      createdAt: new Date().toISOString(),
    };

    expect(notif.id).toBe('notif-123');
    expect(notif.type).toBe('payment');
    expect(notif.isRead).toBe(false);
    expect(notif.actionTab).toBe('orders');
  });

  it('should support all standard in-app notification types', () => {
    const validTypes: InAppNotificationType[] = [
      'order',
      'message',
      'payment',
      'system',
      'proposal',
    ];

    expect(validTypes).toHaveLength(5);
    validTypes.forEach((type) => {
      const item: InAppNotification = {
        id: `test-${type}`,
        title: `Aviso ${type}`,
        message: 'Teste de mensagem',
        type,
        time: 'Agora',
        isRead: false,
      };
      expect(item.type).toBe(type);
    });
  });
});
