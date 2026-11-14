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
      screen
        .getAllByRole('article')
        .map((card) => within(card).getByRole('heading').textContent),
    ).toEqual(['Pessoa 7', 'Pessoa 3', 'Pessoa 5']);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Orientações anteriores' }),
    ).toBeVisible();
    expect(
      screen.getByText('Consulte os registros das orientações encerradas.'),
    ).toBeVisible();
  });

  it('mostra no cartão o professor, o tema congelado, o início e o encerramento, sem o motivo', async () => {
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

    expect(within(card).getByText('Encerrada')).toBeVisible();
    expect(within(card).getByText('Tema da orientação')).toBeVisible();
    expect(
      within(card).getByText('Aprendizado de máquina na saúde'),
    ).toBeVisible();
    expect(within(card).getByText('Início')).toBeVisible();
    expect(within(card).getByText('03/08/2026')).toBeVisible();
    expect(within(card).getByText('Encerramento')).toBeVisible();
    expect(within(card).getByText('02/11/2026')).toBeVisible();
    expect(
      within(card).queryByText('Motivo do encerramento'),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByText('Concluímos o ciclo de orientação do TCC.'),
    ).not.toBeInTheDocument();
  });

  it('mostra "Ver relatório" só como texto, sem link nem botão', async () => {
    setup([makeEndedAdvising(1)]);
    await screen.findByText('Pessoa 1');

    const card = cardOf('Pessoa 1');

    expect(within(card).getByText('Ver relatório')).toBeVisible();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('mostra "Sem tema cadastrado" quando a orientação não teve tema', async () => {
    setup([makeEndedAdvising(1, { thesis_topic: null })]);
    await screen.findByText('Pessoa 1');

    const card = cardOf('Pessoa 1');

    expect(within(card).getByText('Sem tema cadastrado')).toBeVisible();
  });

  it('mostra só o total de orientações encerradas, sem o de orientandos', async () => {
    setup([makeEndedAdvising(1), makeEndedAdvising(2), makeEndedAdvising(3)]);

    const total = await screen.findByRole('group', {
      name: 'Orientações encerradas',
    });

    expect(within(total).getByText('3')).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Orientandos' }),
    ).not.toBeInTheDocument();
  });

  it('o campo se chama "Buscar orientador" e a busca vai ao servidor, sem acento e por tema', async () => {
    const { fetchMock, user } = setup([
      makeEndedAdvising(1, {
        counterpart: { id: 50, full_name: 'Márcia Professora' },
        thesis_topic: 'Redes neurais',
      }),
      makeEndedAdvising(2, {
        counterpart: { id: 51, full_name: 'João Orientador' },
        thesis_topic: 'Banco de dados',
      }),
    ]);
    await screen.findByText('Márcia Professora');

    await user.type(screen.getByLabelText('Buscar orientador'), 'marcia');

    await waitFor(() =>
      expect(screen.queryByText('João Orientador')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Márcia Professora')).toBeVisible();
    expect(
      new URL(
        String(requestsTo(fetchMock, LIST).at(-1)?.[0]),
        'http://localhost',
      ).searchParams.get('search'),
    ).toBe('marcia');
    expect(screen.getByTestId('location')).toHaveTextContent('?busca=marcia');
    expect(screen.getByText('1 orientação encontrada')).toBeVisible();

    await user.clear(screen.getByLabelText('Buscar orientador'));
    await user.type(screen.getByLabelText('Buscar orientador'), 'dados');
    expect(await screen.findByText('João Orientador')).toBeVisible();
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

  it('busca sem resultado mostra o aviso e "Limpar busca" traz a lista de volta', async () => {
    const { user } = setup([makeEndedAdvising(1)], {
      path: '/aluno/historico?busca=zzz',
    });

    expect(
      await screen.findByText(/Nenhuma orientação encontrada para essa busca/),
    ).toBeVisible();
    expect(screen.getByLabelText('Buscar orientador')).toHaveValue('zzz');

    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));

    expect(await screen.findByText('Pessoa 1')).toBeVisible();
    expect(screen.getByLabelText('Buscar orientador')).toHaveValue('');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/historico$/,
    );
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
      { user: 'teacher' },
    );

    await screen.findByRole('article', { name: 'Ana Souza' });

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Histórico de orientações',
      }),
    ).toBeInTheDocument();
  });

  it('mostra os totais de orientações encerradas e de orientandos', async () => {
    setup([makeEndedAdvising(1), makeEndedAdvising(2)], { user: 'teacher' });

    const ended = await screen.findByRole('group', {
      name: 'Orientações encerradas',
    });
    const active = screen.getByRole('group', { name: 'Orientandos' });

    expect(within(ended).getByText('2')).toBeVisible();
    expect(within(active).getByText('4')).toBeVisible();
  });

  it('os totais não mudam com a busca, e o campo se chama "Buscar orientando"', async () => {
    const { user } = setup(
      [
        makeEndedAdvising(1, {
          counterpart: { id: 70, full_name: 'Ana Souza' },
        }),
        makeEndedAdvising(2, {
          counterpart: { id: 71, full_name: 'Bruno Lima' },
        }),
      ],
      { user: 'teacher' },
    );
    await screen.findByText('Ana Souza');

    await user.type(screen.getByLabelText('Buscar orientando'), 'bruno');

    await waitFor(() =>
      expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument(),
    );
    expect(
      within(
        screen.getByRole('group', { name: 'Orientações encerradas' }),
      ).getByText('2'),
    ).toBeVisible();
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

    expect(within(card).getByText('Tema da orientação 1')).toBeVisible();
    expect(within(card).getByText('Ver relatório')).toBeVisible();
  });
});
