import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import {
  makeActivityRecord,
  makeAdvisingReport,
  makeMeetingRecord,
  recordsRoutes,
  reportRoutes,
  type FakeRecord,
} from '../test/advisingReportApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PATH = '/aluno/historico/7/relatorio';

function setup(
  records: FakeRecord[],
  { path = PATH, user = 'student' as 'student' | 'teacher' } = {},
) {
  const fetchMock = mockApi({
    ...reportRoutes([makeAdvisingReport(7)], user),
    ...recordsRoutes(7, records),
  });
  renderApp(path);
  return fetchMock;
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('AdvisingReportPage: o histórico de acontecimentos (RF61)', () => {
  it('mostra o subtítulo, o título "Todos os registros" e o contador do filtro', async () => {
    setup([makeMeetingRecord(1), makeActivityRecord(2), makeActivityRecord(3)]);

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Histórico de acontecimentos',
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Todos os registros',
      }),
    ).toBeVisible();
    expect(await screen.findByText('3 registros')).toBeVisible();
  });

  it('o contador fala "1 registro" no singular', async () => {
    setup([makeActivityRecord(2)]);

    expect(await screen.findByText('1 registro')).toBeVisible();
  });

  it('o cartão da reunião tem o chip, o título fixo, a data e a descrição', async () => {
    setup([
      makeMeetingRecord(1, {
        date: '2026-10-20',
        description: 'Discussão dos ajustes finais do trabalho.',
      }),
    ]);

    const card = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });

    expect(within(card).getByText('Reunião')).toBeVisible();
    expect(within(card).getByText('20/10/2026')).toBeVisible();
    expect(
      within(card).getByText('Discussão dos ajustes finais do trabalho.'),
    ).toBeVisible();
  });

  it('o cartão da atividade tem o chip, o título, o prazo, a situação e a descrição', async () => {
    setup([
      makeActivityRecord(2, {
        title: 'Revisar capítulo de resultados',
        date: '2026-11-05',
        deadline: '2026-11-05',
        status: 'archived',
        description: 'Atividade entregue pelo orientando.',
      }),
    ]);

    const card = await screen.findByRole('article', {
      name: 'Revisar capítulo de resultados',
    });

    expect(within(card).getByText('Atividade')).toBeVisible();
    expect(within(card).getByText('05/11/2026')).toBeVisible();
    expect(within(card).getByText('Arquivada')).toBeVisible();
    expect(
      within(card).getByText('Atividade entregue pelo orientando.'),
    ).toBeVisible();
  });

  it('uma atividade concluída mostra a situação "Concluída"', async () => {
    setup([makeActivityRecord(2, { status: 'completed' })]);

    expect(
      within(await screen.findByRole('article')).getByText('Concluída'),
    ).toBeVisible();
  });

  it('mantém a ordem do servidor, com reunião e atividade de mesmo id em cartões distintos', async () => {
    setup([
      makeMeetingRecord(1),
      makeActivityRecord(1, { title: 'Atividade A' }),
    ]);
    await screen.findByText('2 registros');

    expect(
      screen
        .getAllByRole('article')
        .map((card) => within(card).getByRole('heading').textContent),
    ).toEqual(['Reunião realizada', 'Atividade A']);
  });
});

