import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { mockApi } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

function setup(
  activities: FakeActivity[],
  user: 'student' | 'teacher',
  path: string,
  entries?: { pathname: string; search?: string; state?: unknown }[],
) {
  const server = activitiesServer(activities, { user });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(path, entries ? { entries } : undefined);
  return { fetchMock, events, server };
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

const FULL = makeActivity(5, {
  title: 'Capítulo 2',
  description: 'Entregar o capítulo 2 do TCC',
  deadline: '2026-12-31',
  status: 'in_review',
  overdue: true,
  student: { id: 101, full_name: 'Maria Lima' },
  created_at: '2026-11-02T14:30:00Z',
  teacher: { id: 9, full_name: 'Carlos Lima' },
  submissions: [
    {
      id: 1,
      submitted_at: '2026-11-05T12:00:00Z',
      files: [
        {
          id: 1,
          file_name: 'capitulo2.pdf',
          size_bytes: 1536,
          content_type: 'application/pdf',
        },
        {
          id: 2,
          file_name: 'anexos.zip',
          size_bytes: 3 * 1024 * 1024,
          content_type: 'application/zip',
        },
      ],
    },
  ],
  reviews: [
    { id: 1, decision: 'rejected', decided_at: '2026-11-06T10:00:00Z' },
    { id: 2, decision: 'accepted', decided_at: '2026-11-07T10:00:00Z' },
  ],
  comments_count: 3,
});

describe('ActivityDetailPage: o conteúdo', () => {
  it('mostra o título, a descrição, o prazo, a situação com o selo, o aluno, o orientador e a criação', async () => {
    setup([FULL], 'student', '/aluno/atividades/5');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Capítulo 2' }),
    ).toBeVisible();
    expect(screen.getByText('Entregar o capítulo 2 do TCC')).toBeVisible();
    expect(screen.getByText('31 de dezembro de 2026')).toBeVisible();
    expect(screen.getByText('Em revisão')).toBeVisible();
    expect(screen.getByText('Atrasada')).toBeVisible();
    expect(screen.getByText('Maria Lima')).toBeVisible();
    expect(screen.getByText('Carlos Lima')).toBeVisible();
    expect(screen.getByText('2 de novembro de 2026')).toBeVisible();
  });

  it('não mostra o selo Atrasada quando o servidor não o informa, mesmo com o prazo passado', async () => {
    setup(
      [makeActivity(5, { deadline: '2020-01-01', overdue: false })],
      'student',
      '/aluno/atividades/5',
    );

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(screen.queryByText('Atrasada')).not.toBeInTheDocument();
  });

  it('não mostra a linha do orientador quando o servidor não a envia', async () => {
    setup(
      [makeActivity(5, { teacher: null })],
      'student',
      '/aluno/atividades/5',
    );

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(screen.queryByText('Orientador')).not.toBeInTheDocument();
  });

  it('lista as entregas com a data de envio e os arquivos, com nome, tamanho e tipo, sem link de download', async () => {
    setup([FULL], 'teacher', '/professor/atividades/5');

    const section = await screen.findByRole('region', { name: 'Entregas' });

    expect(within(section).getByText(/5 de novembro de 2026/)).toBeVisible();
    expect(within(section).getByText('capitulo2.pdf')).toBeVisible();
    expect(within(section).getByText(/1,5 KB/)).toBeVisible();
    expect(within(section).getByText(/application\/pdf/)).toBeVisible();
    expect(within(section).getByText('anexos.zip')).toBeVisible();
    expect(within(section).getByText(/3,0 MB/)).toBeVisible();
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  });

  it('mostra o histórico de revisões e a contagem de comentários', async () => {
    setup([FULL], 'teacher', '/professor/atividades/5');

    const reviews = await screen.findByRole('region', { name: 'Revisões' });

    expect(within(reviews).getByText(/Recusada/)).toBeVisible();
    expect(within(reviews).getByText(/6 de novembro de 2026/)).toBeVisible();
    expect(within(reviews).getByText(/Aceita/)).toBeVisible();
    expect(screen.getByText('3 comentários')).toBeVisible();
  });

  it('diz que ainda não há entregas nem revisões, e que não há comentários', async () => {
    setup([makeActivity(5)], 'student', '/aluno/atividades/5');

    expect(await screen.findByText('Nenhuma entrega ainda.')).toBeVisible();
    expect(screen.getByText('Nenhuma revisão ainda.')).toBeVisible();
    expect(screen.getByText('Nenhum comentário')).toBeVisible();
  });

  it('tem os pontos de encaixe de comentários e de revisão, ainda sem implementação', async () => {
    setup([makeActivity(5)], 'student', '/aluno/atividades/5');

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    for (const name of ['Comentários', 'Revisão']) {
      const slot = screen.getByRole('region', { name });
      expect(within(slot).getByText('Disponível em breve')).toBeVisible();
    }
  });

  it('a seção "Status e entrega" já é do aluno: com conteúdo e sem o aviso de em breve', async () => {
    setup([makeActivity(5)], 'student', '/aluno/atividades/5');

    const section = await screen.findByRole('region', {
      name: 'Status e entrega',
    });

    expect(
      within(section).queryByText('Disponível em breve'),
    ).not.toBeInTheDocument();
    expect(
      within(section).getByRole('group', { name: 'Status da atividade' }),
    ).toBeVisible();
  });
});

