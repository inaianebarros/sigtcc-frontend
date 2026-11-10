import { describe, expect, it } from 'vitest';
import type { AppNotification } from '../services/notificationService';
import { destinationOf, detailsOf, groupOf } from './notificationKinds';

function notification(
  type: string,
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: 1,
    type,
    message: 'texto',
    payload: {},
    reference: { type: 'activity', id: 42 },
    isRead: false,
    createdAt: '2026-11-09T15:00:00Z',
    ...overrides,
  };
}

describe('groupOf', () => {
  it.each([
    ['advising_request_received', 'advising'],
    ['advising_request_answered', 'advising'],
    ['advising_request_unanswered', 'advising'],
    ['advising_ended', 'advising'],
    ['activity_created', 'activity'],
    ['activity_changed', 'activity'],
    ['activity_deleted', 'activity'],
    ['activity_commented', 'activity'],
    ['activity_submitted', 'activity'],
    ['activity_awaiting_review', 'activity'],
    ['activity_review_result', 'activity'],
    ['meeting_requested', 'meeting'],
    ['meeting_answered', 'meeting'],
    ['um_tipo_que_nao_existe', 'other'],
  ])('o tipo %s é do grupo %s', (type, group) => {
    expect(groupOf(type)).toBe(group);
  });
});

describe('destinationOf', () => {
  it('a solicitação recebida leva o professor às solicitações', () => {
    expect(
      destinationOf(
        notification('advising_request_received', { reference: null }),
        'teacher',
      ),
    ).toBe('/professor/solicitacoes');
  });

  it.each(['advising_request_answered', 'advising_request_unanswered'])(
    '%s leva o aluno à tela da solicitação',
    (type) => {
      expect(
        destinationOf(
          notification(type, { reference: { type: 'advising', id: 3 } }),
          'student',
        ),
      ).toBe('/aluno/solicitacao');
    },
  );

  it('a orientação encerrada leva o aluno ao histórico de orientações (RF49)', () => {
    expect(
      destinationOf(
        notification('advising_ended', {
          reference: { type: 'advising', id: 3 },
        }),
        'student',
      ),
    ).toBe('/aluno/historico');
  });

  it.each([
    'activity_created',
    'activity_changed',
    'activity_commented',
    'activity_submitted',
    'activity_awaiting_review',
    'activity_review_result',
  ])('%s leva ao detalhe da atividade do perfil de quem lê', (type) => {
    expect(destinationOf(notification(type), 'student')).toBe(
      '/aluno/atividades/42',
    );
    expect(destinationOf(notification(type), 'teacher')).toBe(
      '/professor/atividades/42',
    );
  });

  it('a atividade excluída não tem destino (RF52)', () => {
    expect(
      destinationOf(notification('activity_deleted'), 'student'),
    ).toBeNull();
  });

  it('uma atividade sem referência não tem destino', () => {
    expect(
      destinationOf(
        notification('activity_created', { reference: null }),
        'student',
      ),
    ).toBeNull();
  });

  it.each(['meeting_requested', 'meeting_answered'])(
    '%s leva à tela de reuniões do perfil',
    (type) => {
      const reference = { type: 'meeting', id: 8 };
      expect(destinationOf(notification(type, { reference }), 'student')).toBe(
        '/aluno/reunioes',
      );
      expect(destinationOf(notification(type, { reference }), 'teacher')).toBe(
        '/professor/reunioes',
      );
    },
  );

  it('um tipo desconhecido não tem destino', () => {
    expect(destinationOf(notification('um_tipo_novo'), 'student')).toBeNull();
  });
});

describe('detailsOf', () => {
  it('a atividade alterada lista cada campo com o valor antigo e o novo (RF52)', () => {
    const details = detailsOf(
      notification('activity_changed', {
        payload: {
          activity_title: 'Capítulo 2',
          changes: [
            { field: 'title', old: 'Capítulo', new: 'Capítulo 2' },
            { field: 'deadline', old: '2026-11-20', new: '2026-12-31' },
            { field: 'description', old: 'a', new: 'b' },
          ],
        },
      }),
    );

    expect(details).toEqual([
      {
        kind: 'change',
        field: 'Título',
        oldValue: 'Capítulo',
        newValue: 'Capítulo 2',
      },
      {
        kind: 'change',
        field: 'Prazo',
        oldValue: '20 de novembro de 2026',
        newValue: '31 de dezembro de 2026',
      },
      { kind: 'change', field: 'Descrição', oldValue: 'a', newValue: 'b' },
    ]);
  });

  it('a orientação encerrada traz as quantidades arquivadas e canceladas (RF53)', () => {
    const details = detailsOf(
      notification('advising_ended', {
        payload: {
          teacher_name: 'Carlos Lima',
          archived_activities: 2,
          cancelled_meetings: 1,
        },
      }),
    );

    expect(details).toEqual([
      { kind: 'count', label: 'Atividades arquivadas', value: 2 },
      { kind: 'count', label: 'Reuniões canceladas', value: 1 },
    ]);
  });

  it.each([
    ['activity_created', { activity_title: 'x' }],
    ['meeting_requested', {}],
    ['um_tipo_novo', { qualquer: 'coisa' }],
  ])('%s não tem detalhes além da mensagem', (type, payload) => {
    expect(detailsOf(notification(type, { payload }))).toEqual([]);
  });

  it.each([
    ['sem o campo', {}],
    ['changes que não é lista', { changes: 'x' }],
    ['itens soltos', { changes: [null, 3, 'a', {}] }],
    ['campo desconhecido', { changes: [{ field: 'x', old: 'a', new: 'b' }] }],
  ])('um payload malformado (%s) não quebra', (_label, payload) => {
    expect(() =>
      detailsOf(notification('activity_changed', { payload })),
    ).not.toThrow();
  });

  it('um payload malformado da orientação encerrada não quebra nem inventa números', () => {
    expect(
      detailsOf(
        notification('advising_ended', {
          payload: { archived_activities: 'muitas' },
        }),
      ),
    ).toEqual([]);
  });
});
