import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_GONE_MESSAGE } from '../activities/activityFreshness';
import { REFRESH_INTERVAL_MS } from '../hooks/useRefreshedLoad';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { ActivitiesServer, FakeActivity } from '../test/activitiesApi';
import {
  commentsServer,
  makeComment,
  STUDENT_AUTHOR,
  TEACHER_AUTHOR,
} from '../test/commentsApi';
import type { CommentsServer, FakeComment } from '../test/commentsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/atividades';
const DETAIL = 'GET /api/atividades/5';
const TIMELINE = 'GET /api/atividades/5/linha-do-tempo';

const DELIVERED: FakeActivity['submissions'] = [
  {
    id: 1,
    submitted_at: '2026-11-03T09:00:00Z',
    files: [
      {
        id: 11,
        file_name: 'capitulo.pdf',
        size_bytes: 2048,
        content_type: 'application/pdf',
      },
    ],
  },
];

interface Setup {
  server: ActivitiesServer;
  comments: CommentsServer;
  fetchMock: ReturnType<typeof mockApi>;
  events: ReturnType<typeof userEvent.setup>;
}

function setup(
  path: string,
  user: 'student' | 'teacher',
  activities: FakeActivity[],
  initialComments: FakeComment[] = [],
): Setup {
  const comments = commentsServer(
    initialComments,
    user === 'student' ? STUDENT_AUTHOR : TEACHER_AUTHOR,
  );
  const server = activitiesServer(activities, {
    user,
    comments: comments.comments,
  });
  const fetchMock = mockApi({ ...server.routes, ...comments.routes });
  // Clique e digitação sem esperar o relógio falso: ele só anda quando o teste manda.
  const events = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    applyAccept: false,
  });
  renderApp(path);
  return { server, comments, fetchMock, events };
}

/** O que a outra parte fez no servidor, entre duas leituras da tela. */
function changeOnServer(
  server: ActivitiesServer,
  id: number,
  change: Partial<FakeActivity>,
) {
  const found = server.activities().find((item) => item.id === id);
  if (!found) throw new Error(`atividade ${id} ausente`);
  Object.assign(found, change);
}

/** A outra parte excluiu a atividade, ou a orientação foi encerrada: o servidor responde 404. */
function removeOnServer(server: ActivitiesServer, id: number) {
  const list = server.activities();
  list.splice(
    list.findIndex((item) => item.id === id),
    1,
  );
}

/** Um ciclo de releitura: 30 s com a aba visível. */
async function nextCycle() {
  // O ciclo é registrado num efeito: o `act` o descarrega antes de o relógio andar.
  await act(async () => {});
  await act(async () => {
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
  });
}

const totalOf = (label: string) => screen.getByRole('group', { name: label });

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Atividades: a lista relida a cada 30 s', () => {
  it('mostra ao aluno a atividade criada e a mudança de situação, com os totais, sem esqueleto e com a busca na URL', async () => {
    const { server, fetchMock } = setup(
      '/aluno/atividades?busca=Cap',
      'student',
      [makeActivity(5, { title: 'Capítulo 1' })],
    );
    await screen.findByRole('link', { name: /Capítulo 1/ });
    const reads = requestsTo(fetchMock, LIST).length;

    // O professor cria uma atividade e muda o prazo da outra; a situação muda em outra aba.
    server.activities().push(makeActivity(6, { title: 'Capítulo 2' }));
    changeOnServer(server, 5, { status: 'completed' });
    await nextCycle();

    expect(
      await screen.findByRole('link', { name: /Capítulo 2/ }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Capítulo 1.*Concluída/ }),
    ).toBeVisible();
    expect(within(totalOf('Total de atividades')).getByText('2')).toBeVisible();
    expect(within(totalOf('Concluídas')).getByText('1')).toBeVisible();
    expect(requestsTo(fetchMock, LIST).length).toBe(reads + 1);
    expect(screen.queryByTestId('activities-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('totals-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/atividades?busca=Cap',
    );
  });

  it('mostra ao professor a atividade enviada para revisão e tira a excluída, na mesma página e filtro', async () => {
    const { server } = setup(
      '/professor/atividades?situacao=pending',
      'teacher',
      [
        makeActivity(5, { title: 'Capítulo 1' }),
        makeActivity(6, { title: 'Capítulo 2' }),
      ],
    );
    await screen.findByRole('link', { name: /Capítulo 2/ });

    // O aluno envia a 1 para revisão; a 2 é excluída em outra aba.
    changeOnServer(server, 5, { status: 'in_review' });
    removeOnServer(server, 6);
    await nextCycle();

    expect(
      await screen.findByText('Nenhuma atividade encontrada com esses filtros'),
    ).toBeVisible();
    expect(within(totalOf('Total de atividades')).getByText('1')).toBeVisible();
    expect(within(totalOf('Pendentes')).getByText('0')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/atividades?situacao=pending',
    );
  });
});