describe('ActivityDetailPage: editar e excluir', () => {
  it('o professor vê Editar e Excluir habilitados numa atividade em aberto', async () => {
    setup([makeActivity(5)], 'teacher', '/professor/atividades/5');

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled();
    expect(
      screen.queryByText('Atividade concluída não pode ser alterada'),
    ).not.toBeInTheDocument();
  });

  it('numa atividade concluída os dois ficam desabilitados, com o motivo visível', async () => {
    setup(
      [makeActivity(5, { status: 'completed' })],
      'teacher',
      '/professor/atividades/5',
    );

    const edit = await screen.findByRole('button', { name: 'Editar' });

    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.getByText('Atividade concluída não pode ser alterada'),
    ).toBeVisible();
  });

  it('o aluno não vê Editar nem Excluir', async () => {
    setup([makeActivity(5)], 'student', '/aluno/atividades/5');

    await screen.findByRole('heading', { level: 1, name: 'Atividade 5' });

    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir' }),
    ).not.toBeInTheDocument();
  });
});

describe('ActivityDetailPage: navegação e erros', () => {
  it('o Voltar leva à lista de onde veio, com a página e os filtros', async () => {
    const { events } = setup([FULL], 'teacher', '/professor/atividades/5', [
      {
        pathname: '/professor/atividades/5',
        state: { from: '/professor/atividades?situacao=pending&pagina=2' },
      },
    ]);

    await events.click(await screen.findByRole('link', { name: 'Voltar' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/atividades?situacao=pending&pagina=2',
    );
  });

  it('sem origem, o Voltar leva à lista do perfil', async () => {
    const { events } = setup([FULL], 'student', '/aluno/atividades/5');

    await events.click(await screen.findByRole('link', { name: 'Voltar' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/atividades$/,
    );
  });

  it('ignora uma origem que não é uma lista de atividades da própria área', async () => {
    const { events } = setup([FULL], 'student', '/aluno/atividades/5', [
      {
        pathname: '/aluno/atividades/5',
        state: { from: '/professor/solicitacoes' },
      },
    ]);

    await events.click(await screen.findByRole('link', { name: 'Voltar' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/atividades$/,
    );
  });

  it('ignora uma origem que é outra lista da própria área, como a de orientadores', async () => {
    const { events } = setup([FULL], 'student', '/aluno/atividades/5', [
      {
        pathname: '/aluno/atividades/5',
        state: { from: '/aluno/orientadores?nome=ana' },
      },
    ]);

    await events.click(await screen.findByRole('link', { name: 'Voltar' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/atividades$/,
    );
  });

  it('uma atividade que não existe, ou que não é do usuário, mostra Atividade não encontrada, com o link de volta', async () => {
    const { events } = setup([FULL], 'student', '/aluno/atividades/999');

    expect(
      await screen.findByRole('heading', { name: 'Atividade não encontrada' }),
    ).toBeVisible();
    await events.click(screen.getByRole('link', { name: 'Voltar' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/atividades$/,
    );
  });

  it('um id que não é um número mostra Atividade não encontrada sem chamar a API', async () => {
    const { fetchMock } = setup([FULL], 'student', '/aluno/atividades/abc');

    expect(
      await screen.findByRole('heading', { name: 'Atividade não encontrada' }),
    ).toBeVisible();
    const detailCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/atividades/'),
    );
    expect(detailCalls).toHaveLength(0);
  });

  it('mostra o esqueleto enquanto carrega e oferece Tentar novamente quando falha', async () => {
    const server = activitiesServer([makeActivity(5)], { user: 'student' });
    let failing = true;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = server.routes['GET /api/atividades/:id']!;
    server.routes['GET /api/atividades/:id'] = async (body, url, params) => {
      await gate;
      if (failing) return { status: 500, body: {} };
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp('/aluno/atividades/5');

    expect(await screen.findByTestId('activity-skeleton')).toBeVisible();
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Atividade 5' }),
    ).toBeVisible();
  });
});
