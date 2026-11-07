import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import {
  STUDENT_PROFILE,
  studentProfileRoutes,
} from '../test/studentProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PROFILE_URL = 'GET /api/alunos/me/perfil';

describe('StudentProfilePage: carregamento', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('abre em /aluno/perfil com o formulário preenchido com o perfil atual', async () => {
    mockApi(studentProfileRoutes());

    renderApp('/aluno/perfil');

    expect(
      await screen.findByRole('heading', { name: 'Meu perfil' }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Nome completo')).toHaveValue(
      'Ana Souza',
    );
    const areas = screen.getByRole('combobox', { name: 'Áreas de interesse' });
    const chips = within(areas.closest('.MuiAutocomplete-root') as HTMLElement);
    expect(chips.getByText('Inteligência Artificial')).toBeInTheDocument();
    expect(chips.getByText('Engenharia de Software')).toBeInTheDocument();
    expect(chips.queryByText('Banco de Dados')).not.toBeInTheDocument();
    const titles = screen.getAllByLabelText('Título do artigo');
    expect(titles.map((title) => (title as HTMLInputElement).value)).toEqual([
      'Gestão de TCC com Django',
      'Orientação por áreas',
    ]);
    expect(screen.getAllByLabelText('Ano')[0]).toHaveValue(2024);
    expect(screen.getAllByLabelText('Endereço (URL)')[0]).toHaveValue(
      'https://example.com/a',
    );
  });

  it('mostra e-mail, matrícula, instituto e curso como texto, sem campos editáveis', async () => {
    mockApi(studentProfileRoutes());

    renderApp('/aluno/perfil');

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('202100123')).toBeInTheDocument();
    expect(
      await screen.findByText('Instituto de Engenharia e Geociências'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Ciência da Computação'),
    ).toBeInTheDocument();
    for (const label of ['E-mail', 'Matrícula', 'Instituto', 'Curso']) {
      expect(
        screen.queryByRole('textbox', { name: label }),
      ).not.toBeInTheDocument();
    }
  });

  it('mostra um indicador enquanto o perfil carrega', async () => {
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [PROFILE_URL]: () => new Promise(() => undefined),
    });

    renderApp('/aluno/perfil');

    await waitFor(() =>
      expect(requestsTo(fetchMock, PROFILE_URL)).toHaveLength(1),
    );
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument();
  });

  it('mostra o erro de carregamento e carrega de novo ao tentar outra vez', async () => {
    let attempts = 0;
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [PROFILE_URL]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: studentProfileRoutes()[PROFILE_URL]?.body };
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByLabelText('Nome completo')).toHaveValue(
      'Ana Souza',
    );
    expect(requestsTo(fetchMock, PROFILE_URL)).toHaveLength(2);
  });
});

const PATCH_URL = 'PATCH /api/alunos/me/perfil';

function savedProfile(changes: Record<string, unknown>) {
  return { ...STUDENT_PROFILE, ...changes };
}

describe('StudentProfilePage: salvar', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mantém o botão Salvar desabilitado enquanto não há alteração', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();

    await user.type(name, ' Lima');

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('envia só o que mudou, mostra o sucesso, limpa o estado e atualiza o nome do cabeçalho', async () => {
    let currentName = 'Ana Souza';
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      'GET /api/auth/me': () => ({
        body: {
          id: 7,
          full_name: currentName,
          email: 'ana@example.com',
          type: 'student',
          has_active_advising: false,
        },
      }),
      [PATCH_URL]: (body) => {
        currentName = (body as { full_name: string }).full_name;
        return { body: savedProfile({ full_name: currentName }) };
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');

    await user.clear(name);
    await user.type(name, '  Ana Souza Lima  ');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Perfil atualizado com sucesso.'),
    ).toBeVisible();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(1);
    expect(
      JSON.parse(String(requestsTo(fetchMock, PATCH_URL)[0]?.[1]?.body)),
    ).toEqual({ full_name: 'Ana Souza Lima' });
    expect(screen.getByLabelText('Nome completo')).toHaveValue(
      'Ana Souza Lima',
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await waitFor(() =>
      expect(
        screen.getByText('Ana Souza Lima', { selector: 'span' }),
      ).toBeInTheDocument(),
    );
  });
});

