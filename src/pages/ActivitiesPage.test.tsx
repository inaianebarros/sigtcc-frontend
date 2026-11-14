import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
import { makeAdvisee } from '../test/adviseesApi';
import type { FakeAdvisee } from '../test/adviseesApi';
import type { FakeActivity } from '../test/activitiesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/atividades';
const STUDENT_PATH = '/aluno/atividades';
const TEACHER_PATH = '/professor/atividades';

function setup(
  activities: FakeActivity[],
  user: 'student' | 'teacher',
  path = user === 'student' ? STUDENT_PATH : TEACHER_PATH,
  advisees: FakeAdvisee[] = [],
) {
  const server = activitiesServer(activities, { user, advisees });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

function listRequests(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(
    ([input]) => new URL(String(input), 'http://localhost').searchParams,
  );
}

/** O cartão da atividade: o link inteiro, cujo nome reúne título, aluno, prazo e situação. */
function cardOf(title: string) {
  return screen.getByRole('link', { name: new RegExp(title) });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('ActivitiesPage: a lista do aluno', () => {
  it('mostra o título, o prazo dd/mm/aaaa, a situação em pílula e o selo Atrasada só quando o servidor diz que está atrasada', async () => {
    setup(
      [
        makeActivity(1, {
          title: 'Capítulo 2',
          deadline: '2026-12-31',
          status: 'in_progress',
        }),
        // O prazo já passou, mas o servidor diz que não está atrasada: a tela não recalcula.
        makeActivity(2, {
          title: 'Resumo',
          deadline: '2020-01-01',
          status: 'pending',
          overdue: false,
        }),
        makeActivity(3, {
          title: 'Introdução',
          deadline: '2026-01-10',
          status: 'pending',
          overdue: true,
        }),
        makeActivity(4, { title: 'Conclusão', status: 'completed' }),
      ],
      'student',
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Atividades' }),
    ).toBeInTheDocument();
    await screen.findByText('Capítulo 2');

    expect(within(cardOf('Capítulo 2')).getByText('31/12/2026')).toBeVisible();
    expect(
      within(cardOf('Capítulo 2')).getByText('Em andamento'),
    ).toBeVisible();
    expect(within(cardOf('Resumo')).getByText('Pendente')).toBeVisible();
    expect(within(cardOf('Resumo')).getByText('01/01/2020')).toBeVisible();
    expect(within(cardOf('Conclusão')).getByText('Concluída')).toBeVisible();
    expect(screen.getAllByText('Atrasada')).toHaveLength(1);
    expect(within(cardOf('Introdução')).getByText('Atrasada')).toBeVisible();
    // A situação original continua visível ao lado do selo.
    expect(within(cardOf('Introdução')).getByText('Pendente')).toBeVisible();
  });

  it('mostra a situação em pílula, e não como texto solto', async () => {
    setup(
      [makeActivity(1, { title: 'Capítulo 2', status: 'in_review' })],
      'student',
    );

    const pill = within(
      await screen.findByRole('link', { name: /Capítulo 2/ }),
    ).getByText('Em revisão');

    expect(pill.closest('.MuiChip-root')).not.toBeNull();
  });

  it('não escreve nome de campo dentro do cartão', async () => {
    setup(
      [
        makeActivity(1, {
          title: 'Capítulo 2',
          deadline: '2026-12-31',
          student: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      'teacher',
    );

    const card = await screen.findByRole('link', { name: /Capítulo 2/ });

    expect(card.textContent).toBe('Capítulo 2Maria Lima31/12/2026Pendente');
    for (const field of [/Prazo/, /Título/, /Aluno/, /Situação/]) {
      expect(card.textContent).not.toMatch(field);
    }
  });

  it('o ícone do prazo é anunciado como Prazo pelo leitor de tela, sem rótulo visível', async () => {
    setup(
      [makeActivity(1, { title: 'Capítulo 2', deadline: '2026-12-31' })],
      'student',
    );

    const card = await screen.findByRole('link', { name: /Capítulo 2/ });

    expect(
      within(card).getByRole('img', { name: 'Prazo' }),
    ).toBeInTheDocument();
    expect(within(card).queryByText('Prazo')).not.toBeInTheDocument();
    expect(card).toHaveAccessibleName(
      /Capítulo 2.*Prazo.*31\/12\/2026.*Pendente/,
    );
  });

  it('a seta do cartão é decorativa', async () => {
    setup([makeActivity(1, { title: 'Capítulo 2' })], 'student');

    const card = await screen.findByRole('link', { name: /Capítulo 2/ });

    const arrow = card.querySelector('[data-testid="ChevronRightIcon"]');
    expect(arrow).not.toBeNull();
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
  });

  it('não mostra o nome do aluno nem o botão Nova atividade', async () => {
    setup([makeActivity(1)], 'student');

    await screen.findByText('Atividade 1');

    expect(
      screen.queryByRole('button', { name: 'Nova atividade' }),
    ).not.toBeInTheDocument();
  });

  it('abre o detalhe ao escolher a atividade', async () => {
    const { events } = setup(
      [makeActivity(5, { title: 'Capítulo 2' })],
      'student',
    );

    await events.click(await screen.findByRole('link', { name: /Capítulo 2/ }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/atividades/5',
    );
  });

  it('o cartão inteiro abre o detalhe, e não só o título', async () => {
    const { events } = setup(
      [makeActivity(5, { title: 'Capítulo 2', deadline: '2026-12-31' })],
      'student',
    );

    await events.click(await screen.findByText('31/12/2026'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/atividades/5',
    );
  });

  it('cada cartão tem um só link, operável pelo teclado', async () => {
    const { events } = setup(
      [
        makeActivity(1, { title: 'Capítulo 2' }),
        makeActivity(2, { title: 'Resumo' }),
      ],
      'student',
    );
    await screen.findByText('Capítulo 2');
    expect(
      screen.getAllByRole('link', { name: /Capítulo 2|Resumo/ }),
    ).toHaveLength(2);

    const first = screen.getAllByRole('link', {
      name: /Capítulo 2|Resumo/,
    })[0]!;
    first.focus();
    expect(first).toHaveFocus();
    expect(first).toHaveAccessibleName(/Capítulo 2|Resumo/);
    await events.keyboard('{Enter}');

    expect(screen.getByTestId('location')).toHaveTextContent(
      /\/aluno\/atividades\/\d/,
    );
  });

  it('leva a lista de onde veio, com a página e os filtros, para o Voltar do detalhe', async () => {
    const { events } = setup(
      [makeActivity(5, { title: 'Capítulo 2', status: 'in_progress' })],
      'student',
      '/aluno/atividades?situacao=in_progress',
    );

    await events.click(await screen.findByRole('link', { name: /Capítulo 2/ }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/atividades/5',
    );
    await events.click(await screen.findByRole('link', { name: /Voltar/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/atividades?situacao=in_progress',
    );
  });

  it('mostra o estado vazio quando o aluno não tem atividades', async () => {
    setup([], 'student');

    expect(
      await screen.findByText('Você ainda não possui atividades cadastradas'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Limpar filtros' }),
    ).not.toBeInTheDocument();
  });
});

describe('ActivitiesPage: a lista do professor', () => {
  it('mostra o nome do aluno no cartão, sem rótulo, e o botão Nova atividade', async () => {
    setup(
      [
        makeActivity(1, {
          title: 'Capítulo 2',
          student: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      'teacher',
    );

    await screen.findByText('Capítulo 2');

    expect(within(cardOf('Capítulo 2')).getByText('Maria Lima')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Nova atividade' }),
    ).toBeVisible();
  });

  it('mostra o estado vazio, com o botão de criar, quando não há atividades', async () => {
    setup([], 'teacher');

    expect(
      await screen.findByText(
        'Você ainda não cadastrou atividades. Use Nova atividade para criar a primeira.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Nova atividade' }),
    ).toBeVisible();
  });
});

describe('ActivitiesPage: filtros e página na URL (RNF30)', () => {
  it('guarda a situação na URL, pede só essa situação ao servidor e a restaura ao recarregar', async () => {
    const { fetchMock, events } = setup(
      [
        makeActivity(1, { title: 'Aberta', status: 'pending' }),
        makeActivity(2, { title: 'Pronta', status: 'completed' }),
      ],
      'student',
    );
    await screen.findByText('Aberta');

    await events.click(screen.getByRole('combobox', { name: 'Situação' }));
    await events.click(
      await screen.findByRole('option', { name: 'Concluída' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/atividades?situacao=completed',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText('Aberta')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Pronta')).toBeVisible();
    expect(listRequests(fetchMock).at(-1)?.get('status')).toBe('completed');
  });

  it('abre já filtrada pela URL: situação, somente atrasadas e página', async () => {
    const { fetchMock } = setup(
      [
        makeActivity(1, {
          title: 'Atrasada 1',
          overdue: true,
          status: 'pending',
        }),
      ],
      'student',
      '/aluno/atividades?situacao=pending&atrasadas=1&pagina=1',
    );

    await screen.findByText('Atrasada 1');

    const params = listRequests(fetchMock).at(-1)!;
    expect(params.get('status')).toBe('pending');
    expect(params.get('overdue')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Situação' })).toHaveValue(
      'Pendente',
    );
    expect(
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
    ).toBeChecked();
  });

  it('o interruptor Somente atrasadas guarda atrasadas=1 na URL e volta ao padrão sem parâmetro', async () => {
    const { fetchMock, events } = setup(
      [
        makeActivity(1, { title: 'No prazo' }),
        makeActivity(2, { title: 'Vencida', overdue: true }),
      ],
      'student',
    );
    await screen.findByText('No prazo');

    await events.click(
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/atividades?atrasadas=1',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText('No prazo')).not.toBeInTheDocument(),
    );
    expect(listRequests(fetchMock).at(-1)?.get('overdue')).toBe('true');

    await events.click(
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/aluno\/atividades$/,
      ),
    );
    expect(await screen.findByText('No prazo')).toBeVisible();
  });

  it('ignora situação desconhecida na URL e mostra todas', async () => {
    const { fetchMock } = setup(
      [makeActivity(1, { title: 'Qualquer' })],
      'student',
      '/aluno/atividades?situacao=arquivada',
    );

    await screen.findByText('Qualquer');

    expect(listRequests(fetchMock).at(-1)?.has('status')).toBe(false);
  });

  it('pagina de 20 em 20 e guarda a página na URL, preservando os filtros', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeActivity(index + 1, { title: `Atividade ${index + 1}` }),
    );
    const { fetchMock, events } = setup(
      many,
      'student',
      '/aluno/atividades?situacao=pending',
    );
    await screen.findByText('Atividade 1');
    expect(listRequests(fetchMock).at(-1)?.get('limit')).toBe('20');

    await events.click(
      screen.getByRole('button', { name: /Ir para a página 2/ }),
    );

    await screen.findByText('Atividade 21');
    expect(screen.getByTestId('location')).toHaveTextContent(
      'situacao=pending',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('pagina=2');
    expect(listRequests(fetchMock).at(-1)?.get('offset')).toBe('20');
  });

  it('volta à primeira página ao mudar um filtro, mesmo quando a página 2 ainda existiria', async () => {
    // Todas atrasadas: depois do filtro a lista continua com 3 páginas, então só o reinício
    // explícito da página tira o parâmetro da URL (uma página vazia seria corrigida à parte).
    const many = Array.from({ length: 45 }, (_, index) =>
      makeActivity(index + 1, { overdue: true }),
    );
    const { fetchMock, events } = setup(
      many,
      'student',
      '/aluno/atividades?pagina=2',
    );
    await screen.findByText('Atividade 21');

    await events.click(
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/aluno\/atividades\?atrasadas=1$/,
      ),
    );
    await waitFor(() =>
      expect(listRequests(fetchMock).at(-1)?.get('offset')).toBe('0'),
    );
  });

  it('um aluno logado ignora o parâmetro aluno da URL', async () => {
    const { fetchMock } = setup(
      [makeActivity(1)],
      'student',
      '/aluno/atividades?aluno=999',
    );

    await screen.findByText('Atividade 1');

    expect(listRequests(fetchMock).at(-1)?.has('student_id')).toBe(false);
    expect(
      screen.queryByRole('combobox', { name: 'Aluno' }),
    ).not.toBeInTheDocument();
  });

  it('com filtros sem resultado mostra a mensagem e o botão Limpar filtros, que volta ao padrão', async () => {
    const { events } = setup(
      [makeActivity(1, { title: 'Só esta', status: 'pending' })],
      'teacher',
      '/professor/atividades?situacao=completed&atrasadas=1',
    );

    expect(
      await screen.findByText('Nenhuma atividade encontrada com esses filtros'),
    ).toBeVisible();
    await events.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(await screen.findByText('Só esta')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/atividades$/,
    );
  });
});

describe('ActivitiesPage: carregamento, erro e celular', () => {
  it('mostra o esqueleto enquanto carrega e oferece Tentar novamente quando falha', async () => {
    const server = activitiesServer([makeActivity(1)], { user: 'student' });
    let failing = true;
    // A resposta fica retida até o teste soltá-la: o esqueleto é o estado estável do meio.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = server.routes[LIST]!;
    server.routes[LIST] = async (body, url, params) => {
      await gate;
      if (failing) return { status: 500, body: {} };
      return typeof original === 'function'
        ? original(body, url, params)
        : original;
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(STUDENT_PATH);

    expect(await screen.findByTestId('activities-skeleton')).toBeVisible();
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Atividade 1')).toBeVisible();
  });

  it('no celular o cartão inteiro abre o detalhe', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup(
      [makeActivity(5, { title: 'Capítulo 2', deadline: '2026-12-31' })],
      'student',
    );

    await events.click(await screen.findByText('31/12/2026'));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/atividades/5',
    );
  });

  it('no celular mostra os mesmos cartões, com o selo Atrasada, e nenhuma tabela', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup(
      [
        makeActivity(1, {
          title: 'Capítulo 2',
          overdue: true,
          student: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      'teacher',
    );

    const card = await screen.findByRole('link', { name: /Capítulo 2/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getByText('Atrasada')).toBeVisible();
    expect(within(card).getByText('Maria Lima')).toBeVisible();
    expect(within(card).getByText('Pendente')).toBeVisible();
  });

  it('no desktop também não há tabela: a lista é a mesma lista de cartões', async () => {
    setup([makeActivity(1, { title: 'Capítulo 2' })], 'student');

    await screen.findByRole('link', { name: /Capítulo 2/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Atividades' })).toBeVisible();
  });

  it('a lista segue a ordem do servidor, sem reordenar no cliente', async () => {
    setup(
      [
        makeActivity(1, { title: 'Zebra', deadline: '2026-12-31' }),
        makeActivity(2, { title: 'Abelha', deadline: '2026-01-01' }),
        makeActivity(3, { title: 'Macaco', deadline: '2026-06-01' }),
      ],
      'student',
    );

    const list = await screen.findByRole('list', { name: 'Atividades' });

    const titles = within(list)
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(['Zebra', 'Abelha', 'Macaco']);
  });
});

const SUMMARY = 'GET /api/atividades/resumo';

/** Um cartão de total, achado pelo rótulo: o grupo reúne o rótulo e o número. */
function totalOf(label: string) {
  return screen.getByRole('group', { name: label });
}

const MIXED = [
  makeActivity(1, { status: 'pending' }),
  makeActivity(2, { status: 'pending', overdue: true }),
  makeActivity(3, { status: 'in_progress' }),
  makeActivity(4, { status: 'in_review' }),
  makeActivity(5, { status: 'completed' }),
];

describe('ActivitiesPage: os totais', () => {
  it.each(['student', 'teacher'] as const)(
    'mostra Total Atividades, Total Concluídas e Total Pendentes (%s)',
    async (user) => {
      setup(MIXED, user);

      expect(
        await within(
          await screen.findByRole('group', { name: 'Total Atividades' }),
        ).findByText('5'),
      ).toBeVisible();
      expect(within(totalOf('Total Concluídas')).getByText('1')).toBeVisible();
      // Pendentes é só a situação Pendente: em andamento e em revisão ficam de fora.
      expect(within(totalOf('Total Pendentes')).getByText('2')).toBeVisible();
    },
  );

  it('mostra zero nos três cartões quando não há atividades', async () => {
    setup([], 'student');

    await within(
      await screen.findByRole('group', { name: 'Total Atividades' }),
    ).findByText('0');
    expect(within(totalOf('Total Concluídas')).getByText('0')).toBeVisible();
    expect(within(totalOf('Total Pendentes')).getByText('0')).toBeVisible();
  });

  it('não muda os números ao filtrar por situação, atrasadas ou aluno', async () => {
    const { fetchMock, events } = setup(MIXED, 'student');
    await within(
      await screen.findByRole('group', { name: 'Total Atividades' }),
    ).findByText('5');

    await events.click(screen.getByRole('combobox', { name: 'Situação' }));
    await events.click(
      await screen.findByRole('option', { name: 'Concluída' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Atividades' })).getAllByRole(
          'link',
        ),
      ).toHaveLength(1),
    );
    await events.click(screen.getByRole('switch', { name: /atrasadas/i }));

    expect(within(totalOf('Total Atividades')).getByText('5')).toBeVisible();
    expect(within(totalOf('Total Pendentes')).getByText('2')).toBeVisible();
    for (const [input] of requestsTo(fetchMock, SUMMARY)) {
      expect(new URL(String(input), 'http://localhost').search).toBe('');
    }
  });

  it('uma falha nos totais mostra o aviso com Tentar novamente e deixa a lista de pé', async () => {
    const server = activitiesServer(
      [makeActivity(1, { title: 'Capítulo 2' })],
      { user: 'student' },
    );
    const original = server.routes[SUMMARY]!;
    let failing = true;
    server.routes[SUMMARY] = (body, url, params) =>
      failing
        ? { status: 500, body: {} }
        : typeof original === 'function'
          ? original(body, url, params)
          : original;
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(STUDENT_PATH);

    expect(await screen.findByText('Capítulo 2')).toBeVisible();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ocorreu um erro no servidor');
    failing = false;
    await events.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await within(
        await screen.findByRole('group', { name: 'Total Atividades' }),
      ).findByText('1'),
    ).toBeVisible();
    expect(screen.getByText('Capítulo 2')).toBeVisible();
  });

  it('uma falha na lista não derruba os totais', async () => {
    const server = activitiesServer([makeActivity(1)], {
      user: 'student',
      overrides: { [LIST]: { status: 500, body: {} } },
    });
    mockApi(server.routes);
    renderApp(STUDENT_PATH);

    expect(
      await within(
        await screen.findByRole('group', { name: 'Total Atividades' }),
      ).findByText('1'),
    ).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
  });

  it('mostra o carregamento próprio enquanto os totais chegam', async () => {
    const server = activitiesServer([makeActivity(1)], { user: 'student' });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = server.routes[SUMMARY] as () => { body: unknown };
    server.routes[SUMMARY] = async () => {
      await gate;
      return original();
    };
    mockApi(server.routes);
    renderApp(STUDENT_PATH);

    expect(await screen.findByTestId('totals-skeleton')).toBeVisible();
    expect(await screen.findByText('Atividade 1')).toBeVisible();
    release();
    expect(
      await within(
        await screen.findByRole('group', { name: 'Total Atividades' }),
      ).findByText('1'),
    ).toBeVisible();
    expect(screen.queryByTestId('totals-skeleton')).not.toBeInTheDocument();
  });

  it('no celular os três cartões continuam visíveis', async () => {
    setViewportWidth(PHONE_WIDTH);
    setup(MIXED, 'student');

    await within(
      await screen.findByRole('group', { name: 'Total Atividades' }),
    ).findByText('5');
    expect(totalOf('Total Concluídas')).toBeVisible();
    expect(totalOf('Total Pendentes')).toBeVisible();
  });
});

const ADVISEES_REQUESTS = 'GET /api/orientacao/orientandos';

function adviseeNamed(id: number, name: string) {
  const base = makeAdvisee(id);
  return { ...base, student: { ...base.student, full_name: name } };
}

/** Os orientandos "Orientando 1" a "Orientando N", de 20 em 20 por página como a API. */
function manyAdvisees(total: number) {
  return Array.from({ length: total }, (_, index) =>
    adviseeNamed(index + 1, `Orientando ${String(index + 1).padStart(2, '0')}`),
  );
}

function adviseeRequests(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, ADVISEES_REQUESTS).map(
    ([input]) => new URL(String(input), 'http://localhost').searchParams,
  );
}

/** O jsdom não mede nada: a lista da rolagem recebe as medidas que o teste quer simular. */
function scrollListTo(
  listbox: HTMLElement,
  {
    scrollTop,
    clientHeight = 200,
    scrollHeight = 1000,
  }: { scrollTop: number; clientHeight?: number; scrollHeight?: number },
) {
  Object.defineProperty(listbox, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(listbox, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
  listbox.scrollTop = scrollTop;
  fireEvent.scroll(listbox);
}

describe('ActivitiesPage: a busca por título', () => {
  const ACTIVITIES = [
    makeActivity(1, { title: 'Capítulo 2' }),
    makeActivity(2, { title: 'Resumo' }),
  ];

  it('espera 400 ms de pausa, filtra no servidor sem diferenciar acentos e guarda busca na URL', async () => {
    const { fetchMock, events } = setup(ACTIVITIES, 'student');
    await screen.findByText('Capítulo 2');

    await events.type(
      screen.getByRole('textbox', { name: 'Título da atividade' }),
      'capitulo',
    );

    // Durante a digitação nenhum pedido de busca sai.
    expect(listRequests(fetchMock).some((p) => p.has('search'))).toBe(false);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/atividades?busca=capitulo',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText('Resumo')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Capítulo 2')).toBeVisible();
    expect(listRequests(fetchMock).at(-1)?.get('search')).toBe('capitulo');
  });

  it('volta à primeira página ao mudar a busca e combina com os demais filtros', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeActivity(index + 1, {
        title: `Texto ${String(index + 1).padStart(2, '0')}`,
        status: index % 2 === 0 ? 'pending' : 'completed',
      }),
    );
    const { fetchMock, events } = setup(
      many,
      'student',
      '/aluno/atividades?situacao=pending&pagina=2',
    );
    await screen.findByText('Texto 21');

    await events.type(
      screen.getByRole('textbox', { name: 'Título da atividade' }),
      'texto 0',
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/aluno\/atividades\?situacao=pending&busca=texto\+0$/,
      ),
    );
    const last = listRequests(fetchMock).at(-1)!;
    expect(last.get('status')).toBe('pending');
    expect(last.get('search')).toBe('texto 0');
    expect(last.get('offset')).toBe('0');
  });

  it('restaura a busca da URL no campo e o Limpar filtros a esvazia', async () => {
    const { fetchMock, events } = setup(
      [makeActivity(1, { title: 'Capítulo 2' })],
      'student',
      '/aluno/atividades?busca=zzz',
    );

    expect(
      await screen.findByRole('textbox', { name: 'Título da atividade' }),
    ).toHaveValue('zzz');
    expect(listRequests(fetchMock).at(-1)?.get('search')).toBe('zzz');

    await events.click(
      await screen.findByRole('button', { name: 'Limpar filtros' }),
    );

    expect(await screen.findByText('Capítulo 2')).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Título da atividade' }),
    ).toHaveValue('');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/atividades$/,
    );
  });
});

describe('ActivitiesPage: o filtro por Aluno do professor', () => {
  const ACTIVITIES = [
    makeActivity(1, {
      title: 'Da Maria',
      student: { id: 101, full_name: 'Maria Lima' },
    }),
    makeActivity(2, {
      title: 'Do João',
      student: { id: 102, full_name: 'João Reis' },
    }),
  ];
  const ADVISEES = [
    adviseeNamed(1, 'Maria Lima'),
    adviseeNamed(2, 'João Reis'),
  ];

  it('começa em Todos, filtra ao escolher um aluno, guarda aluno na URL e volta a Todos', async () => {
    const { fetchMock, events } = setup(
      ACTIVITIES,
      'teacher',
      TEACHER_PATH,
      ADVISEES,
    );
    const field = await screen.findByRole('combobox', { name: 'Aluno' });
    expect(field).toHaveValue('Todos');
    await screen.findByText('Do João');

    await events.click(field);
    await events.click(
      await screen.findByRole('option', { name: 'Maria Lima' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/professor/atividades?aluno=101',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText('Do João')).not.toBeInTheDocument(),
    );
    expect(listRequests(fetchMock).at(-1)?.get('student_id')).toBe('101');
    expect(screen.getByRole('combobox', { name: 'Aluno' })).toHaveValue(
      'Maria Lima',
    );

    await events.click(screen.getByRole('combobox', { name: 'Aluno' }));
    await events.click(await screen.findByRole('option', { name: 'Todos' }));

    expect(await screen.findByText('Do João')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/atividades$/,
    );
    expect(screen.getByRole('combobox', { name: 'Aluno' })).toHaveValue(
      'Todos',
    );
  });

  it('não mostra o chip Aluno: ... e o aluno logado não vê o filtro', async () => {
    setup(ACTIVITIES, 'teacher', '/professor/atividades?aluno=101', ADVISEES);
    await screen.findByText('Da Maria');
    expect(screen.queryByText(/^Aluno: /)).not.toBeInTheDocument();
  });

  it('digitar busca no servidor, esconde Todos e mostra só os que casam; reabrir com aluno escolhido mostra todos', async () => {
    const { fetchMock, events } = setup(
      ACTIVITIES,
      'teacher',
      TEACHER_PATH,
      ADVISEES,
    );
    const field = await screen.findByRole('combobox', { name: 'Aluno' });
    await events.click(field);
    expect(await screen.findByRole('option', { name: 'Todos' })).toBeVisible();

    // Como o navegador, que seleciona o texto do campo ao focá-lo: a digitação o substitui.
    (field as HTMLInputElement).select();
    await events.keyboard('joao');

    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: 'Maria Lima' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('option', { name: 'Todos' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'João Reis' }),
    ).toBeVisible();
    expect(adviseeRequests(fetchMock).at(-1)?.get('search')).toBe('joao');

    await events.click(screen.getByRole('option', { name: 'João Reis' }));
    await events.click(screen.getByRole('combobox', { name: 'Aluno' }));

    expect(
      await screen.findByRole('option', { name: 'Maria Lima' }),
    ).toBeVisible();
    expect(screen.getByRole('option', { name: 'João Reis' })).toBeVisible();
    expect(adviseeRequests(fetchMock).at(-1)?.has('search')).toBe(false);
  });

  it('carrega mais orientandos ao rolar perto do fim da lista, com indicador e sem dica de refinar a busca, até acabarem', async () => {
    const { fetchMock, events } = setup(
      [],
      'teacher',
      TEACHER_PATH,
      manyAdvisees(45),
    );
    await events.click(await screen.findByRole('combobox', { name: 'Aluno' }));
    const listbox = await screen.findByRole('listbox');
    await waitFor(() =>
      expect(within(listbox).getAllByRole('option')).toHaveLength(21),
    );
    expect(screen.queryByText(/refine/i)).not.toBeInTheDocument();

    // Longe do fim: nada novo é pedido.
    scrollListTo(listbox, { scrollTop: 0 });
    expect(
      adviseeRequests(fetchMock).filter((p) => p.get('offset') === '20'),
    ).toHaveLength(0);

    scrollListTo(listbox, { scrollTop: 780 });
    await waitFor(() =>
      expect(within(listbox).getAllByRole('option')).toHaveLength(41),
    );
    scrollListTo(listbox, { scrollTop: 780 });
    await waitFor(() =>
      expect(within(listbox).getAllByRole('option')).toHaveLength(46),
    );

    // Acabaram: rolar de novo não pede mais nada.
    const before = adviseeRequests(fetchMock).length;
    scrollListTo(listbox, { scrollTop: 780 });
    expect(adviseeRequests(fetchMock)).toHaveLength(before);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/refine/i)).not.toBeInTheDocument();
  });

  it('mostra o indicador de carregamento no fim da lista enquanto chegam mais nomes', async () => {
    const server = activitiesServer([], {
      user: 'teacher',
      advisees: manyAdvisees(45),
    });
    const original = server.routes[ADVISEES_REQUESTS] as (
      body: unknown,
      url: URL,
    ) => { body: unknown };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.routes[ADVISEES_REQUESTS] = async (body, url) => {
      if (url.searchParams.get('offset') === '20') await gate;
      return original(body, url);
    };
    mockApi(server.routes);
    const events = userEvent.setup();
    renderApp(TEACHER_PATH);
    await events.click(await screen.findByRole('combobox', { name: 'Aluno' }));
    const listbox = await screen.findByRole('listbox');
    await waitFor(() =>
      expect(within(listbox).getAllByRole('option')).toHaveLength(21),
    );

    scrollListTo(listbox, { scrollTop: 780 });

    expect(
      await screen.findByRole('progressbar', {
        name: 'Carregando mais orientandos',
      }),
    ).toBeVisible();
    release();
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(),
    );
  });

  it('também carrega mais ao descer pelo teclado até o fim da lista', async () => {
    const { events } = setup([], 'teacher', TEACHER_PATH, manyAdvisees(45));
    await events.click(await screen.findByRole('combobox', { name: 'Aluno' }));
    const listbox = await screen.findByRole('listbox');
    await waitFor(() =>
      expect(within(listbox).getAllByRole('option')).toHaveLength(21),
    );

    for (let step = 0; step < 19; step += 1) {
      await events.keyboard('{ArrowDown}');
    }

    await waitFor(() =>
      expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(21),
    );
  });

  it('com ?aluno=ID de um orientando fora da primeira leva, mostra o nome certo e a lista já filtrada', async () => {
    const advisees = manyAdvisees(30);
    const { fetchMock } = setup(
      [
        makeActivity(1, {
          title: 'Do vinte e cinco',
          student: { id: 125, full_name: 'Orientando 25' },
        }),
        makeActivity(2, {
          title: 'De outro',
          student: { id: 101, full_name: 'Orientando 01' },
        }),
      ],
      'teacher',
      '/professor/atividades?aluno=125',
      advisees,
    );

    expect(await screen.findByText('Do vinte e cinco')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Aluno' })).toHaveValue(
        'Orientando 25',
      ),
    );
    expect(screen.queryByText('De outro')).not.toBeInTheDocument();
    expect(listRequests(fetchMock).at(-1)?.get('student_id')).toBe('125');
  });

  it.each(['abc', '999'])(
    'com ?aluno=%s inválido ou de quem não é orientando, volta a Todos e tira o parâmetro da URL',
    async (value) => {
      setup(
        ACTIVITIES,
        'teacher',
        `/professor/atividades?aluno=${value}`,
        ADVISEES,
      );

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          /^\/professor\/atividades$/,
        ),
      );
      expect(
        await screen.findByRole('combobox', { name: 'Aluno' }),
      ).toHaveValue('Todos');
      expect(await screen.findByText('Do João')).toBeVisible();
    },
  );
});

describe('ActivitiesPage: o filtro por Situação e o interruptor Somente atrasadas', () => {
  const STATUS_ACTIVITIES = [
    makeActivity(1, { title: 'Aberta', status: 'pending' }),
    makeActivity(2, { title: 'Andando', status: 'in_progress' }),
    makeActivity(3, { title: 'Revisando', status: 'in_review' }),
    makeActivity(4, { title: 'Pronta', status: 'completed' }),
  ];

  it('começa em Todas e lista só as quatro situações, sem Atrasada', async () => {
    const { events } = setup(STATUS_ACTIVITIES, 'student');
    const field = await screen.findByRole('combobox', { name: 'Situação' });
    expect(field).toHaveValue('Todas');

    await events.click(field);

    const names = (await screen.findAllByRole('option')).map(
      (option) => option.textContent,
    );
    expect(names).toEqual([
      'Todas',
      'Pendente',
      'Em andamento',
      'Em revisão',
      'Concluída',
    ]);
  });

  it('busca entre as situações sem diferenciar acentos, esconde Todas ao digitar e mostra tudo ao reabrir com uma escolhida', async () => {
    const { events } = setup(STATUS_ACTIVITIES, 'student');
    const field = await screen.findByRole('combobox', { name: 'Situação' });
    await events.click(field);
    await screen.findAllByRole('option');

    (field as HTMLInputElement).select();
    await events.keyboard('revisao');

    expect(
      await screen.findByRole('option', { name: 'Em revisão' }),
    ).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(
      screen.queryByRole('option', { name: 'Todas' }),
    ).not.toBeInTheDocument();

    await events.click(screen.getByRole('option', { name: 'Em revisão' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/atividades?situacao=in_review',
      ),
    );
    await events.click(screen.getByRole('combobox', { name: 'Situação' }));

    expect(await screen.findAllByRole('option')).toHaveLength(5);
  });

  it('escolher Todas tira a situação da URL', async () => {
    const { fetchMock, events } = setup(
      STATUS_ACTIVITIES,
      'student',
      '/aluno/atividades?situacao=completed',
    );
    await screen.findByText('Pronta');

    await events.click(screen.getByRole('combobox', { name: 'Situação' }));
    await events.click(await screen.findByRole('option', { name: 'Todas' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/aluno\/atividades$/,
      ),
    );
    expect(await screen.findByText('Aberta')).toBeVisible();
    expect(listRequests(fetchMock).at(-1)?.has('status')).toBe(false);
  });

  it('combina busca, aluno, situação e atrasadas, e mudar qualquer filtro volta à primeira página', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeActivity(index + 1, {
        title: `Texto ${String(index + 1).padStart(2, '0')}`,
        status: 'pending',
        overdue: true,
        student: { id: 101, full_name: 'Orientando 01' },
      }),
    );
    const { fetchMock, events } = setup(
      many,
      'teacher',
      '/professor/atividades?busca=texto&aluno=101&situacao=pending&pagina=2',
      [makeAdvisee(1)],
    );
    await screen.findByText('Texto 21');

    await events.click(
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
    );

    await waitFor(() => {
      const last = listRequests(fetchMock).at(-1)!;
      expect(last.get('overdue')).toBe('true');
      expect(last.get('offset')).toBe('0');
    });
    const last = listRequests(fetchMock).at(-1)!;
    expect(last.get('search')).toBe('texto');
    expect(last.get('student_id')).toBe('101');
    expect(last.get('status')).toBe('pending');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/atividades?busca=texto&aluno=101&situacao=pending&atrasadas=1',
    );
  });

  it('o Limpar filtros do estado vazio apaga busca, aluno, situação e atrasadas', async () => {
    const { events } = setup(
      [makeActivity(1, { title: 'Só esta' })],
      'teacher',
      '/professor/atividades?busca=zzz&aluno=101&situacao=completed&atrasadas=1',
      [makeAdvisee(1)],
    );

    await events.click(
      await screen.findByRole('button', { name: 'Limpar filtros' }),
    );

    expect(await screen.findByText('Só esta')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/atividades$/,
    );
    expect(screen.getByRole('combobox', { name: 'Aluno' })).toHaveValue(
      'Todos',
    );
    expect(screen.getByRole('combobox', { name: 'Situação' })).toHaveValue(
      'Todas',
    );
    expect(
      screen.getByRole('textbox', { name: 'Título da atividade' }),
    ).toHaveValue('');
    expect(
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
    ).not.toBeChecked();
  });

  it('segue a ordem do rascunho: título e botão, totais, busca, aluno e situação com o interruptor, e a lista', async () => {
    setup([makeActivity(1)], 'teacher', TEACHER_PATH, [makeAdvisee(1)]);
    await screen.findByText('Atividade 1');

    const sequence = [
      screen.getByRole('heading', { level: 1, name: 'Atividades' }),
      screen.getByRole('button', { name: 'Nova atividade' }),
      screen.getByRole('group', { name: 'Total Atividades' }),
      screen.getByRole('textbox', { name: 'Título da atividade' }),
      screen.getByRole('combobox', { name: 'Aluno' }),
      screen.getByRole('combobox', { name: 'Situação' }),
      screen.getByRole('switch', { name: 'Somente atrasadas' }),
      screen.getByRole('list', { name: 'Atividades' }),
    ];
    for (let index = 1; index < sequence.length; index += 1) {
      expect(
        sequence[index - 1]!.compareDocumentPosition(sequence[index]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('anuncia a mudança da lista pelo número de atividades encontradas', async () => {
    const { events } = setup(STATUS_ACTIVITIES, 'student');
    await screen.findByText('Aberta');
    expect(screen.getByText('4 atividades encontradas')).toBeVisible();

    await events.click(screen.getByRole('combobox', { name: 'Situação' }));
    await events.click(
      await screen.findByRole('option', { name: 'Concluída' }),
    );

    await waitFor(() =>
      expect(screen.getByText('1 atividade encontrada')).toBeVisible(),
    );
  });
});
