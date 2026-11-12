import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { teacherProfileRoutes } from '../test/teacherProfileApi';
import { makeProposal, proposalsServer } from '../test/thesisProposalsApi';
import type { FakeProposal } from '../test/thesisProposalsApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/professores/me/propostas';
const PATCH_PROFILE = 'PATCH /api/professores/me/perfil';

function proposals(count: number): FakeProposal[] {
  return Array.from({ length: count }, (_, index) => makeProposal(index + 1));
}

function setup(
  initial: FakeProposal[],
  { path = '/professor/perfil', overrides = {} as Record<string, never> } = {},
) {
  const server = proposalsServer(initial);
  const fetchMock = mockApi({
    ...teacherProfileRoutes(),
    ...server.routes,
    ...overrides,
  });
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

const section = () =>
  screen.findByRole('region', { name: 'Propostas de tema' });

function pagesRequested(fetchMock: ReturnType<typeof mockApi>) {
  return requestsTo(fetchMock, LIST).map(([input]) => {
    const params = new URL(String(input), 'http://localhost').searchParams;
    return { limit: params.get('limit'), offset: params.get('offset') };
  });
}

async function openAdd(events: ReturnType<typeof userEvent.setup>) {
  const area = await section();
  await events.click(
    within(area).getByRole('button', { name: 'Adicionar proposta' }),
  );
  return screen.findByRole('dialog', { name: 'Adicionar proposta de tema' });
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Propostas de tema: a seção do perfil do professor', () => {
  it('sem propostas mostra o estado vazio que convida a cadastrar a primeira', async () => {
    const { events } = setup([]);
    const area = await section();

    expect(
      await within(area).findByText(/ainda não cadastrou propostas de tema/),
    ).toBeVisible();
    await events.click(
      within(area).getByRole('button', { name: 'Cadastrar a primeira' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar proposta de tema' }),
    ).toBeVisible();
  });

  it('com 1 a 5 propostas mostra uma lista na ordem do servidor, sem navegação de páginas', async () => {
    setup(proposals(5));
    const area = await section();

    const list = await within(area).findByRole('list', {
      name: 'Propostas de tema',
    });

    const titles = within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(titles[0]).toContain('número 05');
    expect(titles[4]).toContain('número 01');
    expect(within(area).queryByRole('table')).not.toBeInTheDocument();
    expect(
      within(area).queryByRole('navigation', { name: /Paginação/ }),
    ).not.toBeInTheDocument();
  });

  it('com 6 ou mais mostra uma tabela paginada de 5 em 5, e a página fica na URL', async () => {
    const { fetchMock, events } = setup(proposals(12));
    const area = await section();
    const table = await within(area).findByRole('table', {
      name: 'Propostas de tema',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByText(/número 12/)).toBeVisible();
    expect(pagesRequested(fetchMock)).toEqual([{ limit: '5', offset: '0' }]);

    await events.click(
      within(area).getByRole('button', { name: 'Ir para a página 2' }),
    );

    expect(await within(area).findByText(/número 07/)).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('pagina=2');
    expect(pagesRequested(fetchMock).at(-1)).toEqual({
      limit: '5',
      offset: '5',
    });
  });

  it('abrir direto na página da URL reabre a mesma página', async () => {
    setup(proposals(12), { path: '/professor/perfil?pagina=3' });
    const area = await section();

    expect(await within(area).findByText(/número 02/)).toBeVisible();
    expect(within(area).getByText(/número 01/)).toBeVisible();
  });

  it('uma página inexistente volta para a última válida, sem mostrar vazio falso', async () => {
    setup(proposals(12), { path: '/professor/perfil?pagina=9' });
    const area = await section();

    expect(await within(area).findByText(/número 01/)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('pagina=3'),
    );
    expect(
      within(area).queryByText(/ainda não cadastrou/),
    ).not.toBeInTheDocument();
  });

  it('o formulário principal do perfil não inclui as propostas e o PATCH não as envia', async () => {
    const { fetchMock, events } = setup(proposals(2));
    const name = await screen.findByLabelText('Nome completo');
    await section();
    await events.clear(name);
    await events.type(name, 'Carlos Lima Filho');
    await events.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, PATCH_PROFILE)).toHaveLength(1),
    );
    const body = JSON.parse(
      String(requestsTo(fetchMock, PATCH_PROFILE)[0]![1]?.body),
    );
    expect(body).toEqual({ full_name: 'Carlos Lima Filho' });
    expect(
      screen.getByRole('region', { name: 'Propostas de tema' }).closest('form'),
    ).toBeNull();
  });

  it('mostra o erro com nova tentativa quando a leitura falha', async () => {
    const { events } = setup([], {
      overrides: { [LIST]: { status: 500, body: {} } } as never,
    });
    const area = await section();

    expect(await within(area).findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    expect(
      within(area).getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible();
    void events;
  });
});

describe('Propostas de tema: com o formulário do perfil alterado', () => {
  it('trocar de página das propostas não abre o aviso de descarte do perfil e não perde a edição', async () => {
    const { events } = setup(proposals(12));
    const name = await screen.findByLabelText('Nome completo');
    const area = await section();
    await within(area).findByRole('table', { name: 'Propostas de tema' });
    await events.clear(name);
    await events.type(name, 'Carlos Lima Filho');

    await events.click(
      within(area).getByRole('button', { name: 'Ir para a página 2' }),
    );

    expect(await within(area).findByText(/número 07/)).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('pagina=2');
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
    expect(name).toHaveValue('Carlos Lima Filho');
  });

  it('remover o último item da última página, com o perfil alterado, volta à página válida sem o aviso', async () => {
    const { events } = setup(proposals(11), {
      path: '/professor/perfil?pagina=3',
    });
    const name = await screen.findByLabelText('Nome completo');
    const area = await section();
    await events.type(name, ' Jr');
    await events.click(
      await within(area).findByRole('button', {
        name: 'Remover a proposta "Proposta de tema número 01"',
      }),
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Remover proposta de tema',
    });

    await events.click(
      within(confirm).getByRole('button', { name: 'Remover proposta' }),
    );

    await screen.findByText('Proposta removida.');
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('pagina=2'),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
    ).not.toBeInTheDocument();
    expect(name).toHaveValue('Carlos Lima Jr');
  });

  it('uma página inexistente na URL não mostra tabela vazia enquanto volta para a última', async () => {
    setup(proposals(8), { path: '/professor/perfil?pagina=9' });
    const area = await section();

    expect(await within(area).findByText(/número 03/)).toBeVisible();
    expect(
      within(area).queryByText(/ainda não cadastrou/),
    ).not.toBeInTheDocument();
  });
});

