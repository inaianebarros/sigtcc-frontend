import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { makeAdvisee } from '../test/adviseesApi';
import type { FakeAdvisee } from '../test/adviseesApi';
import { makeMeeting, meetingsServer } from '../test/meetingsApi';
import type { FakeMeeting } from '../test/meetingsApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/reunioes';
const ADVISEES = 'GET /api/orientacao/orientandos';
const STUDENT_PATH = '/aluno/reunioes';
const TEACHER_PATH = '/professor/reunioes';

const ADVISEE_LIST: FakeAdvisee[] = [
  makeAdvisee(1, {
    student: {
      id: 101,
      full_name: 'Maria Lima',
      course: { id: 1, name: 'BCC' },
    },
    thesis_topic: 'Gestão de TCC com Django',
  }),
  makeAdvisee(2, {
    student: {
      id: 102,
      full_name: 'João Reis',
      course: { id: 1, name: 'BCC' },
    },
    thesis_topic: null,
  }),
];

function setup(
  meetings: FakeMeeting[],
  user: 'student' | 'teacher',
  path = user === 'student' ? STUDENT_PATH : TEACHER_PATH,
) {
  const server = meetingsServer(meetings, { user, advisees: ADVISEE_LIST });
  const fetchMock = mockApi(server.routes);
  const events = userEvent.setup();
  renderApp(path);
  return { fetchMock, events, server };
}

