import { describe, expect, it } from 'vitest';
import type { ActivityDetail } from '../services/activityService';
import {
  ACTIVITY_GONE_MESSAGE,
  latestSubmissionId,
  NEW_SUBMISSION_MESSAGE,
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
      'Esta atividade foi enviada para revisão. Enquanto ela é revisada, não é possível entregar arquivos.',
    ],
    [
      'deliver',
      OPENED,
      COMPLETED,
      'Esta atividade foi concluída e não pode mais receber entregas.',
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
    ['accept', IN_REVIEW, COMPLETED, 'Esta atividade já foi aceita.'],
    [
      'refuse',
      IN_REVIEW,
      COMPLETED,
      'Esta atividade já foi aceita e não pode mais ser recusada.',
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

  it('não diz "já foi enviada para revisão" a uma atividade pendente sem entregas', () => {
    expect(
      noticeForActivityDialog('sendForReview', OPENED, {
        ...OPENED,
        submissions: [],
      }),
    ).toBeNull();
  });

  it.each(['accept', 'refuse'] as ActivityDialogAction[])(
    'bloqueia %s quando chegou uma entrega desde a abertura, antes do aviso de descrição',
    (action) => {
      const second = {
        id: 2,
        submittedAt: '2026-11-05T09:00:00Z',
        files: [],
      };
      expect(
        noticeForActivityDialog(action, IN_REVIEW, {
          ...IN_REVIEW,
          description: 'Outra descrição',
          deadline: '2026-12-20',
          title: 'Outro título',
          submissions: [...IN_REVIEW.submissions, second],
        }),
      ).toEqual({
        message: NEW_SUBMISSION_MESSAGE,
        blocksAction: true,
      });
    },
  );

  it('a mesma entrega não bloqueia a decisão', () => {
    expect(
      noticeForActivityDialog('accept', IN_REVIEW, { ...IN_REVIEW }),
    ).toBeNull();
  });

  it('a entrega mais recente é a última da lista', () => {
    expect(
      latestSubmissionId({
        ...IN_REVIEW,
        submissions: [
          ...IN_REVIEW.submissions,
          { id: 8, submittedAt: '2026-11-05T09:00:00Z', files: [] },
        ],
      }),
    ).toBe(8);
    expect(latestSubmissionId({ ...IN_REVIEW, submissions: [] })).toBeNull();
  });

  it('não fala de entrega nova nos diálogos do aluno', () => {
    expect(
      noticeForActivityDialog('sendForReview', OPENED, {
        ...OPENED,
        submissions: [
          ...OPENED.submissions,
          { id: 2, submittedAt: '2026-11-05T09:00:00Z', files: [] },
        ],
      }),
    ).toBeNull();
  });
});
