import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';

const REGISTER_ROUTE = 'POST /api/auth/register/aluno';
const PASSWORD = 'Senha-Segura-2026';

const courses = [
  { id: 10, institute_id: 1, name: 'Ciência da Computação' },
  { id: 11, institute_id: 1, name: 'Sistemas de Informação' },
  { id: 20, institute_id: 2, name: 'Pedagogia' },
];

const catalog = {
  'POST /api/auth/refresh': { status: 401, body: {} },
  'GET /api/institutos': {
    body: [
      { id: 1, name: 'Instituto de Engenharia e Geociências' },
      { id: 2, name: 'Instituto de Ciências da Educação' },
    ],
  },
  'GET /api/cursos': (_body: unknown, url: URL) => ({
    body: courses.filter(
      (course) =>
        course.institute_id === Number(url.searchParams.get('institute_id')),
    ),
  }),
  'GET /api/areas-de-interesse': {
    body: [
      { id: 1, name: 'Banco de Dados' },
      { id: 2, name: 'Redes de Computadores' },
    ],
  },
};

async function chooseOption(user: UserEvent, field: string, option: string) {
  await user.click(screen.getByLabelText(field));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillValidForm(user: UserEvent) {
  await user.type(screen.getByLabelText('Matrícula'), '202411001');
  await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
  await user.type(screen.getByLabelText('E-mail'), 'ana.souza@example.com');
  await user.type(screen.getByLabelText('Senha'), PASSWORD);
  await user.type(screen.getByLabelText('Confirmação de senha'), PASSWORD);
  await chooseOption(
    user,
    'Instituto',
    'Instituto de Engenharia e Geociências',
  );
  await chooseOption(user, 'Curso', 'Ciência da Computação');
  await chooseOption(user, 'Áreas de interesse', 'Banco de Dados');
}

async function openForm() {
  renderApp('/cadastro/aluno');
  await screen.findByRole('heading', { name: 'Cadastro de aluno' });
}

describe('StudentRegistrationPage', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('mostra todos os campos do RF01, sem campo de tipo de conta (o tipo é o da página)', async () => {
    mockApi(catalog);

    await openForm();

    for (const label of [
      'Matrícula',
      'Nome completo',
      'E-mail',
      'Senha',
      'Confirmação de senha',
      'Instituto',
      'Curso',
      'Áreas de interesse',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('heading', { name: 'Cadastro de aluno' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo de conta')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Curso')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('exibe os erros de cada campo junto dele sem chamar a API de cadastro', async () => {
    const fetchMock = mockApi(catalog);
    const user = userEvent.setup();
    await openForm();

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    for (const message of [
      'Informe a matrícula.',
      'Informe o nome completo.',
      'Informe o e-mail.',
      'Informe a senha.',
      'Confirme a senha.',
      'Escolha o instituto.',
      'Escolha o curso.',
      'Escolha ao menos uma área de interesse.',
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
    expect(requestsTo(fetchMock, REGISTER_ROUTE)).toHaveLength(0);
  });

  it('valida a confirmação de senha no próprio formulário', async () => {
    const fetchMock = mockApi(catalog);
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Confirmação de senha'));
    await user.type(
      screen.getByLabelText('Confirmação de senha'),
      'Outra-Senha-2026',
    );

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('As senhas não coincidem.'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, REGISTER_ROUTE)).toHaveLength(0);
  });

  it('carrega só os cursos do instituto escolhido', async () => {
    const fetchMock = mockApi(catalog);
    const user = userEvent.setup();
    await openForm();

    await chooseOption(user, 'Instituto', 'Instituto de Ciências da Educação');
    await user.click(screen.getByLabelText('Curso'));

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Pedagogia']);
    const [url] = requestsTo(fetchMock, 'GET /api/cursos').at(-1) ?? [];
    expect(String(url)).toContain('institute_id=2');
  });

  it('envia o cadastro, avisa o sucesso e leva ao login', async () => {
    const fetchMock = mockApi({
      ...catalog,
      [REGISTER_ROUTE]: { status: 201, body: {} },
    });
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);
    await user.click(
      await screen.findByRole('option', { name: 'Redes de Computadores' }),
    );

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cadastro realizado/)).toBeInTheDocument();
    const [, init] = requestsTo(fetchMock, REGISTER_ROUTE)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      registration_number: '202411001',
      full_name: 'Ana Souza',
      email: 'ana.souza@example.com',
      password: PASSWORD,
      password_confirmation: PASSWORD,
      institute_id: 1,
      course_id: 10,
      area_ids: [1, 2],
    });
  });

  it('mostra os erros devolvidos pelo servidor junto dos campos correspondentes', async () => {
    const serverErrors: MockResponse = {
      status: 422,
      body: {
        detail: [
          {
            loc: ['body', 'payload', 'email'],
            msg: 'Já existe uma conta com este e-mail.',
          },
          {
            loc: ['body', 'payload', 'registration_number'],
            msg: 'Já existe um cadastro com esta matrícula.',
          },
          {
            loc: ['body', 'payload', 'password'],
            msg: 'Esta senha é muito comum.',
          },
        ],
      },
    };
    mockApi({ ...catalog, [REGISTER_ROUTE]: serverErrors });
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('Já existe uma conta com este e-mail.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Já existe um cadastro com esta matrícula.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Esta senha é muito comum.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Cadastro de aluno' }),
    ).toBeInTheDocument();
  });

  it('desabilita o botão e mostra o andamento enquanto o cadastro é enviado', async () => {
    let finish: (value: MockResponse) => void = () => {};
    mockApi({
      ...catalog,
      [REGISTER_ROUTE]: () => new Promise((resolve) => (finish = resolve)),
    });
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByRole('button', { name: 'Cadastrando…' }),
    ).toBeDisabled();
    finish({ status: 201, body: {} });
    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
  });

  it('avisa quando as listas de institutos e áreas não carregam', async () => {
    mockApi({ ...catalog, 'GET /api/institutos': { status: 500, body: {} } });

    renderApp('/cadastro/aluno');

    expect(
      await screen.findByText(/Não foi possível carregar/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('alert')).getByText(/institutos/i),
    ).toBeInTheDocument();
  });

  it('informa quando o instituto escolhido não tem cursos', async () => {
    mockApi({ ...catalog, 'GET /api/cursos': { body: [] } });
    const user = userEvent.setup();
    await openForm();

    await chooseOption(
      user,
      'Instituto',
      'Instituto de Engenharia e Geociências',
    );

    expect(
      await screen.findByText('Este instituto não tem cursos cadastrados.'),
    ).toBeInTheDocument();
  });

  it('informa quando os cursos do instituto não carregam', async () => {
    mockApi({ ...catalog, 'GET /api/cursos': { status: 500, body: {} } });
    const user = userEvent.setup();
    await openForm();

    await chooseOption(
      user,
      'Instituto',
      'Instituto de Engenharia e Geociências',
    );

    expect(
      await screen.findByText('Não foi possível carregar os cursos.'),
    ).toBeInTheDocument();
  });

  it('informa quando não há institutos nem áreas cadastrados', async () => {
    mockApi({
      ...catalog,
      'GET /api/institutos': { body: [] },
      'GET /api/areas-de-interesse': { body: [] },
    });

    await openForm();

    expect(
      await screen.findByText('Nenhum instituto cadastrado.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nenhuma área de interesse cadastrada.'),
    ).toBeInTheDocument();
  });

  it('limpa o curso escolhido quando o instituto é trocado', async () => {
    mockApi(catalog);
    const user = userEvent.setup();
    await openForm();
    await chooseOption(
      user,
      'Instituto',
      'Instituto de Engenharia e Geociências',
    );
    await chooseOption(user, 'Curso', 'Ciência da Computação');
    expect(screen.getByLabelText('Curso')).toHaveTextContent(
      'Ciência da Computação',
    );

    await chooseOption(user, 'Instituto', 'Instituto de Ciências da Educação');

    expect(screen.getByLabelText('Curso')).not.toHaveTextContent(
      'Ciência da Computação',
    );
  });

  it('avisa quando o cadastro não chega ao servidor e mantém o que foi digitado', async () => {
    mockApi({
      ...catalog,
      [REGISTER_ROUTE]: () => {
        throw new TypeError('network down');
      },
    });
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText(/Não foi possível conectar ao servidor/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue(
      'ana.souza@example.com',
    );
  });

  it('mostra num alerta do formulário um erro do servidor que não pertence a nenhum campo', async () => {
    mockApi({
      ...catalog,
      [REGISTER_ROUTE]: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'payload', 'institute_id'],
              msg: 'Instituto não encontrado.',
            },
            {
              loc: ['body', 'payload', 'campo_novo'],
              msg: 'Erro de um campo desconhecido.',
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('Instituto não encontrado.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Erro de um campo desconhecido.'),
    ).toBeInTheDocument();
  });

  it('mostra quanto tempo esperar quando o servidor limita as tentativas', async () => {
    mockApi({
      ...catalog,
      [REGISTER_ROUTE]: {
        status: 429,
        body: {
          detail: 'Muitas tentativas. Aguarde antes de tentar novamente.',
        },
        headers: { 'Retry-After': '120' },
      },
    });
    const user = userEvent.setup();
    await openForm();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText(
        'Muitas tentativas. Tente novamente em 2 minutos.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue(
      'ana.souza@example.com',
    );
  });
});