describe('Detalhe da atividade: a releitura a cada 30 s', () => {
  it('mostra ao aluno a atividade aceita, sem as ações de entrega e sem esqueleto', async () => {
    const { server, fetchMock } = setup('/aluno/atividades/5', 'student', [
      makeActivity(5, { status: 'in_review', submissions: DELIVERED }),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });
    const reads = requestsTo(fetchMock, DETAIL).length;

    changeOnServer(server, 5, {
      status: 'completed',
      reviews: [
        {
          id: 1,
          decision: 'accepted',
          decided_at: '2026-11-04T10:00:00Z',
        },
      ],
    });
    await nextCycle();

    expect(
      await screen.findByText(
        'O orientador aceitou esta atividade. Não há mais nada a fazer nela.',
      ),
    ).toBeVisible();
    expect(requestsTo(fetchMock, DETAIL).length).toBe(reads + 1);
    expect(screen.queryByTestId('activity-skeleton')).not.toBeInTheDocument();
    // A linha do tempo recebe a revisão no topo.
    const region = screen.getByRole('region', { name: 'Linha do tempo' });
    expect(
      await within(region).findByText('Revisão da 1ª entrega'),
    ).toBeVisible();
  });

  it('mostra ao professor o painel de revisão quando o aluno envia para revisão', async () => {
    const { server } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5, { status: 'in_progress', submissions: DELIVERED }),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });
    expect(
      screen.queryByRole('button', { name: 'Aceitar atividade' }),
    ).not.toBeInTheDocument();

    changeOnServer(server, 5, { status: 'in_review' });
    await nextCycle();

    expect(
      await screen.findByRole('button', { name: 'Aceitar atividade' }),
    ).toBeVisible();
  });

  it('mostra o comentário da outra parte e guarda o rascunho de comentário', async () => {
    const { comments, events } = setup('/aluno/atividades/5', 'student', [
      makeActivity(5),
    ]);
    const field = await screen.findByLabelText(/Novo comentário/);
    await events.type(field, 'Meu rascunho');

    comments.receive(
      makeComment(1, {
        text: 'Revise a introdução',
        created_at: '2026-11-05T10:00:00Z',
        author: TEACHER_AUTHOR,
      }),
    );
    await nextCycle();

    expect(await screen.findByText('Revise a introdução')).toBeVisible();
    expect(screen.getByLabelText(/Novo comentário/)).toHaveValue(
      'Meu rascunho',
    );
    expect(screen.getByLabelText(/Novo comentário/)).toHaveFocus();
  });

  it('põe o evento novo no topo sem perder os eventos carregados por "Carregar mais eventos"', async () => {
    // 1 evento de criação e 24 comentários: 25 eventos, em três trechos de 10.
    const many = Array.from({ length: 24 }, (_, position) =>
      makeComment(position + 1, {
        text: `Comentário ${position + 1}`,
        created_at: `2026-11-03T10:${String(position).padStart(2, '0')}:00Z`,
        author: position % 2 === 0 ? STUDENT_AUTHOR : TEACHER_AUTHOR,
      }),
    );
    const { comments, events, fetchMock } = setup(
      '/aluno/atividades/5',
      'student',
      [makeActivity(5)],
      many,
    );
    const region = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });
    await events.click(
      await within(region).findByRole('button', {
        name: 'Carregar mais eventos',
      }),
    );
    expect(
      await within(region).findByText('Mostrando 20 de 25 eventos'),
    ).toBeVisible();
    const button = within(region).getByRole('button', {
      name: 'Carregar mais eventos',
    });
    button.focus();
    const timelineReads = requestsTo(fetchMock, TIMELINE).length;

    comments.receive(
      makeComment(25, {
        text: 'Comentário novo',
        created_at: '2026-11-05T10:00:00Z',
        author: TEACHER_AUTHOR,
      }),
    );
    await nextCycle();

    expect(
      await within(region).findByText('Mostrando 21 de 26 eventos'),
    ).toBeVisible();
    const texts = within(region)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(texts[0]).toContain('Comentário novo');
    // Os mais antigos já carregados continuam, até o comentário 5 (índice 6).
    expect(texts.at(-1)).toContain('Comentário 5');
    expect(requestsTo(fetchMock, TIMELINE).length).toBe(timelineReads + 1);
    // O foco fica onde estava.
    expect(button).toHaveFocus();
  });

  it('preenche o intervalo quando surgiram mais eventos que cabem num trecho', async () => {
    const many = Array.from({ length: 14 }, (_, position) =>
      makeComment(position + 1, {
        created_at: `2026-11-03T10:${String(position).padStart(2, '0')}:00Z`,
      }),
    );
    const { comments, events } = setup(
      '/aluno/atividades/5',
      'student',
      [makeActivity(5)],
      many,
    );
    const region = await screen.findByRole('region', {
      name: 'Linha do tempo',
    });
    await events.click(
      await within(region).findByRole('button', {
        name: 'Carregar mais eventos',
      }),
    );
    await within(region).findByText('Mostrando 15 de 15 eventos');

    for (let id = 15; id <= 27; id++) {
      comments.receive(
        makeComment(id, {
          created_at: `2026-11-05T10:${String(id).padStart(2, '0')}:00Z`,
        }),
      );
    }
    await nextCycle();

    expect(
      await within(region).findByText('Mostrando 28 de 28 eventos'),
    ).toBeVisible();
    expect(within(region).getByText('Início da atividade')).toBeVisible();
  });

  it('mostra "Atividade não encontrada" quando a atividade é excluída ou a orientação é encerrada', async () => {
    const { server } = setup('/aluno/atividades/5', 'student', [
      makeActivity(5),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    removeOnServer(server, 5);
    await nextCycle();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Atividade não encontrada',
      }),
    ).toBeVisible();
  });
});