describe('AdvisingReportPage: o filtro "Tipo de registro" e a URL (RNF30)', () => {
  const records: FakeRecord[] = [
    makeMeetingRecord(1),
    makeActivityRecord(2, { title: 'Atividade A' }),
    makeActivityRecord(3, { title: 'Atividade B' }),
  ];

  function pressed(name: string) {
    return screen.getByRole('button', { name }).getAttribute('aria-pressed');
  }

  it('abre em "Todos", com os três tipos de filtro disponíveis', async () => {
    setup(records);
    await screen.findByText('3 registros');

    const group = screen.getByRole('group', { name: 'Tipo de registro' });

    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Todos', 'Reuniões', 'Atividades']);
    expect(pressed('Todos')).toBe('true');
  });

  it('"Reuniões" mostra só reuniões, com o título e o contador do filtro, e a URL guarda o tipo', async () => {
    const fetchMock = setup(records);
    const user = userEvent.setup();
    await screen.findByText('3 registros');

    await user.click(screen.getByRole('button', { name: 'Reuniões' }));

    expect(await screen.findByText('1 registro')).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Reuniões' }),
    ).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent(
      `${PATH}?tipo=reunioes`,
    );
    expect(
      new URL(
        String(
          requestsTo(fetchMock, 'GET /api/orientacao/historico/7/registros').at(
            -1,
          )?.[0],
        ),
        'http://localhost',
      ).searchParams.get('type'),
    ).toBe('meeting');
    expect(pressed('Reuniões')).toBe('true');
  });

  it('"Atividades" mostra só atividades e "Todos" volta a URL ao padrão', async () => {
    setup(records);
    const user = userEvent.setup();
    await screen.findByText('3 registros');

    await user.click(screen.getByRole('button', { name: 'Atividades' }));
    expect(await screen.findByText('2 registros')).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Atividades' }),
    ).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?tipo=atividades',
    );

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(await screen.findByText('3 registros')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      new RegExp(`${PATH}$`),
    );
  });

  it('o filtro não altera os totais do resumo', async () => {
    setup(records);
    const user = userEvent.setup();
    await screen.findByText('3 registros');

    await user.click(screen.getByRole('button', { name: 'Reuniões' }));
    await screen.findByText('1 registro');

    expect(
      within(screen.getByRole('group', { name: 'Registros' })).getByText('5'),
    ).toBeVisible();
  });

  it('recarregar em ?tipo=atividades abre o filtro já aplicado', async () => {
    setup(records, { path: `${PATH}?tipo=atividades` });

    expect(await screen.findByText('2 registros')).toBeVisible();
    expect(pressed('Atividades')).toBe('true');
    expect(screen.queryByText('Reunião realizada')).not.toBeInTheDocument();
  });

  it('um tipo inválido na URL vale como "Todos"', async () => {
    setup(records, { path: `${PATH}?tipo=xyz` });

    expect(await screen.findByText('3 registros')).toBeVisible();
    expect(pressed('Todos')).toBe('true');
  });

  it('mudar o filtro volta à primeira página', async () => {
    setup(records, { path: `${PATH}?pagina=2` });
    const user = userEvent.setup();
    await screen.findByRole('heading', {
      level: 3,
      name: 'Todos os registros',
    });

    await user.click(screen.getByRole('button', { name: 'Atividades' }));

    expect(screen.getByTestId('location')).not.toHaveTextContent('pagina');
  });
});

