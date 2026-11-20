import { describe, expect, it } from 'vitest';
import type { ActivityDetail } from '../services/activityService';
import {
  ACTIVITY_GONE_MESSAGE,
  noticeForActivityDialog,
} from './activityFreshness';
import type { ActivityDialogAction } from './activityFreshness';

const OPENED: ActivityDetail = {
  id: 5,
  title: 'Capítulo 2',
  description: 'Escrever o capítulo 2',
  deadline: '2026-12-10',
  status: 'pending',
  overdue: false,
  student: { id: 7, fullName: 'Ana Souza' },
  teacher: { id: 9, fullName: 'Carlos Lima' },
  createdAt: '2026-11-02T14:30:00Z',
  submissions: [{ id: 1, submittedAt: '2026-11-03T09:00:00Z', files: [] }],
  reviews: [],
  commentsCount: 0,
};

const IN_REVIEW: ActivityDetail = { ...OPENED, status: 'in_review' };
const COMPLETED: ActivityDetail = { ...OPENED, status: 'completed' };

describe('noticeForActivityDialog', () => {
  it('não avisa nada enquanto a atividade é a mesma ou a leitura não terminou', () => {
    expect(noticeForActivityDialog('deliver', OPENED, { ...OPENED })).toBe(
      null,
    );
    expect(noticeForActivityDialog('deliver', OPENED, undefined)).toBeNull();
  });

  it.each([
    'deliver',
    'sendForReview',
    'accept',
    'refuse',
    'edit',
    'delete',
  ] as ActivityDialogAction[])(
    'bloqueia %s quando a atividade sumiu',
    (action) => {
      expect(noticeForActivityDialog(action, OPENED, null)).toEqual({
        message: ACTIVITY_GONE_MESSAGE,
        blocksAction: true,
      });
    },
  );

  it.each([
    [
      'deliver',
      OPENED,
      IN_REVIEW,
      'Esta atividade foi enviada para revisão e não aceita novas entregas enquanto é revisada.',
    ],
    [
      'deliver',
      OPENED,
      COMPLETED,
      'Esta atividade foi concluída e não aceita mais entregas.',
    ],
    [
      'sendForReview',
      OPENED,
      IN_REVIEW,
      'Esta atividade já foi enviada para revisão.',
    ],
    [
      'sendForReview',
      OPENED,
      COMPLETED,
      'Esta atividade foi concluída e não pode mais ser enviada para revisão.',
    ],
    [
      'accept',
      IN_REVIEW,
      COMPLETED,
      'Esta atividade já foi aceita e está concluída.',
    ],
    [
      'refuse',
      IN_REVIEW,
      { ...OPENED, status: 'in_progress' },
      'Esta atividade já foi recusada e devolvida ao aluno.',
    ],
    [
      'edit',
      IN_REVIEW,
      COMPLETED,
      'Esta atividade foi concluída e não pode mais ser editada.',
    ],
    [
      'delete',
      OPENED,
      COMPLETED,
      'Esta atividade foi concluída e não pode mais ser excluída.',
    ],
  ] as [ActivityDialogAction, ActivityDetail, ActivityDetail, string][])(
    'bloqueia %s quando a ação não cabe mais',
    (action, opened, latest, message) => {
      expect(noticeForActivityDialog(action, opened, latest)).toEqual({
        message,
        blocksAction: true,
      });
    },
  );

  it('avisa sem bloquear o que mudou quando a ação ainda cabe', () => {
    expect(noticeForActivityDialog('edit', OPENED, IN_REVIEW)).toEqual({
      message: 'A situação desta atividade mudou para Em revisão.',
      blocksAction: false,
    });
    expect(
      noticeForActivityDialog('deliver', OPENED, {
        ...OPENED,
        title: 'Capítulo 3',
      }),
    ).toEqual({
      message: 'O título desta atividade mudou para "Capítulo 3".',
      blocksAction: false,
    });
    expect(
      noticeForActivityDialog('sendForReview', OPENED, {
        ...OPENED,
        description: 'Outra descrição',
      }),
    ).toEqual({
      message: 'A descrição desta atividade mudou.',
      blocksAction: false,
    });
    expect(
      noticeForActivityDialog('delete', OPENED, {
        ...OPENED,
        deadline: '2026-12-15',
      })?.message,
    ).toMatch(/^O prazo desta atividade mudou para .*15.*\.$/);
  });
});
