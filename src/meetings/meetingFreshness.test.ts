import { describe, expect, it } from 'vitest';
import type { MeetingItem } from '../services/meetingService';
import { noticeForForm } from './meetingFreshness';

const OPENED: MeetingItem = {
  id: 1,
  scheduledAt: '2026-11-20T14:30:00-03:00',
  endsAt: '2026-11-20T15:30:00-03:00',
  description: 'Pauta do capítulo 2',
  situation: 'pending',
  author: { id: 9, fullName: 'Carlos Lima', type: 'teacher' },
  counterpart: { id: 9, fullName: 'Carlos Lima' },
  rejectionReason: '',
  cancellationReason: '',
  cancelledBySystem: false,
  canAnswer: true,
  canEdit: false,
  canCancel: false,
  canMarkHeld: false,
  notes: '',
  canEditNotes: false,
};

describe('noticeForForm', () => {
  it('não avisa nada enquanto a reunião é a mesma', () => {
    expect(noticeForForm('reject', OPENED, { ...OPENED })).toBeNull();
  });

  it('escreve a hora quebrada como "14h30" e a cheia como "16h"', () => {
    expect(
      noticeForForm('reject', OPENED, {
        ...OPENED,
        scheduledAt: '2026-11-26T14:30:00-03:00',
        endsAt: '2026-11-26T16:00:00-03:00',
      }),
    ).toEqual({
      message:
        'Esta reunião mudou. Agora é em quinta-feira, 26 de novembro, das 14h30 às 16h, e está pendente.',
      blocksAction: false,
    });
  });

  it('nos apontamentos, não avisa o que mudou se ainda podem ser alterados', () => {
    const held = { ...OPENED, situation: 'held' as const, canEditNotes: true };
    expect(
      noticeForForm('notes', held, { ...held, description: 'Outra pauta' }),
    ).toBeNull();
  });

  it('se a ação não cabe numa situação que a ficha não prevê, diz como a reunião está e bloqueia', () => {
    expect(
      noticeForForm('reject', OPENED, {
        ...OPENED,
        situation: 'accepted',
        canAnswer: false,
      }),
    ).toEqual({
      message:
        'Esta reunião mudou. Agora é em sexta-feira, 20 de novembro, das 14h30 às 15h30, e está aceita.',
      blocksAction: true,
    });
  });
});
