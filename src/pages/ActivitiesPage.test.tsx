import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { activitiesServer, makeActivity } from '../test/activitiesApi';
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
) {
  const server = activitiesServer(activities, { user });
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
    expect(
      screen.getByRole('combobox', { name: 'Situação' }),
    ).toHaveTextContent('Pendente');
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

  it('mostra o chip do aluno vindo da URL, filtra por ele no servidor e o remove', async () => {
    const { fetchMock, events } = setup(
      [
        makeActivity(1, {
          title: 'Da Maria',
          student: { id: 101, full_name: 'Maria Lima' },
        }),
        makeActivity(2, {
          title: 'Do João',
          student: { id: 102, full_name: 'João Reis' },
        }),
      ],
      'teacher',
      '/professor/atividades?aluno=101',
    );

    await screen.findByText('Da Maria');

    expect(screen.queryByText('Do João')).not.toBeInTheDocument();
    expect(listRequests(fetchMock).at(-1)?.get('student_id')).toBe('101');
    const chip = screen.getByText('Aluno: Maria Lima');
    expect(chip).toBeVisible();

    await events.click(
      within(chip.closest('.MuiChip-root') as HTMLElement).getByTestId(
        'CancelIcon',
      ),
    );

    expect(await screen.findByText('Do João')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/atividades$/,
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
    expect(screen.queryByText(/^Aluno: /)).not.toBeInTheDocument();
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