function paramsOf(fetchMock: ReturnType<typeof mockApi>, route: string) {
  return requestsTo(fetchMock, route).map(
    ([input]) => new URL(String(input), 'http://localhost').searchParams,
  );
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Reuniões: situação e período na URL (RNF30)', () => {
  it('guarda a situação na URL, pede só essa situação ao servidor e a restaura ao recarregar', async () => {
    const { fetchMock, events } = setup(
      [
        makeMeeting(1, { description: 'Pauta aberta', situation: 'pending' }),
        makeMeeting(2, {
          description: 'Pauta aceita',
          situation: 'accepted',
          status: 'accepted',
        }),
      ],
      'student',
    );
    await screen.findByText('Pauta aberta');

    await events.click(screen.getByRole('combobox', { name: 'Situação' }));
    await events.click(await screen.findByRole('option', { name: 'Aceita' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/aluno/reunioes?situacao=accepted',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText('Pauta aberta')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Pauta aceita')).toBeVisible();
    expect(paramsOf(fetchMock, LIST).at(-1)?.get('situation')).toBe('accepted');
  });

  it('abre já filtrada pela URL e mostra os filtros preenchidos', async () => {
    const { fetchMock } = setup(
      [makeMeeting(1, { description: 'Pauta', situation: 'held' })],
      'student',
      '/aluno/reunioes?situacao=held&de=2099-01-01&ate=2099-12-31',
    );

    await screen.findByText('Pauta');

    const params = paramsOf(fetchMock, LIST).at(-1)!;
    expect(params.get('situation')).toBe('held');
    expect(params.get('date_from')).toBe('2099-01-01');
    expect(params.get('date_to')).toBe('2099-12-31');
    expect(
      screen.getByRole('combobox', { name: 'Situação' }),
    ).toHaveTextContent('Realizada');
    expect(screen.getByLabelText('De')).toHaveValue('2099-01-01');
    expect(screen.getByLabelText('Até')).toHaveValue('2099-12-31');
  });

  it('ignora situação e datas inválidas na URL', async () => {
    const { fetchMock } = setup(
      [makeMeeting(1, { description: 'Qualquer' })],
      'student',
      '/aluno/reunioes?situacao=arquivada&de=amanhã&ate=2099-02-30',
    );

    await screen.findByText('Qualquer');

    const params = paramsOf(fetchMock, LIST).at(-1)!;
    expect(params.has('situation')).toBe(false);
    expect(params.has('date_from')).toBe(false);
    expect(params.has('date_to')).toBe(false);
  });

  it('guarda o período na URL e o envia ao servidor', async () => {
    const { fetchMock, events } = setup(
      [
        makeMeeting(1, {
          description: 'Dentro',
          scheduled_at: '2099-06-15T10:00:00-03:00',
        }),
        makeMeeting(2, {
          description: 'Fora',
          scheduled_at: '2099-08-15T10:00:00-03:00',
        }),
      ],
      'student',
    );
    await screen.findByText('Dentro');

    await events.type(screen.getByLabelText('De'), '2099-06-01');
    await events.type(screen.getByLabelText('Até'), '2099-06-30');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('de=2099-06-01'),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('ate=2099-06-30');
    await waitFor(() =>
      expect(screen.queryByText('Fora')).not.toBeInTheDocument(),
    );
    const params = paramsOf(fetchMock, LIST).at(-1)!;
    expect(params.get('date_from')).toBe('2099-06-01');
    expect(params.get('date_to')).toBe('2099-06-30');
  });

  it('datas fora de ordem mostram o erro no campo e não consultam o servidor', async () => {
    const { fetchMock, events } = setup(
      [
        makeMeeting(1, {
          description: 'Pauta',
          scheduled_at: '2099-06-15T10:00:00-03:00',
        }),
      ],
      'student',
      '/aluno/reunioes?de=2099-06-01&ate=2099-06-30',
    );
    await screen.findByText('Pauta');
    const before = requestsTo(fetchMock, LIST).length;

    const to = screen.getByLabelText('Até');
    await events.clear(to);
    await events.type(to, '2099-05-01');

    expect(
      await screen.findByText(
        'A data inicial não pode ser depois da data final.',
      ),
    ).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const sent = paramsOf(fetchMock, LIST)
      .slice(before)
      .filter((params) => params.get('date_to') === '2099-05-01');
    expect(sent).toHaveLength(0);
  });

  it('mudar um filtro volta à primeira página', async () => {
    const many = Array.from({ length: 45 }, (_, index) =>
      makeMeeting(index + 1, { description: `Pauta ${index + 1}` }),
    );
    const { fetchMock, events } = setup(
      many,
      'student',
      '/aluno/reunioes?pagina=2',
    );
    await screen.findByText('Pauta 21');

    await events.click(screen.getByRole('combobox', { name: 'Situação' }));
    await events.click(await screen.findByRole('option', { name: 'Pendente' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/aluno\/reunioes\?situacao=pending$/,
      ),
    );
    await waitFor(() =>
      expect(paramsOf(fetchMock, LIST).at(-1)?.get('offset')).toBe('0'),
    );
  });

  it('com filtros sem resultado mostra a mensagem e Limpar filtros, que volta ao padrão', async () => {
    const { events } = setup(
      [makeMeeting(1, { description: 'Só esta', situation: 'pending' })],
      'student',
      '/aluno/reunioes?situacao=held',
    );

    expect(
      await screen.findByText('Nenhuma reunião encontrada com esses filtros'),
    ).toBeVisible();
    await events.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(await screen.findByText('Só esta')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/aluno\/reunioes$/,
    );
  });
});

describe('Reuniões: o filtro de aluno do professor', () => {
  it('o aluno não tem o filtro de aluno e ignora o parâmetro aluno da URL', async () => {
    const { fetchMock } = setup(
      [makeMeeting(1, { description: 'Pauta' })],
      'student',
      '/aluno/reunioes?aluno=999',
    );

    await screen.findByText('Pauta');

    expect(
      screen.queryByRole('combobox', { name: 'Aluno' }),
    ).not.toBeInTheDocument();
    expect(paramsOf(fetchMock, LIST).at(-1)?.has('student_id')).toBe(false);
  });

  it('busca o aluno pelo nome com pausa na digitação e mostra {nome} - {tema}, ou Sem tema', async () => {
    const { fetchMock, events } = setup(
      [makeMeeting(1, { description: 'Pauta' })],
      'teacher',
    );
    await screen.findByText('Pauta');

    await events.click(screen.getByRole('combobox', { name: 'Aluno' }));
    await events.type(screen.getByRole('combobox', { name: 'Aluno' }), 'mar');

    expect(
      await screen.findByRole('option', {
        name: 'Maria Lima - Gestão de TCC com Django',
      }),
    ).toBeVisible();
    // A lista inicial ainda traz todos até a busca, depois da pausa, voltar filtrada.
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: /João Reis/ }),
      ).not.toBeInTheDocument(),
    );
    // A pausa na digitação: o servidor não recebe uma busca por letra.
    const searches = paramsOf(fetchMock, ADVISEES).map((p) => p.get('search'));
    expect(searches).not.toContain('m');
    expect(searches).toContain('mar');
  });

  it('mostra Sem tema quando o orientando não tem tema', async () => {
    const { events } = setup(
      [makeMeeting(1, { description: 'Pauta' })],
      'teacher',
    );
    await screen.findByText('Pauta');

    await events.click(screen.getByRole('combobox', { name: 'Aluno' }));

    expect(
      await screen.findByRole('option', { name: 'João Reis - Sem tema' }),
    ).toBeVisible();
  });

  it('escolher o aluno guarda aluno=<id> na URL e filtra no servidor, e limpar o remove', async () => {
    const { fetchMock, events } = setup(
      [
        makeMeeting(1, {
          description: 'Da Maria',
          student_id: 101,
          counterpart: { id: 101, full_name: 'Maria Lima' },
        }),
        makeMeeting(2, {
          description: 'Do João',
          student_id: 102,
          counterpart: { id: 102, full_name: 'João Reis' },
        }),
      ],
      'teacher',
    );
    await screen.findByText('Da Maria');

    await events.click(screen.getByRole('combobox', { name: 'Aluno' }));
    await events.click(
      await screen.findByRole('option', {
        name: 'Maria Lima - Gestão de TCC com Django',
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('aluno=101'),
    );
    await waitFor(() =>
      expect(screen.queryByText('Do João')).not.toBeInTheDocument(),
    );
    expect(paramsOf(fetchMock, LIST).at(-1)?.get('student_id')).toBe('101');

    // O botão de limpar só aparece com o mouse ou o foco, e oculto não tem nome acessível:
    // por isso a consulta é pelo aria-label.
    await events.click(screen.getByLabelText('Limpar'));

    expect(await screen.findByText('Do João')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/reunioes$/,
    );
  });

  it('abre filtrada pelo aluno da URL e mostra o nome dele no campo', async () => {
    const { fetchMock } = setup(
      [
        makeMeeting(1, {
          description: 'Da Maria',
          student_id: 101,
          counterpart: { id: 101, full_name: 'Maria Lima' },
        }),
      ],
      'teacher',
      '/professor/reunioes?aluno=101',
    );

    await screen.findByText('Da Maria');

    expect(paramsOf(fetchMock, LIST).at(-1)?.get('student_id')).toBe('101');
    expect(
      within(
        screen.getByRole('combobox', { name: 'Aluno' }).closest('div')!
          .parentElement!,
      ).getByRole('combobox'),
    ).toHaveValue('Maria Lima');
  });

  it('Esc limpa o aluno escolhido, para quem usa o teclado', async () => {
    const { events } = setup(
      [
        makeMeeting(1, {
          description: 'Da Maria',
          student_id: 101,
          counterpart: { id: 101, full_name: 'Maria Lima' },
        }),
        makeMeeting(2, {
          description: 'Do João',
          student_id: 102,
          counterpart: { id: 102, full_name: 'João Reis' },
        }),
      ],
      'teacher',
      '/professor/reunioes?aluno=101',
    );
    await screen.findByText('Da Maria');

    await events.click(screen.getByRole('combobox', { name: 'Aluno' }));
    await events.keyboard('{Escape}');
    await events.keyboard('{Escape}');

    expect(await screen.findByText('Do João')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\/professor\/reunioes$/,
    );
  });
});
