import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import {
  INSTITUTE_COURSES,
  TEACHER_PROFILE,
  teacherProfileRoutes,
} from '../test/teacherProfileApi';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const PROFILE_URL = 'GET /api/professores/me/perfil';
const PATCH_URL = 'PATCH /api/professores/me/perfil';
const NOTICE =
  'Você tem alterações não salvas. Clique em Salvar para gravá-las.';

function savedProfile(changes: Record<string, unknown>) {
  return { ...TEACHER_PROFILE, ...changes };
}

function patchBody(fetchMock: ReturnType<typeof mockApi>) {
  return JSON.parse(String(requestsTo(fetchMock, PATCH_URL)[0]?.[1]?.body));
}

/** O formulário está pronto quando o nome aparece e a lista de cursos terminou de carregar. */
async function formReady() {
  const name = await screen.findByLabelText('Nome completo');
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Cursos' })).toBeEnabled(),
  );
  return name;
}

function field(label: string) {
  return screen
    .getByRole('combobox', { name: label })
    .closest('.MuiAutocomplete-root') as HTMLElement;
}

describe('TeacherProfilePage: carregamento', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('abre em /professor/perfil com o formulário preenchido, inclusive cursos e disponibilidade', async () => {
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');

    expect(
      await screen.findByRole('heading', { name: 'Meu perfil' }),
    ).toBeInTheDocument();
    expect(await formReady()).toHaveValue('Carlos Lima');
    expect(
      within(field('Cursos')).getByText('Ciência da Computação'),
    ).toBeInTheDocument();
    expect(
      within(field('Cursos')).queryByText('Engenharia da Computação'),
    ).not.toBeInTheDocument();
    expect(
      within(field('Áreas de interesse')).getByText('Inteligência Artificial'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Título do artigo')).toHaveValue(
      'Orientação por áreas',
    );
    expect(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    ).toBeChecked();
  });

  it('mostra e-mail, matrícula e instituto como texto, sem campos editáveis', async () => {
    mockApi(teacherProfileRoutes());

    renderApp('/professor/perfil');

    expect(await screen.findByText('carlos@example.com')).toBeInTheDocument();
    expect(screen.getByText('P0001')).toBeInTheDocument();
    expect(
      await screen.findByText('Instituto de Engenharia e Geociências'),
    ).toBeInTheDocument();
    for (const label of ['E-mail', 'Matrícula', 'Instituto']) {
      expect(
        screen.queryByRole('textbox', { name: label }),
      ).not.toBeInTheDocument();
    }
  });

  it('oferece só os cursos do instituto do professor', async () => {
    const fetchMock = mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();

    await user.click(screen.getByRole('combobox', { name: 'Cursos' }));

    expect(
      await screen.findByRole('option', { name: 'Engenharia da Computação' }),
    ).toBeInTheDocument();
    const coursesCalls = requestsTo(fetchMock, 'GET /api/cursos');
    expect(coursesCalls.length).toBeGreaterThan(0);
    for (const [input] of coursesCalls) {
      expect(
        new URL(String(input), 'http://localhost').searchParams.get(
          'institute_id',
        ),
      ).toBe('1');
    }
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    let attempts = 0;
    mockApi({
      ...teacherProfileRoutes(),
      [PROFILE_URL]: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: TEACHER_PROFILE };
      },
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocorreu um erro no servidor',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await formReady()).toHaveValue('Carlos Lima');
  });

  it('não mostra o formulário quando o perfil vem sem instituto (caso defensivo)', async () => {
    mockApi(
      teacherProfileRoutes(
        savedProfile({ institute_id: null, course_ids: [] }),
      ),
    );

    renderApp('/professor/perfil');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'o seu cadastro está sem instituto',
    );
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });
});