function patchBody(fetchMock: ReturnType<typeof mockApi>) {
  return JSON.parse(String(requestsTo(fetchMock, PATCH_URL)[0]?.[1]?.body));
}

function areasRoot() {
  return screen
    .getByRole('combobox', { name: 'Áreas de interesse' })
    .closest('.MuiAutocomplete-root') as HTMLElement;
}

describe('StudentProfilePage: áreas de interesse e validação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('permite escolher mais de uma área e envia a lista completa', async () => {
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => ({ body: savedProfile({ area_ids: [1, 3, 2] }) }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    await user.click(
      screen.getByRole('combobox', { name: 'Áreas de interesse' }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'Banco de Dados' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({ area_ids: [1, 3, 2] });
  });

  it('permite remover uma área e envia a lista que sobrou', async () => {
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => ({ body: savedProfile({ area_ids: [3] }) }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');
    const chip = within(areasRoot())
      .getByText('Inteligência Artificial')
      .closest('.MuiChip-root') as HTMLElement;

    await user.click(within(chip).getByTestId('CancelIcon'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({ area_ids: [3] });
  });

  it('mostra o erro no campo de áreas e não envia nada quando a lista fica vazia (RN22)', async () => {
    const fetchMock = mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    for (const name of ['Inteligência Artificial', 'Engenharia de Software']) {
      const chip = within(areasRoot())
        .getByText(name)
        .closest('.MuiChip-root') as HTMLElement;
      await user.click(within(chip).getByTestId('CancelIcon'));
    }
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Escolha ao menos uma área de interesse.'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
  });

  it('exige o nome e respeita o limite de 150 caracteres', async () => {
    const fetchMock = mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');

    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText('Informe o nome completo.'),
    ).toBeInTheDocument();

    await user.type(name, 'a'.repeat(151));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText('O nome deve ter no máximo 150 caracteres.'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
  });
});

const MANY = Array.from({ length: 50 }, (_, index) => ({
  title: `Artigo ${index + 1}`,
  year: 2020,
  url: '',
}));

describe('StudentProfilePage: artigos publicados', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('adiciona um artigo e envia a lista completa, com os artigos que já existiam', async () => {
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => ({ body: STUDENT_PROFILE }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    await user.click(screen.getByRole('button', { name: 'Adicionar artigo' }));
    const titles = screen.getAllByLabelText('Título do artigo');
    expect(titles).toHaveLength(3);
    await user.type(titles[2]!, '  Novo artigo  ');
    await user.type(screen.getAllByLabelText('Ano')[2]!, '2022');
    await user.type(
      screen.getAllByLabelText('Endereço (URL)')[2]!,
      'https://example.com/novo',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({
      articles: [
        ...STUDENT_PROFILE.articles,
        { title: 'Novo artigo', year: 2022, url: 'https://example.com/novo' },
      ],
    });
  });

  it('pede confirmação ao remover e só tira a linha quando a pessoa confirma', async () => {
    const fetchMock = mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => ({
        body: savedProfile({ articles: [STUDENT_PROFILE.articles[1]] }),
      }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    await user.click(screen.getByRole('button', { name: 'Remover artigo 1' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Gestão de TCC com Django');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getAllByLabelText('Título do artigo')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remover artigo 1' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Remover',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getAllByLabelText('Título do artigo')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({
      articles: [STUDENT_PROFILE.articles[1]],
    });
  });

  it('não deixa passar de 50 artigos', async () => {
    mockApi(studentProfileRoutes(savedProfile({ articles: MANY })));
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    // Consultas de texto: com 150 campos na tela, as por papel e por rótulo são lentas no jsdom.
    expect(screen.getAllByText(/^Remover artigo \d+$/)).toHaveLength(50);
    expect(
      screen.getByText('Adicionar artigo').closest('button'),
    ).toBeDisabled();
    expect(
      screen.getByText('Você chegou ao limite de 50 artigos.'),
    ).toBeInTheDocument();
  }, 20000);

  it('valida cada artigo no cliente, com o erro no campo certo', async () => {
    const fetchMock = mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');
    await user.click(screen.getByRole('button', { name: 'Adicionar artigo' }));
    const nextYear = new Date().getFullYear() + 1;
    await user.type(screen.getAllByLabelText('Ano')[2]!, '1899');
    await user.type(
      screen.getAllByLabelText('Endereço (URL)')[2]!,
      'ftp://exemplo.com',
    );
    await user.clear(screen.getAllByLabelText('Ano')[1]!);
    await user.type(screen.getAllByLabelText('Ano')[1]!, String(nextYear));

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Informe o título do artigo.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        `Informe um ano entre 1900 e ${new Date().getFullYear()}.`,
      ),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        'Informe um endereço http ou https de até 500 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
  });
});

describe('StudentProfilePage: falhas ao salvar', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mostra todos os erros 422 do servidor, cada um no seu campo, e mantém os dados digitados', async () => {
    mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'full_name'],
              msg: 'O nome é obrigatório.',
              type: 'value_error',
            },
            {
              loc: ['body', 'payload', 'area_ids'],
              msg: 'Mantenha ao menos uma área de interesse.',
              type: 'value_error',
            },
            {
              loc: ['body', 'payload', 'articles'],
              msg: 'Há dois artigos com o mesmo título e ano.',
              type: 'value_error',
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');
    await user.type(name, ' Lima');

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('O nome é obrigatório.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Mantenha ao menos uma área de interesse.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Há dois artigos com o mesmo título e ano.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome completo')).toHaveValue(
      'Ana Souza Lima',
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    expect(
      screen.queryByText('Perfil atualizado com sucesso.'),
    ).not.toBeInTheDocument();
  });

  it('mostra o erro do servidor e mantém o formulário quando a falha não é de campo', async () => {
    mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: { status: 500, body: {} },
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText(/Ocorreu um erro no servidor/),
    ).toBeVisible();
    expect(screen.getByLabelText('Nome completo')).toHaveValue(
      'Ana Souza Lima',
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('avisa quando o servidor não responde e mantém o que foi digitado', async () => {
    mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => {
        throw new TypeError('network down');
      },
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText(/Não foi possível conectar ao servidor/),
    ).toBeVisible();
    expect(screen.getByLabelText('Nome completo')).toHaveValue(
      'Ana Souza Lima',
    );
  });
});

const NOTICE =
  'Você tem alterações não salvas. Clique em Salvar para gravá-las.';

describe('StudentProfilePage: alterações não salvas (RNF28)', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mostra no topo o aviso de alterações pendentes e o tira depois de salvar', async () => {
    mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => ({
        body: savedProfile({ full_name: 'Ana Souza Lima' }),
      }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    await user.type(name, ' Lima');
    expect(screen.getByText(NOTICE).closest('[role="status"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('pede confirmação ao sair pelo menu com alterações pendentes e fica na tela se a pessoa continuar editando', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');

    await user.click(screen.getByRole('link', { name: 'Minha solicitação' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Descartar alterações?');
    expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil');
    await user.click(
      within(dialog).getByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil');
    expect(screen.getByLabelText('Nome completo')).toHaveValue(
      'Ana Souza Lima',
    );
  });

  it('sai da tela e descarta as alterações quando a pessoa confirma', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');
    await user.click(screen.getByRole('link', { name: 'Minha solicitação' }));

    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Sair sem salvar',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Minha solicitação' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/aluno/solicitacao',
    );
  });

  it('não pergunta nada ao sair sem alterações nem depois de salvar', async () => {
    mockApi({
      ...studentProfileRoutes(),
      [PATCH_URL]: () => ({
        body: savedProfile({ full_name: 'Ana Souza Lima' }),
      }),
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');
    await user.click(screen.getByRole('link', { name: 'Minha solicitação' }));
    expect(
      await screen.findByRole('heading', { name: 'Minha solicitação' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Meu perfil' }));
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Perfil atualizado com sucesso.');
    await user.click(screen.getByRole('link', { name: 'Orientadores' }));

    expect(
      await screen.findByRole('heading', { name: 'Orientadores' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('também pergunta ao usar o botão Voltar do navegador', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    const { router } = renderApp('/aluno/perfil', {
      entries: ['/aluno/orientadores', '/aluno/perfil'],
    });
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');

    await act(async () => {
      await router.navigate(-1);
    });

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Descartar alterações?',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil');
  });

  it('avisa o navegador ao fechar ou recarregar a aba só quando há alterações pendentes', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(name, ' Lima');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);

    expect(dirty.defaultPrevented).toBe(true);
  });

  it('não prende a pessoa na tela quando ela sai da conta com alterações pendentes', async () => {
    mockApi({
      ...studentProfileRoutes(),
      'POST /api/auth/logout': { status: 204 },
    });
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
  });
});

describe('StudentProfilePage: celular e acessibilidade', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('funciona em tela pequena: edita, e sair pelo menu recolhível também pede confirmação', async () => {
    setViewportWidth(PHONE_WIDTH);
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.click(
      await screen.findByRole('link', { name: 'Minha solicitação' }),
    );

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Descartar alterações?',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil');
  });

  it('leva o foco ao primeiro campo com erro e o marca como inválido, com o erro ligado ao campo', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');
    await user.clear(name);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const message = await screen.findByText('Informe o nome completo.');
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Informe o nome completo.');
    expect(message).toBeVisible();
  });
});

describe('StudentProfilePage: falhas do catálogo e mudanças sem efeito', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('não deixa Instituto e Curso em "Carregando…" para sempre quando o catálogo falha', async () => {
    mockApi({
      ...studentProfileRoutes(),
      'GET /api/institutos': { status: 500, body: {} },
      'GET /api/cursos': { status: 500, body: {} },
    });

    renderApp('/aluno/perfil');

    await screen.findByLabelText('Nome completo');
    await waitFor(() =>
      expect(screen.queryByText('Carregando…')).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText('Não foi possível carregar.')).toHaveLength(2);
  });

  it('não envia nada quando as áreas voltam a ser as mesmas, só em outra ordem', async () => {
    const fetchMock = mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');
    const chip = within(areasRoot())
      .getByText('Inteligência Artificial')
      .closest('.MuiChip-root') as HTMLElement;
    await user.click(within(chip).getByTestId('CancelIcon'));
    await user.click(
      screen.getByRole('combobox', { name: 'Áreas de interesse' }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'Inteligência Artificial' }),
    );

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Nenhuma alteração para salvar.'),
    ).toBeVisible();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('não envia o artigo que só mudou nos espaços das pontas', async () => {
    const fetchMock = mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    const titles = await screen.findAllByLabelText('Título do artigo');
    await user.type(titles[0]!, '   ');

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Nenhuma alteração para salvar.'),
    ).toBeVisible();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
  });
});

describe('StudentProfilePage: acessibilidade do aviso e dos diálogos', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('mantém sempre montada a região do aviso, para o leitor de tela anunciá-lo quando ele aparece', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    const { container } = renderApp('/aluno/perfil');
    const name = await screen.findByLabelText('Nome completo');
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region).toBeEmptyDOMElement();

    await user.type(name, ' Lima');

    expect(container.querySelector('[aria-live="polite"]')).toBe(region);
    expect(region).toHaveTextContent(NOTICE);
  });

  it('dá ao diálogo de remoção um nome e uma descrição acessíveis, sem ids repetidos', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    renderApp('/aluno/perfil');
    await screen.findByLabelText('Nome completo');

    await user.click(screen.getByRole('button', { name: 'Remover artigo 1' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Remover artigo?');
    expect(dialog).toHaveAccessibleDescription(/Gestão de TCC com Django/);
  });

  it('também guarda a navegação que só muda a query da mesma tela', async () => {
    mockApi(studentProfileRoutes());
    const user = userEvent.setup();
    const { router } = renderApp('/aluno/perfil');
    await user.type(await screen.findByLabelText('Nome completo'), ' Lima');

    await act(async () => {
      await router.navigate('/aluno/perfil?aba=2');
    });

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Descartar alterações?',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/aluno/perfil');
  });
});
