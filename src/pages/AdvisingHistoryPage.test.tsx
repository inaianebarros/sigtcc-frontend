import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { historyRoutes, makeEndedAdvising } from '../test/advisingHistoryApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/orientacao/historico';

function cardOf(name: string) {
  return screen.getByRole('article', { name });
}

function offsets(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return { limit: params.get('limit'), offset: params.get('offset') };
  });
}

function setup(
  items = [makeEndedAdvising(1), makeEndedAdvising(2)],
  {
    user = 'student',
    path,
  }: { user?: 'student' | 'teacher'; path?: string } = {},
) {
  const fetchMock = mockApi(historyRoutes(items, user));
  const person = userEvent.setup();
  renderApp(
    path ?? (user === 'student' ? '/aluno/historico' : '/professor/historico'),
  );
  return { fetchMock, user: person };
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('AdvisingHistoryPage: o histórico do aluno', () => {
  it('abre em /aluno/historico com o título e um cartão por orientação, na ordem da API', async () => {
    setup([makeEndedAdvising(7), makeEndedAdvising(3), makeEndedAdvising(5)]);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Histórico de orientações',
      }),
    ).toBeInTheDocument();
    await screen.findByText('Pessoa 7');

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Pessoa 7', 'Pessoa 3', 'Pessoa 5']);
    expect(screen.getByText('3 orientações encerradas')).toBeVisible();
  });

  it('mostra no cartão o professor, o início, o encerramento, o motivo e o tema congelado', async () => {
    setup([
      makeEndedAdvising(1, {
        counterpart: { id: 50, full_name: 'Paulo Professor' },
        started_at: '2026-08-03T14:30:00Z',
        ended_at: '2026-11-02T14:30:00Z',
        reason: 'Concluímos o ciclo de orientação do TCC.',
        thesis_topic: 'Aprendizado de máquina na saúde',
      }),
    ]);
    await screen.findByText('Paulo Professor');

    const card = cardOf('Paulo Professor');

    expect(within(card).getByText('Professor orientador')).toBeVisible();
    expect(
      within(card).getByText('Orientação iniciada em 3 de agosto de 2026'),
    ).toBeVisible();
    expect(
      within(card).getByText('Orientação encerrada em 2 de novembro de 2026'),
    ).toBeVisible();
    expect(
      within(card).getByText('Concluímos o ciclo de orientação do TCC.'),
    ).toBeVisible();
    expect(
      within(card).getByText('Tema: Aprendizado de máquina na saúde'),
    ).toBeVisible();
  });

  it('o motivo e o tema ficam sob rótulos próprios, para o leitor de tela', async () => {
    setup([makeEndedAdvising(1)]);
    await screen.findByText('Pessoa 1');

    const card = cardOf('Pessoa 1');

    expect(within(card).getByText('Motivo do encerramento')).toBeVisible();
    expect(
      within(card).getByText('Concluímos o ciclo da orientação 1.'),
    ).toBeVisible();
  });

  it('mostra "Sem tema cadastrado" quando a orientação não teve tema', async () => {
    setup([makeEndedAdvising(1, { thesis_topic: null })]);
    await screen.findByText('Pessoa 1');

    const card = cardOf('Pessoa 1');

    expect(within(card).getByText('Sem tema cadastrado')).toBeVisible();
    expect(within(card).queryByText(/^Tema:/)).not.toBeInTheDocument();
  });

  it('sem orientações encerradas, mostra um estado vazio que explica o que aparece ali', async () => {
    setup([]);

    expect(
      await screen.findByText(/Você ainda não tem orientações encerradas/),
    ).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Paginação do histórico' }),
    ).not.toBeInTheDocument();
  });
});

describe('AdvisingHistoryPage: o histórico do professor', () => {
  it('abre em /professor/historico e mostra o aluno de cada orientação', async () => {
    setup(
      [
        makeEndedAdvising(1, {
          counterpart: { id: 70, full_name: 'Ana Souza' },
        }),
      ],
      {
        user: 'teacher',
      },
    );

    const card = await screen.findByRole('article', { name: 'Ana Souza' });

    expect(within(card).getByText('Aluno')).toBeVisible();
    expect(
      within(card).queryByText('Professor orientador'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Histórico de orientações',
      }),
    ).toBeInTheDocument();
  });

  it('sem orientações encerradas, o estado vazio fala das orientações que o professor encerrou', async () => {
    setup([], { user: 'teacher' });

    expect(
      await screen.findByText(/Você ainda não encerrou nenhuma orientação/),
    ).toBeVisible();
  });
});

describe('AdvisingHistoryPage: a paginação e a URL (RNF30)', () => {
  const many = Array.from({ length: 45 }, (_, index) =>
    makeEndedAdvising(index + 1),
  );

  it('pede 20 por página, abre a segunda página pela URL e mostra os itens dela', async () => {
    const { fetchMock, user } = setup(many);
    await screen.findByText('Pessoa 1');
    expect(offsets(fetchMock)).toEqual([{ limit: '20', offset: '0' }]);

    await user.click(
      within(
        screen.getByRole('navigation', { name: 'Paginação do histórico' }),
      ).getByRole('button', { name: /Ir para a página 2/ }),
    );

    expect(await screen.findByText('Pessoa 21')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/historico?pagina=2',
    );
    expect(offsets(fetchMock).at(-1)).toEqual({ limit: '20', offset: '20' });
    expect(screen.queryByText('Pessoa 1')).not.toBeInTheDocument();
  });

  it('recarregar em ?pagina=3 volta à mesma página', async () => {
    const { fetchMock } = setup(many, { path: '/aluno/historico?pagina=3' });

    expect(await screen.findByText('Pessoa 41')).toBeVisible();
    expect(offsets(fetchMock)).toEqual([{ limit: '20', offset: '40' }]);
  });

  it('uma página além da última volta para a última, sem entrar no histórico', async () => {
    setup(many, { path: '/aluno/historico?pagina=9' });

    expect(await screen.findByText('Pessoa 41')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/historico?pagina=3',
      ),
    );
  });
});

describe('AdvisingHistoryPage: falha e carregamento', () => {
  it('mostra a mensagem de erro e tenta de novo', async () => {
    let calls = 0;
    const fetchMock = mockApi(
      historyRoutes([makeEndedAdvising(1)], 'student', () => {
        calls += 1;
        return calls === 1
          ? { status: 500, body: { detail: 'Falha no servidor.' } }
          : { body: { items: [makeEndedAdvising(1)], count: 1 } };
      }),
    );
    const user = userEvent.setup();
    renderApp('/aluno/historico');

    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Pessoa 1')).toBeVisible();
    expect(requestsTo(fetchMock, LIST)).toHaveLength(2);
  });

  it('enquanto carrega, mostra um esqueleto escondido do leitor de tela', async () => {
    setup([makeEndedAdvising(1)]);

    expect(await screen.findByTestId('history-skeleton')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await screen.findByText('Pessoa 1');
    expect(screen.queryByTestId('history-skeleton')).not.toBeInTheDocument();
  });
});

describe('AdvisingHistoryPage: o celular', () => {
  it('em tela estreita, a lista continua legível e com os mesmos dados', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup([makeEndedAdvising(1)]);

    const card = await screen.findByRole('article', { name: 'Pessoa 1' });

    expect(within(card).getByText('Motivo do encerramento')).toBeVisible();
    expect(within(card).getByText('Tema: Tema da orientação 1')).toBeVisible();
  });
});