describe('AdvisingReportPage: abrir um registro no próprio lugar', () => {
  const meeting = makeMeetingRecord(1, {
    date: '2026-10-20',
    starts_at: '2026-10-20T10:00:00-03:00',
    ends_at: '2026-10-20T11:30:00-03:00',
    description: 'Discussão dos ajustes finais do trabalho.',
    notes: 'Revisar as referências até a próxima semana.',
  });
  const activity = makeActivityRecord(2, {
    title: 'Revisar capítulo de resultados',
    deadline: '2026-11-05',
    date: '2026-11-05',
    status: 'archived',
    description: 'Atividade entregue pelo orientando.',
  });

  function detailsButton(card: HTMLElement) {
    return within(card).getByRole('button', { name: /detalhes/ });
  }

  it('cada cartão fechado oferece "Ver detalhes", sem mostrar os detalhes', async () => {
    setup([meeting, activity]);
    const card = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });

    expect(detailsButton(card)).toHaveTextContent('Ver detalhes');
    expect(detailsButton(card)).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(card).queryByText('Revisar as referências até a próxima semana.'),
    ).not.toBeInTheDocument();
  });

  it('abre a reunião com o horário de início e de término e os apontamentos', async () => {
    setup([meeting]);
    const user = userEvent.setup();
    const card = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });

    await user.click(detailsButton(card));

    expect(detailsButton(card)).toHaveAttribute('aria-expanded', 'true');
    expect(detailsButton(card)).toHaveTextContent('Ocultar detalhes');
    expect(
      within(card).getByText('Discussão dos ajustes finais do trabalho.'),
    ).toBeVisible();
    expect(
      within(card).getByText('20 de outubro de 2026, das 10:00 às 11:30'),
    ).toBeVisible();
    expect(within(card).getByText('Apontamentos')).toBeVisible();
    expect(
      within(card).getByText('Revisar as referências até a próxima semana.'),
    ).toBeVisible();
  });

  it('uma reunião sem apontamentos diz que não há', async () => {
    setup([makeMeetingRecord(1, { notes: '' })]);
    const user = userEvent.setup();
    const card = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });

    await user.click(detailsButton(card));

    expect(
      within(card).getByText('Sem apontamentos registrados.'),
    ).toBeVisible();
  });

  it('abre a atividade com a descrição completa, o prazo e a situação', async () => {
    setup([activity]);
    const user = userEvent.setup();
    const card = await screen.findByRole('article', {
      name: 'Revisar capítulo de resultados',
    });

    await user.click(detailsButton(card));

    expect(within(card).getByText('Prazo')).toBeVisible();
    expect(within(card).getByText('5 de novembro de 2026')).toBeVisible();
    expect(within(card).getByText('Situação')).toBeVisible();
    expect(within(card).getAllByText('Arquivada')).toHaveLength(1);
    expect(
      within(card).getByText('Atividade entregue pelo orientando.'),
    ).toBeVisible();
  });

  it('fecha o cartão aberto, voltando à lista compacta', async () => {
    setup([meeting]);
    const user = userEvent.setup();
    const card = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });

    await user.click(detailsButton(card));
    await user.click(detailsButton(card));

    await waitFor(() =>
      expect(
        within(card).queryByText(
          'Revisar as referências até a próxima semana.',
        ),
      ).not.toBeInTheDocument(),
    );
    expect(detailsButton(card)).toHaveTextContent('Ver detalhes');
  });

  it('abre e fecha só pelo teclado, com Enter', async () => {
    setup([meeting]);
    const user = userEvent.setup();
    const card = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });

    detailsButton(card).focus();
    await user.keyboard('{Enter}');

    expect(detailsButton(card)).toHaveAttribute('aria-expanded', 'true');
    expect(detailsButton(card)).toHaveFocus();
  });

  it('abrir um cartão não fecha os outros', async () => {
    setup([meeting, activity]);
    const user = userEvent.setup();
    const first = await screen.findByRole('article', {
      name: 'Reunião realizada',
    });
    const second = screen.getByRole('article', {
      name: 'Revisar capítulo de resultados',
    });

    await user.click(detailsButton(first));
    await user.click(detailsButton(second));

    expect(detailsButton(first)).toHaveAttribute('aria-expanded', 'true');
    expect(detailsButton(second)).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('AdvisingReportPage: estados da lista e anúncio', () => {
  it('enquanto a lista carrega, mostra um esqueleto escondido do leitor de tela', async () => {
    setup([makeActivityRecord(2)]);

    expect(await screen.findByTestId('records-skeleton')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await screen.findByText('1 registro');
    expect(screen.queryByTestId('records-skeleton')).not.toBeInTheDocument();
  });

  it('uma falha na lista mostra o erro com "Tentar novamente" e não derruba o cabeçalho e os totais', async () => {
    let calls = 0;
    const fetchMock = mockApi({
      ...reportRoutes([makeAdvisingReport(7)]),
      ...recordsRoutes(7, [], () => {
        calls += 1;
        return calls === 1
          ? { status: 500, body: { detail: 'Falha no servidor.' } }
          : { body: { items: [makeActivityRecord(2)], count: 1 } };
      }),
    });
    renderApp(PATH);
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pessoa 7' }),
    ).toBeVisible();
    expect(screen.getByRole('group', { name: 'Registros' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('1 registro')).toBeVisible();
    expect(
      requestsTo(fetchMock, 'GET /api/orientacao/historico/7/registros'),
    ).toHaveLength(2);
  });

  it('uma orientação sem registros mostra uma mensagem informativa', async () => {
    setup([]);

    expect(
      await screen.findByText(/Esta orientação não tem registros/),
    ).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('um filtro sem resultado mostra a mensagem do filtro e "Ver todos os registros"', async () => {
    setup([makeActivityRecord(2)], { path: `${PATH}?tipo=reunioes` });
    const user = userEvent.setup();

    expect(await screen.findByText(/Nenhum registro deste tipo/)).toBeVisible();
    expect(
      screen.queryByText(/Esta orientação não tem registros/),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Ver todos os registros' }),
    );

    expect(await screen.findByText('1 registro')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      new RegExp(`${PATH}$`),
    );
  });

  it('anuncia a quantidade de registros do filtro numa região de status', async () => {
    setup([makeMeetingRecord(1), makeActivityRecord(2), makeActivityRecord(3)]);
    const user = userEvent.setup();
    await screen.findByText('3 registros');

    const section = screen.getByRole('region', {
      name: 'Histórico de acontecimentos',
    });

    expect(within(section).getByRole('status')).toHaveTextContent(
      '3 registros',
    );

    await user.click(screen.getByRole('button', { name: 'Atividades' }));

    await waitFor(() =>
      expect(within(section).getByRole('status')).toHaveTextContent(
        '2 registros',
      ),
    );
  });
});

describe('AdvisingReportPage: a paginação e a URL (RNF30)', () => {
  const many: FakeRecord[] = Array.from({ length: 25 }, (_, index) =>
    makeActivityRecord(index + 1),
  );

  function offsets(fetchMock: ReturnType<typeof mockApi>) {
    return requestsTo(
      fetchMock,
      'GET /api/orientacao/historico/7/registros',
    ).map(([input]) => {
      const params = new URL(String(input), 'http://localhost').searchParams;
      return { limit: params.get('limit'), offset: params.get('offset') };
    });
  }

  it('pede 10 por página e mostra os 10 primeiros registros', async () => {
    const fetchMock = setup(many);

    expect(await screen.findByText('25 registros')).toBeVisible();

    expect(offsets(fetchMock)).toEqual([{ limit: '10', offset: '0' }]);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('abre a segunda página pela navegação e guarda a página na URL', async () => {
    const fetchMock = setup(many);
    const user = userEvent.setup();
    await screen.findByText('25 registros');

    await user.click(
      within(
        screen.getByRole('navigation', { name: 'Paginação dos registros' }),
      ).getByRole('button', { name: /Ir para a página 2/ }),
    );

    expect(await screen.findByText('Atividade 11')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      `${PATH}?pagina=2`,
    );
    expect(offsets(fetchMock).at(-1)).toEqual({ limit: '10', offset: '10' });
    expect(screen.queryByText('Atividade 1')).not.toBeInTheDocument();
  });

  it('mantém o tipo de registro na URL ao trocar de página', async () => {
    setup(many, { path: `${PATH}?tipo=atividades` });
    const user = userEvent.setup();
    await screen.findByText('25 registros');

    await user.click(
      within(
        screen.getByRole('navigation', { name: 'Paginação dos registros' }),
      ).getByRole('button', { name: /Ir para a página 2/ }),
    );

    await screen.findByText('Atividade 11');
    expect(screen.getByTestId('location')).toHaveTextContent(
      `${PATH}?tipo=atividades&pagina=2`,
    );
  });

  it('recarregar em ?pagina=3 volta à mesma página', async () => {
    const fetchMock = setup(many, { path: `${PATH}?pagina=3` });

    expect(await screen.findByText('Atividade 21')).toBeVisible();
    expect(offsets(fetchMock)).toEqual([{ limit: '10', offset: '20' }]);
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });

  it('uma página além da última volta para a última, sem entrar no histórico', async () => {
    setup(many, { path: `${PATH}?pagina=9` });

    expect(await screen.findByText('Atividade 21')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        `${PATH}?pagina=3`,
      ),
    );
  });

  it('com 10 registros ou menos, a navegação não aparece', async () => {
    setup(many.slice(0, 10));
    await screen.findByText('10 registros');

    expect(
      screen.queryByRole('navigation', { name: 'Paginação dos registros' }),
    ).not.toBeInTheDocument();
  });
});

describe('AdvisingReportPage: o celular', () => {
  it('em tela estreita, o filtro, os cartões e a navegação continuam disponíveis', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup(
      Array.from({ length: 12 }, (_, index) => makeActivityRecord(index + 1)),
    );

    expect(await screen.findByText('12 registros')).toBeVisible();
    expect(
      screen.getByRole('group', { name: 'Tipo de registro' }),
    ).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(10);
    expect(
      screen.getByRole('navigation', { name: 'Paginação dos registros' }),
    ).toBeVisible();
  });
});
