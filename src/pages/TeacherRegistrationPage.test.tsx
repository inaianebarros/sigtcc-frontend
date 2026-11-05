import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { mockApi, requestsTo } from '../test/mockApi';
import type { MockResponse } from '../test/mockApi';
import { renderApp } from '../test/renderApp';

const REGISTER_ROUTE = 'POST /api/auth/register/professor';
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

async function fillAccountAndInstitute(user: UserEvent) {
  await user.type(screen.getByLabelText('Matrícula'), '1234567');
  await user.type(screen.getByLabelText('Nome completo'), 'Carlos Lima');
  await user.type(screen.getByLabelText('E-mail'), 'carlos.lima@example.com');
  await user.type(screen.getByLabelText('Senha'), PASSWORD);
  await user.type(screen.getByLabelText('Confirmação de senha'), PASSWORD);
  await chooseOption(
    user,
    'Instituto',
    'Instituto de Engenharia e Geociências',
  );
}

async function fillValidForm(user: UserEvent) {
  await fillAccountAndInstitute(user);
  await chooseOption(user, 'Cursos', 'Ciência da Computação');
  await chooseOption(user, 'Áreas de interesse', 'Banco de Dados');
}

async function openForm() {
  renderApp('/cadastro/professor');
  await screen.findByRole('heading', { name: 'Cadastro de professor' });
}

describe('TeacherRegistrationPage', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('mostra todos os campos do RF02, com o tipo de conta fixo e somente leitura', async () => {
    mockApi(catalog);

    await openForm();

    for (const label of [
      'Matrícula',
      'Nome completo',
      'E-mail',
      'Senha',
      'Confirmação de senha',
      'Instituto',
      'Cursos',
      'Áreas de interesse',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    const inRf02Order = [
      'Matrícula',
      'Nome completo',
      'E-mail',
      'Senha',
      'Confirmação de senha',
      'Tipo de conta',
      'Instituto',
      'Cursos',
      'Áreas de interesse',
    ];
    const byPosition = [...inRf02Order].sort((a, b) =>
      screen
        .getByLabelText(a)
        .compareDocumentPosition(screen.getByLabelText(b)) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
    expect(byPosition).toEqual(inRf02Order);
    expect(screen.getByLabelText('Tipo de conta')).toHaveValue('Professor');
    expect(screen.getByLabelText('Tipo de conta')).toHaveAttribute('readonly');
  });

  it('exige ao menos um curso e uma área, com os erros junto dos campos', async () => {
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
      'Escolha ao menos um curso.',
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

  it('lista só os cursos do instituto escolhido', async () => {
    const fetchMock = mockApi(catalog);
    const user = userEvent.setup();
    await openForm();

    await chooseOption(user, 'Instituto', 'Instituto de Ciências da Educação');
    await user.click(screen.getByLabelText('Cursos'));

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Pedagogia']);
    const [url] = requestsTo(fetchMock, 'GET /api/cursos').at(-1) ?? [];
    expect(String(url)).toContain('institute_id=2');
  });

  it('envia vários cursos, avisa o sucesso e leva ao login', async () => {
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
    await user.click(screen.getByLabelText('Cursos'));
    await user.click(
      await screen.findByRole('option', { name: 'Sistemas de Informação' }),
    );

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cadastro realizado/)).toBeInTheDocument();
    const [, init] = requestsTo(fetchMock, REGISTER_ROUTE)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      registration_number: '1234567',
      full_name: 'Carlos Lima',
      email: 'carlos.lima@example.com',
      password: PASSWORD,
      password_confirmation: PASSWORD,
      institute_id: 1,
      course_ids: [10, 11],
      area_ids: [1, 2],
    });
  });

  it('limpa os cursos escolhidos quando o instituto é trocado', async () => {
    mockApi(catalog);
    const user = userEvent.setup();
    await openForm();
    await fillAccountAndInstitute(user);
    await chooseOption(user, 'Cursos', 'Ciência da Computação');
    expect(
      screen.getByRole('button', { name: 'Ciência da Computação' }),
    ).toBeInTheDocument();

    await chooseOption(user, 'Instituto', 'Instituto de Ciências da Educação');

    expect(
      screen.queryByRole('button', { name: 'Ciência da Computação' }),
    ).not.toBeInTheDocument();
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
            loc: ['body', 'payload', 'course_ids'],
            msg: 'Algum curso não pertence ao instituto.',
          },
          {
            loc: ['body', 'payload', 'campo_novo'],
            msg: 'Erro de um campo desconhecido.',
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
    expect(screen.getByLabelText('Cursos')).toHaveAccessibleDescription(
      'Algum curso não pertence ao instituto.',
    );
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(
      'Já existe uma conta com este e-mail.',
    );
    expect(
      screen.getByText('Erro de um campo desconhecido.'),
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

  it('informa quando o instituto não tem cursos ou eles não carregam', async () => {
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
      'carlos.lima@example.com',
    );
  });
});
