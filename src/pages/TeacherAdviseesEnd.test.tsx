import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../services/tokenStore';
import { adviseeRoutes, makeAdvisee } from '../test/adviseesApi';
import { mockApi, requestsTo } from '../test/mockApi';
import { renderApp } from '../test/renderApp';
import { DESKTOP_WIDTH, PHONE_WIDTH, setViewportWidth } from '../test/viewport';

const LIST = 'GET /api/orientacao/orientandos';
const ME = 'GET /api/auth/me';
const END_1 = 'POST /api/orientacao/1/encerrar';
const PATH = '/professor/orientandos';
const REASON = 'O aluno concluiu o trabalho e a defesa foi realizada.';

function cardOf(name: string) {
  return screen.getByRole('article', { name });
}

/** Com o diálogo aberto ou saindo, o resto da página fica fora da árvore de acessibilidade. */
function findCard(name: string) {
  return screen.findByRole('article', { name });
}

function bodyOf(fetchMock: ReturnType<typeof mockApi>, key: string, index = 0) {
  return JSON.parse(String(requestsTo(fetchMock, key)[index]?.[1]?.body));
}

type Ends = Parameters<typeof adviseeRoutes>[1];

function setup(
  items = [
    makeAdvisee(1, {
      student: {
        id: 101,
        full_name: 'Ana Souza',
        course: { id: 10, name: 'Ciência da Computação' },
      },
    }),
    makeAdvisee(2),
  ],
  ends: Ends = {},
) {
  const fetchMock = mockApi(adviseeRoutes(items, ends));
  const user = userEvent.setup();
  renderApp(PATH);
  return { fetchMock, user };
}

async function openDialog(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Ana Souza',
) {
  await screen.findByText(name);
  const button = within(cardOf(name)).getByRole('button', {
    name: `Encerrar orientação de ${name}`,
  });
  await user.click(button);
  return { button, dialog: await screen.findByRole('dialog') };
}

function confirmButton(dialog: HTMLElement) {
  return within(dialog).getByRole('button', { name: 'Encerrar orientação' });
}

async function typeReason(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  text = REASON,
) {
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Motivo do encerramento' }),
    text,
  );
}

beforeEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('Encerrar orientação: o diálogo', () => {
  it('cada cartão tem a ação, com o nome do aluno para o leitor de tela', async () => {
    setup();
    await screen.findByText('Ana Souza');

    for (const name of ['Ana Souza', 'Orientando 2']) {
      const button = within(cardOf(name)).getByRole('button', {
        name: `Encerrar orientação de ${name}`,
      });
      expect(button).toHaveTextContent('Encerrar orientação');
    }
  });

  it('nomeia o aluno e diz que não dá para desfazer, que as atividades em aberto serão arquivadas e as reuniões pendentes ou aceitas ainda não realizadas, canceladas (RN30)', async () => {
    const { user } = setup();
    const { dialog } = await openDialog(user);

    expect(dialog).toHaveAccessibleName('Encerrar a orientação de Ana Souza?');
    expect(dialog).toHaveTextContent('Esta ação não pode ser desfeita');
    expect(dialog).toHaveTextContent(
      'As atividades pendentes, em andamento ou em revisão serão arquivadas',
    );
    expect(dialog).toHaveTextContent(
      'As reuniões pendentes ou aceitas ainda não realizadas serão canceladas',
    );
  });

  it('pede o motivo, com o contador, e o botão de confirmar nasce desabilitado', async () => {
    const { user } = setup();
    const { dialog } = await openDialog(user);

    expect(
      within(dialog).getByRole('textbox', { name: 'Motivo do encerramento' }),
    ).toBeRequired();
    expect(dialog).toHaveTextContent('De 10 a 500 caracteres (0/500)');
    expect(confirmButton(dialog)).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeEnabled();
  });

  it('só habilita a confirmação com 10 a 500 caracteres, sem contar os espaços das pontas', async () => {
    const { user } = setup();
    const { dialog } = await openDialog(user);
    const field = within(dialog).getByRole('textbox', {
      name: 'Motivo do encerramento',
    });

    await user.type(field, '   curto   ');
    expect(confirmButton(dialog)).toBeDisabled();
    expect(dialog).toHaveTextContent('(5/500)');

    await user.clear(field);
    await user.type(field, ' 1234567890 ');
    expect(confirmButton(dialog)).toBeEnabled();
    expect(dialog).toHaveTextContent('(10/500)');

    fireEvent.change(field, { target: { value: 'x'.repeat(500) } });
    expect(confirmButton(dialog)).toBeEnabled();

    fireEvent.change(field, { target: { value: 'x'.repeat(501) } });
    expect(confirmButton(dialog)).toBeDisabled();
    expect(field).toBeInvalid();
    expect(dialog).toHaveTextContent('(501/500)');
  });

  it('cancelar fecha sem pedir nada, devolve o foco ao botão e limpa o que foi digitado', async () => {
    const { fetchMock, user } = setup();
    const { button, dialog } = await openDialog(user);
    await typeReason(user, dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, END_1)).toHaveLength(0);
    expect(button).toHaveFocus();
    await user.click(button);
    expect(
      within(await screen.findByRole('dialog')).getByRole('textbox', {
        name: 'Motivo do encerramento',
      }),
    ).toHaveValue('');
  });

  it('o Escape também fecha sem pedir nada e devolve o foco', async () => {
    const { fetchMock, user } = setup();
    const { button } = await openDialog(user);

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, END_1)).toHaveLength(0);
    expect(button).toHaveFocus();
  });
});