describe('Detalhe da atividade: os diálogos abertos na releitura', () => {
  it('a entrega fica aberta, com os arquivos escolhidos e o botão desabilitado, quando a atividade some', async () => {
    const { server, events } = setup('/aluno/atividades/5', 'student', [
      makeActivity(5),
    ]);
    await events.click(
      await screen.findByRole('button', { name: 'Entregar arquivos' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Entregar arquivos',
    });
    await events.upload(
      within(dialog).getByLabelText(/Escolher arquivos/),
      new File(['x'], 'capitulo.pdf', { type: 'application/pdf' }),
    );
    const submit = within(dialog).getByRole('button', {
      name: 'Entregar arquivos',
    });
    expect(submit).toBeEnabled();
    expect(
      within(dialog).getByText(/Você tem alterações não salvas/),
    ).toBeVisible();

    removeOnServer(server, 5);
    await nextCycle();

    expect(
      await within(dialog).findByText(ACTIVITY_GONE_MESSAGE),
    ).toBeVisible();
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent('Entregar arquivos');
    expect(within(dialog).getByText('capitulo.pdf')).toBeVisible();
    // O aviso de alterações não salvas mandaria clicar num botão desabilitado.
    expect(
      within(dialog).queryByText(/Você tem alterações não salvas/),
    ).not.toBeInTheDocument();
    // Atrás do diálogo, a tela mostra o estado que já tinha para isso.
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Atividade não encontrada',
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it('a recusa fica aberta, com a justificativa e o botão desabilitado, quando a atividade é aceita', async () => {
    const { server, events } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5, { status: 'in_review', submissions: DELIVERED }),
    ]);
    await events.click(
      await screen.findByRole('button', { name: 'Recusar atividade' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Recusar a atividade',
    });
    await events.type(
      within(dialog).getByLabelText(/Justificativa/),
      'Falta a conclusão',
    );

    changeOnServer(server, 5, { status: 'completed' });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta atividade já foi aceita e está concluída.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Recusar atividade' }),
    ).toBeDisabled();
    expect(within(dialog).getByLabelText(/Justificativa/)).toHaveValue(
      'Falta a conclusão',
    );
  });

  it('aceitar fica desabilitado quando a atividade já foi recusada', async () => {
    const { server, events } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5, { status: 'in_review', submissions: DELIVERED }),
    ]);
    await events.click(
      await screen.findByRole('button', { name: 'Aceitar atividade' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Aceitar a atividade?',
    });

    changeOnServer(server, 5, { status: 'pending' });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta atividade já foi recusada e devolvida ao aluno.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Aceitar atividade' }),
    ).toBeDisabled();
  });

  it('a edição avisa que a atividade foi enviada para revisão e continua com o que foi digitado', async () => {
    const { server, events } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5, { status: 'in_progress', submissions: DELIVERED }),
    ]);
    await events.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar atividade',
    });
    const title = within(dialog).getByLabelText(/Título/);
    await events.clear(title);
    await events.type(title, 'Capítulo revisto');

    changeOnServer(server, 5, { status: 'in_review' });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'A situação desta atividade mudou para Em revisão.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeEnabled();
    expect(title).toHaveValue('Capítulo revisto');
    expect(title).toHaveFocus();
  });

  it('a edição fica desabilitada quando a atividade é concluída', async () => {
    const { server, events } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5, { status: 'in_review', submissions: DELIVERED }),
    ]);
    await events.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar atividade',
    });
    await events.type(within(dialog).getByLabelText(/Título/), ' final');

    changeOnServer(server, 5, { status: 'completed' });
    await nextCycle();

    expect(
      await within(dialog).findByText(
        'Esta atividade foi concluída e não pode mais ser editada.',
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();
    expect(within(dialog).getByLabelText(/Título/)).toHaveValue(
      'Atividade 5 final',
    );
  });

  it('excluir fica desabilitado quando a orientação é encerrada', async () => {
    const { server, events } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5),
    ]);
    await events.click(await screen.findByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Excluir a atividade?',
    });

    removeOnServer(server, 5);
    await nextCycle();

    expect(
      await within(dialog).findByText(ACTIVITY_GONE_MESSAGE),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Excluir atividade' }),
    ).toBeDisabled();
  });

  it('enviar para revisão avisa o novo prazo e continua habilitado', async () => {
    const { server, events } = setup('/aluno/atividades/5', 'student', [
      makeActivity(5, { submissions: DELIVERED }),
    ]);
    await events.click(
      await screen.findByRole('button', { name: 'Enviar para revisão' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Enviar para revisão?',
    });

    changeOnServer(server, 5, { deadline: '2099-12-30' });
    await nextCycle();

    expect(
      await within(dialog).findByText(/^O prazo desta atividade mudou para /),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Enviar para revisão' }),
    ).toBeEnabled();
  });

  it('o aviso só é anunciado quando muda, e não a cada releitura', async () => {
    const { server, events } = setup('/professor/atividades/5', 'teacher', [
      makeActivity(5),
    ]);
    await events.click(await screen.findByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Excluir a atividade?',
    });
    const region = within(dialog).getByRole('status');
    expect(region).toBeEmptyDOMElement();

    changeOnServer(server, 5, { status: 'in_progress' });
    await nextCycle();
    await waitFor(() =>
      expect(region).toHaveTextContent(
        'A situação desta atividade mudou para Em andamento.',
      ),
    );
    const alert = region.firstElementChild;
    await nextCycle();

    // A mesma região e o mesmo nó: nada novo para o leitor de tela anunciar.
    expect(within(dialog).getByRole('status')).toBe(region);
    expect(region.firstElementChild).toBe(alert);
  });
});