describe('TeacherProfilePage: cursos, disponibilidade e gravação', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('permite escolher mais um curso e envia a lista completa de cursos', async () => {
    const fetchMock = mockApi({
      ...teacherProfileRoutes(),
      [PATCH_URL]: () => ({ body: savedProfile({ course_ids: [10, 11] }) }),
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();

    await user.click(screen.getByRole('combobox', { name: 'Cursos' }));
    await user.click(
      await screen.findByRole('option', { name: 'Engenharia da Computação' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({ course_ids: [10, 11] });
  });

  it('mostra o erro no campo de cursos e não envia nada quando a lista fica vazia', async () => {
    const fetchMock = mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();

    const chip = within(field('Cursos'))
      .getByText('Ciência da Computação')
      .closest('.MuiChip-root') as HTMLElement;
    await user.click(within(chip).getByTestId('CancelIcon'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Escolha ao menos um curso.'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
  });

  it('mostra o erro no campo de áreas quando a lista de áreas fica vazia (RN22)', async () => {
    const fetchMock = mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();

    for (const name of ['Inteligência Artificial', 'Engenharia de Software']) {
      const chip = within(field('Áreas de interesse'))
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

  it('explica, sem diálogo, que desligar a disponibilidade ou retirar um curso só impede novos pedidos', async () => {
    mockApi(teacherProfileRoutes());
    renderApp('/professor/perfil');
    await formReady();

    expect(
      screen.getByText(
        /não afeta as orientações ativas nem as solicitações pendentes/,
      ),
    ).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('só grava a disponibilidade pelo botão Salvar, e o aviso de pendência aparece com a chave', async () => {
    const fetchMock = mockApi({
      ...teacherProfileRoutes(),
      [PATCH_URL]: () => ({ body: savedProfile({ is_available: false }) }),
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    );

    expect(screen.getByText(NOTICE).closest('[role="status"]')).not.toBeNull();
    expect(requestsTo(fetchMock, PATCH_URL)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({ is_available: false });
    expect(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    ).not.toBeChecked();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('envia só o que mudou quando se mexe em vários campos, e atualiza o nome do cabeçalho', async () => {
    let currentName = 'Carlos Lima';
    const fetchMock = mockApi({
      ...teacherProfileRoutes(),
      'GET /api/auth/me': () => ({
        body: {
          id: 9,
          full_name: currentName,
          email: 'carlos@example.com',
          type: 'teacher',
          active_advisees_count: 0,
        },
      }),
      [PATCH_URL]: (body) => {
        currentName = (body as { full_name: string }).full_name;
        return {
          body: savedProfile({ full_name: currentName, is_available: false }),
        };
      },
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    const name = await formReady();

    await user.clear(name);
    await user.type(name, 'Carlos Lima Filho');
    await user.click(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect(patchBody(fetchMock)).toEqual({
      full_name: 'Carlos Lima Filho',
      is_available: false,
    });
    await waitFor(() =>
      expect(
        screen.getByText('Carlos Lima Filho', { selector: 'span' }),
      ).toBeInTheDocument(),
    );
  });

  it('mostra os erros 422 do servidor, cada um no seu campo, inclusive o de artigo repetido (RN31)', async () => {
    mockApi({
      ...teacherProfileRoutes(),
      [PATCH_URL]: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'course_ids'],
              msg: 'Escolha cursos do seu instituto.',
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
    renderApp('/professor/perfil');
    await formReady();
    await user.click(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    );

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Escolha cursos do seu instituto.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Mantenha ao menos uma área de interesse.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Há dois artigos com o mesmo título e ano.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });
});

describe('TeacherProfilePage: alterações não salvas e celular', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('pergunta antes de sair com a chave de disponibilidade alterada, e não pergunta depois de voltar ao valor original', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();
    const toggle = screen.getByRole('switch', {
      name: 'Disponível para orientar',
    });

    await user.click(toggle);
    await user.click(screen.getByRole('link', { name: 'Solicitações' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Descartar alterações?',
    );
    await user.click(
      screen.getByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    );
    await user.click(screen.getByRole('link', { name: 'Solicitações' }));

    expect(
      await screen.findByRole('heading', { name: 'Solicitações' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('funciona em tela pequena e a gaveta também respeita as alterações pendentes', async () => {
    setViewportWidth(PHONE_WIDTH);
    mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await user.type(await formReady(), ' Filho');

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.click(await screen.findByRole('link', { name: 'Solicitações' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Descartar alterações?',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/professor/perfil',
    );
  });

  it('avisa o navegador ao fechar a aba só quando há pendências', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    mockApi(teacherProfileRoutes());
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.click(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    );
    const dirty = new Event('beforeunload', { cancelable: true });
    await act(async () => {
      window.dispatchEvent(dirty);
    });

    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('TeacherProfilePage: cursos fora da lista e falhas do catálogo', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('não tira em silêncio um curso gravado que a lista do instituto não traz', async () => {
    const fetchMock = mockApi({
      ...teacherProfileRoutes(savedProfile({ course_ids: [10, 99] })),
      [PATCH_URL]: () => ({ body: savedProfile({ course_ids: [99, 10, 11] }) }),
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();

    await user.click(screen.getByRole('combobox', { name: 'Cursos' }));
    await user.click(
      await screen.findByRole('option', { name: 'Engenharia da Computação' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Perfil atualizado com sucesso.');
    expect([...patchBody(fetchMock).course_ids].sort()).toEqual([10, 11, 99]);
  });

  it('mostra o erro do servidor no campo da disponibilidade', async () => {
    mockApi({
      ...teacherProfileRoutes(),
      [PATCH_URL]: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'is_available'],
              msg: 'Não é possível ficar disponível sem cursos.',
              type: 'value_error',
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await formReady();
    await user.click(
      screen.getByRole('switch', { name: 'Disponível para orientar' }),
    );

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Não é possível ficar disponível sem cursos.'),
    ).toBeVisible();
  });

  it('avisa quando os cursos não carregam e permite tentar de novo, sem mostrar um campo vazio', async () => {
    let attempts = 0;
    mockApi({
      ...teacherProfileRoutes(),
      'GET /api/cursos': () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: {} }
          : { body: INSTITUTE_COURSES };
      },
    });
    const user = userEvent.setup();
    renderApp('/professor/perfil');
    await screen.findByLabelText('Nome completo');

    expect(
      await screen.findByText('Não foi possível carregar os cursos.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('combobox', { name: 'Cursos' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Tentar carregar os cursos de novo' }),
    );

    expect(
      await screen.findByRole('combobox', { name: 'Cursos' }),
    ).toBeInTheDocument();
    expect(
      within(field('Cursos')).getByText('Ciência da Computação'),
    ).toBeInTheDocument();
  });
});