describe('Propostas de tema: falha ao trocar de página', () => {
  it('depois de uma falha na leitura, a tabela antiga e as suas ações saem da tela', async () => {
    const server = proposalsServer(proposals(12));
    const original = server.routes[LIST]!;
    let reads = 0;
    mockApi({
      ...teacherProfileRoutes(),
      ...server.routes,
      [LIST]: async (body, url, params) => {
        reads += 1;
        if (reads > 1) return { status: 500, body: {} };
        return typeof original === 'function'
          ? original(body, url, params)
          : original;
      },
    });
    const events = userEvent.setup();
    renderApp('/professor/perfil');
    const area = await section();
    await within(area).findByRole('table', { name: 'Propostas de tema' });

    await events.click(
      within(area).getByRole('button', { name: 'Ir para a página 2' }),
    );

    expect(await within(area).findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    expect(within(area).queryByRole('table')).not.toBeInTheDocument();
    expect(
      within(area).queryByRole('button', { name: /^Remover a proposta/ }),
    ).not.toBeInTheDocument();
  });
});

describe('Propostas de tema: adicionar e editar', () => {
  it('adiciona uma proposta, avisa, fecha o diálogo e ela aparece em primeiro', async () => {
    const { fetchMock, events } = setup(proposals(2));
    const dialog = await openAdd(events);

    await events.type(
      within(dialog).getByLabelText(/Título da proposta/),
      '  Ensino de programação com jogos  ',
    );
    expect(within(dialog).getByText('31/150')).toBeVisible();
    await events.click(
      within(dialog).getByRole('button', { name: 'Adicionar' }),
    );

    expect(await screen.findByText('Proposta cadastrada.')).toBeVisible();
    const post = requestsTo(fetchMock, 'POST /api/professores/me/propostas');
    expect(JSON.parse(String(post[0]![1]?.body))).toEqual({
      title: 'Ensino de programação com jogos',
    });
    const area = await section();
    const items = await within(area).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ensino de programação com jogos');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('valida o título de 5 a 150 caracteres antes de enviar', async () => {
    const { fetchMock, events } = setup([]);
    const dialog = await openAdd(events);
    const field = within(dialog).getByLabelText(/Título da proposta/);
    const submit = within(dialog).getByRole('button', { name: 'Adicionar' });

    await events.type(field, 'abc');
    await events.tab();
    expect(
      await within(dialog).findByText(
        'O título deve ter pelo menos 5 caracteres.',
      ),
    ).toBeVisible();
    expect(submit).toBeDisabled();

    await events.clear(field);
    await events.click(field);
    await events.paste('a'.repeat(151));
    expect(
      await within(dialog).findByText(
        'O título deve ter no máximo 150 caracteres.',
      ),
    ).toBeVisible();
    expect(submit).toBeDisabled();

    await events.clear(field);
    await events.click(field);
    await events.paste(`  ${'a'.repeat(150)}  `);
    await waitFor(() => expect(submit).toBeEnabled());
    expect(
      requestsTo(fetchMock, 'POST /api/professores/me/propostas'),
    ).toHaveLength(0);
  });

  it('mostra o erro do servidor de título repetido junto do campo, em português', async () => {
    const { events } = setup([makeProposal(1, 'Gestão de TCC com Django')]);
    const dialog = await openAdd(events);

    await events.type(
      within(dialog).getByLabelText(/Título da proposta/),
      'GESTÃO de tcc com django',
    );
    await events.click(
      within(dialog).getByRole('button', { name: 'Adicionar' }),
    );

    expect(
      await within(dialog).findByText(
        'Você já tem uma proposta com esse título.',
      ),
    ).toBeVisible();
    expect(within(dialog).getByLabelText(/Título da proposta/)).toBeInvalid();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('a 51ª proposta mostra a mensagem do servidor no diálogo', async () => {
    const { events } = setup(proposals(50));
    const dialog = await openAdd(events);

    await events.type(
      within(dialog).getByLabelText(/Título da proposta/),
      'Mais uma proposta de tema',
    );
    await events.click(
      within(dialog).getByRole('button', { name: 'Adicionar' }),
    );

    expect(
      await within(dialog).findByText(/Você já tem 50 propostas de tema/),
    ).toBeVisible();
  });

  it('edita o título com os valores atuais já preenchidos', async () => {
    const { fetchMock, events } = setup([
      makeProposal(1, 'Título antes da edição'),
    ]);
    const area = await section();
    await events.click(
      await within(area).findByRole('button', {
        name: 'Editar a proposta "Título antes da edição"',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar proposta de tema',
    });
    const field = within(dialog).getByLabelText(/Título da proposta/);
    expect(field).toHaveValue('Título antes da edição');
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toBeDisabled();

    await events.clear(field);
    await events.type(field, 'Título depois da edição');
    await events.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Proposta atualizada.')).toBeVisible();
    const patch = requestsTo(
      fetchMock,
      'PATCH /api/professores/me/propostas/1',
    );
    expect(JSON.parse(String(patch[0]![1]?.body))).toEqual({
      title: 'Título depois da edição',
    });
    expect(
      await within(area).findByText('Título depois da edição'),
    ).toBeVisible();
  });

  it('fechar com alterações não salvas avisa antes de descartar (RNF28)', async () => {
    const { events } = setup([]);
    const dialog = await openAdd(events);
    await events.type(
      within(dialog).getByLabelText(/Título da proposta/),
      'Rascunho de proposta',
    );
    expect(
      await within(dialog).findByText(/Você tem alterações não salvas/),
    ).toBeVisible();

    await events.click(within(dialog).getByRole('button', { name: 'Voltar' }));

    const discard = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    await events.click(
      within(discard).getByRole('button', { name: 'Sair sem salvar' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('o título é de uma linha só e Enter envia o formulário', async () => {
    const { fetchMock, events } = setup([]);
    const dialog = await openAdd(events);
    const field = within(dialog).getByLabelText(/Título da proposta/);

    await events.type(field, 'Título de uma linha só{Enter}');

    expect(await screen.findByText('Proposta cadastrada.')).toBeVisible();
    const post = requestsTo(fetchMock, 'POST /api/professores/me/propostas');
    expect(JSON.parse(String(post[0]![1]?.body))).toEqual({
      title: 'Título de uma linha só',
    });
  });

  it('o botão fica ocupado durante o envio e a proposta sai uma vez só', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const server = proposalsServer([]);
    const original = server.routes['POST /api/professores/me/propostas']!;
    const fetchMock = mockApi({
      ...teacherProfileRoutes(),
      ...server.routes,
      'POST /api/professores/me/propostas': async (body, url, params) => {
        await gate;
        return typeof original === 'function'
          ? original(body, url, params)
          : original;
      },
    });
    const events = userEvent.setup();
    renderApp('/professor/perfil');
    const dialog = await openAdd(events);
    await events.type(
      within(dialog).getByLabelText(/Título da proposta/),
      'Proposta enviada uma vez',
    );

    await events.click(
      within(dialog).getByRole('button', { name: 'Adicionar' }),
    );

    const busy = await within(dialog).findByRole('button', {
      name: 'Salvando…',
    });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    release();
    await screen.findByText('Proposta cadastrada.');
    expect(
      requestsTo(fetchMock, 'POST /api/professores/me/propostas'),
    ).toHaveLength(1);
  });

  it('ao cruzar o limite de 5 a exibição passa de lista para tabela', async () => {
    const { events } = setup(proposals(5));
    const area = await section();
    await within(area).findByRole('list', { name: 'Propostas de tema' });
    const dialog = await openAdd(events);
    await events.type(
      within(dialog).getByLabelText(/Título da proposta/),
      'Sexta proposta de tema',
    );

    await events.click(
      within(dialog).getByRole('button', { name: 'Adicionar' }),
    );

    expect(
      await within(area).findByRole('table', { name: 'Propostas de tema' }),
    ).toBeVisible();
    expect(
      within(area).queryByRole('list', { name: 'Propostas de tema' }),
    ).not.toBeInTheDocument();
  });
});

describe('Propostas de tema: remover', () => {
  it('pede confirmação explícita, que diz que a remoção é definitiva, e só remove ao confirmar', async () => {
    const { fetchMock, events } = setup(proposals(2));
    const area = await section();
    await events.click(
      await within(area).findByRole('button', {
        name: 'Remover a proposta "Proposta de tema número 02"',
      }),
    );

    const confirm = await screen.findByRole('dialog', {
      name: 'Remover proposta de tema',
    });
    expect(confirm).toHaveAccessibleDescription(
      /definitiva e não pode ser desfeita/,
    );
    expect(
      requestsTo(fetchMock, 'DELETE /api/professores/me/propostas/2'),
    ).toHaveLength(0);

    await events.click(within(confirm).getByRole('button', { name: 'Voltar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      requestsTo(fetchMock, 'DELETE /api/professores/me/propostas/2'),
    ).toHaveLength(0);
  });

  it('ao confirmar remove, avisa e atualiza a lista', async () => {
    const { fetchMock, events } = setup(proposals(2));
    const area = await section();
    await events.click(
      await within(area).findByRole('button', {
        name: 'Remover a proposta "Proposta de tema número 02"',
      }),
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Remover proposta de tema',
    });

    await events.click(
      within(confirm).getByRole('button', { name: 'Remover proposta' }),
    );

    expect(await screen.findByText('Proposta removida.')).toBeVisible();
    expect(
      requestsTo(fetchMock, 'DELETE /api/professores/me/propostas/2'),
    ).toHaveLength(1);
    await waitFor(() =>
      expect(within(area).queryByText(/número 02/)).not.toBeInTheDocument(),
    );
    expect(within(area).getByText(/número 01/)).toBeVisible();
  });

  it('remover o último item da última página volta para a última página válida', async () => {
    const { events } = setup(proposals(6), {
      path: '/professor/perfil?pagina=2',
    });
    const area = await section();
    await events.click(
      await within(area).findByRole('button', {
        name: 'Remover a proposta "Proposta de tema número 01"',
      }),
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Remover proposta de tema',
    });

    await events.click(
      within(confirm).getByRole('button', { name: 'Remover proposta' }),
    );

    await screen.findByText('Proposta removida.');
    // Sobram 5: a exibição vira lista, e a tela não mostra uma página vazia.
    expect(
      await within(area).findByRole('list', { name: 'Propostas de tema' }),
    ).toBeVisible();
    expect(within(area).getByText(/número 06/)).toBeVisible();
    expect(
      within(area).queryByText(/ainda não cadastrou/),
    ).not.toBeInTheDocument();
  });

  it('removendo a última proposta aparece o estado vazio', async () => {
    const { events } = setup(proposals(1));
    const area = await section();
    await events.click(
      await within(area).findByRole('button', {
        name: 'Remover a proposta "Proposta de tema número 01"',
      }),
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Remover proposta de tema',
    });

    await events.click(
      within(confirm).getByRole('button', { name: 'Remover proposta' }),
    );

    expect(
      await within(area).findByText(/ainda não cadastrou propostas de tema/),
    ).toBeVisible();
  });

  it('uma falha do servidor mostra a mensagem e recarrega a lista', async () => {
    const server = proposalsServer(proposals(2));
    const fetchMock = mockApi({
      ...teacherProfileRoutes(),
      ...server.routes,
      'DELETE /api/professores/me/propostas/:id': {
        status: 404,
        body: { detail: 'Proposta de tema não encontrada.' },
      },
    });
    const events = userEvent.setup();
    renderApp('/professor/perfil');
    const area = await section();
    await events.click(
      await within(area).findByRole('button', {
        name: 'Remover a proposta "Proposta de tema número 02"',
      }),
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Remover proposta de tema',
    });
    const reads = requestsTo(fetchMock, LIST).length;

    await events.click(
      within(confirm).getByRole('button', { name: 'Remover proposta' }),
    );

    expect(
      await screen.findByText('Proposta de tema não encontrada.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(reads),
    );
  });
});

describe('Propostas de tema: tela pequena', () => {
  it('funciona em tela pequena, com a lista e o diálogo', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { events } = setup(proposals(3));
    const area = await section();

    expect(
      await within(area).findByRole('list', { name: 'Propostas de tema' }),
    ).toBeVisible();
    await events.click(
      within(area).getByRole('button', { name: 'Adicionar proposta' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar proposta de tema' }),
    ).toBeVisible();
  });
});