describe('Encerrar orientação: confirmar', () => {
  it('envia o motivo sem os espaços das pontas, uma vez só, e bloqueia o botão enquanto espera', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = adviseeRoutes([makeAdvisee(1), makeAdvisee(2)]);
    const end = base[END_1] as (body: unknown, url: URL) => unknown;
    const fetchMock = mockApi({
      ...base,
      [END_1]: async (body: unknown, url: URL) => {
        await gate;
        return end(body, url);
      },
    } as never);
    const user = userEvent.setup();
    renderApp(PATH);
    const { dialog } = await openDialog(user, 'Orientando 1');
    await typeReason(user, dialog, `  ${REASON}  `);

    await user.click(confirmButton(dialog));

    const busy = await within(dialog).findByRole('button', {
      name: 'Encerrando…',
    });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    expect(requestsTo(fetchMock, END_1)).toHaveLength(1);
    expect(bodyOf(fetchMock, END_1)).toEqual({ reason: REASON });
    release?.();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('com sucesso, fecha, avisa, tira o aluno da lista e leva o foco ao título', async () => {
    const { fetchMock, user } = setup();
    const { dialog } = await openDialog(user);
    await typeReason(user, dialog);

    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Orientação encerrada.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Orientando 2')).toBeVisible();
    expect(requestsTo(fetchMock, LIST).length).toBeGreaterThanOrEqual(2);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Orientandos' }),
      ).toHaveFocus(),
    );
  });

  it('relê o usuário, e o item Orientandos volta a ficar desabilitado quando não sobra orientando', async () => {
    const { fetchMock, user } = setup([makeAdvisee(1)]);
    expect(
      await screen.findByRole('link', { name: 'Orientandos' }),
    ).toBeInTheDocument();
    const { dialog } = await openDialog(user, 'Orientando 1');
    await typeReason(user, dialog);

    await user.click(confirmButton(dialog));

    expect(
      await screen.findByRole('button', { name: /Orientandos/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(requestsTo(fetchMock, ME).length).toBeGreaterThanOrEqual(2);
    expect(
      await screen.findByText('Você ainda não tem orientandos ativos.'),
    ).toBeVisible();
  });
});

describe('Encerrar orientação: erros', () => {
  it('no 404, mostra "Orientação não encontrada", fecha o diálogo e recarrega a lista', async () => {
    const { fetchMock, user } = setup(undefined, {
      1: { status: 404, body: { detail: 'Not found' } },
    });
    const { dialog } = await openDialog(user);
    await typeReason(user, dialog);
    const before = requestsTo(fetchMock, LIST).length;

    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Orientação não encontrada.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(before),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orientandos' }),
    ).toBeInTheDocument();
  });

  it('no 409, mostra "Orientação já encerrada", fecha o diálogo e recarrega a lista', async () => {
    const { fetchMock, user } = setup(undefined, {
      1: { status: 409, body: { detail: 'Conflito' } },
    });
    const { dialog } = await openDialog(user);
    await typeReason(user, dialog);
    const before = requestsTo(fetchMock, LIST).length;

    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Orientação já encerrada.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestsTo(fetchMock, LIST).length).toBeGreaterThan(before),
    );
  });

  it('com o motivo recusado pelo servidor, mostra a mensagem em português no campo, e não a do Pydantic, e mantém o diálogo aberto', async () => {
    const { fetchMock, user } = setup(undefined, {
      1: {
        status: 422,
        body: {
          detail: [
            {
              loc: ['body', 'reason'],
              msg: 'String should have at least 10 characters',
            },
          ],
        },
      },
    });
    const { dialog } = await openDialog(user);
    await typeReason(user, dialog);

    await user.click(confirmButton(dialog));

    const field = within(dialog).getByRole('textbox', {
      name: 'Motivo do encerramento',
    });
    expect(
      await within(dialog).findByText(
        'O motivo deve ter de 10 a 500 caracteres.',
      ),
    ).toBeVisible();
    expect(within(dialog).queryByText(/String should/)).not.toBeInTheDocument();
    expect(field).toBeInvalid();
    expect(field).toHaveValue(REASON);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requestsTo(fetchMock, LIST)).toHaveLength(1);
  });

  it('em outra falha, mostra o alerta com "Tentar novamente", mantém o diálogo e o texto e reenvia ao tentar de novo', async () => {
    let attempts = 0;
    const base = adviseeRoutes([makeAdvisee(1), makeAdvisee(2)]);
    const end = base[END_1] as (body: unknown, url: URL) => unknown;
    const fetchMock = mockApi({
      ...base,
      [END_1]: (body: unknown, url: URL) => {
        attempts += 1;
        return attempts === 1 ? { status: 500, body: {} } : end(body, url);
      },
    } as never);
    const user = userEvent.setup();
    renderApp(PATH);
    const { dialog } = await openDialog(user, 'Orientando 1');
    await typeReason(user, dialog);

    await user.click(confirmButton(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /Ocorreu um erro no servidor/,
    );
    expect(
      within(dialog).getByRole('textbox', { name: 'Motivo do encerramento' }),
    ).toHaveValue(REASON);
    await user.click(
      within(dialog).getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Orientação encerrada.')).toBeVisible();
    expect(requestsTo(fetchMock, END_1)).toHaveLength(2);
    expect(bodyOf(fetchMock, END_1, 1)).toEqual({ reason: REASON });
  });

  it('o alerta de falha some quando o professor volta a editar o motivo', async () => {
    const { user } = setup(undefined, { 1: { status: 500, body: {} } });
    const { dialog } = await openDialog(user);
    await typeReason(user, dialog);
    await user.click(confirmButton(dialog));
    await within(dialog).findByRole('alert');

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Motivo do encerramento' }),
      '!',
    );

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Encerrar orientação: celular', () => {
  it('funciona em tela pequena: abre o diálogo, valida e encerra', async () => {
    setViewportWidth(PHONE_WIDTH);
    const { fetchMock, user } = setup();
    await screen.findByRole('button', { name: 'Abrir menu' });
    const { dialog } = await openDialog(user);
    expect(confirmButton(dialog)).toBeDisabled();
    await typeReason(user, dialog);

    await user.click(confirmButton(dialog));

    expect(await screen.findByText('Orientação encerrada.')).toBeVisible();
    expect(requestsTo(fetchMock, END_1)).toHaveLength(1);
    expect((await findCard('Orientando 2')).tagName).toBe('ARTICLE');
  });
});
