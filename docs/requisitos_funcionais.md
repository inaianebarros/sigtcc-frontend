# Requisitos Funcionais

RF01 - **Cadastrar Aluno:** O sistema deve permitir que o aluno faça cadastro informando, na ordem: Matrícula, Nome Completo, E-mail, Senha, Confirmação de Senha, Instituto, Curso e Áreas de Interesse (ao menos uma). O tipo da conta (aluno) é o do cadastro escolhido e não é um campo do formulário: o usuário não o informa nem o altera.

RF02 - **Cadastrar Professor:** O sistema deve permitir que o professor faça cadastro informando, na ordem: Matrícula, Nome Completo, E-mail, Senha, Confirmação de Senha, Instituto, Curso(s) e Áreas de Interesse (ao menos uma). O tipo da conta (professor) é o do cadastro escolhido e não é um campo do formulário: o usuário não o informa nem o altera.

RF03 - **Realizar Login:** O sistema deve permitir que usuários cadastrados realizem o login utilizando e-mail e senha, concedendo acesso às funcionalidades de acordo com seu perfil.

RF04 - **Editar Perfil do Aluno:** O sistema deve permitir que o aluno edite suas informações de perfil, como nome, áreas de interesse (ao menos uma deve permanecer cadastrada) e artigos publicados.

RF05 - **Editar Perfil do Professor:** O sistema deve permitir que o professor edite suas informações de perfil, como nome, cursos (um ou mais), áreas de interesse (ao menos uma deve permanecer cadastrada) e artigos publicados. O professor também informa se está disponível para orientar.

RF06 - **Alterar Senha:** O sistema deve permitir que o usuário altere sua senha mediante confirmação da senha atual.

RF07 - **Recuperar Senha:** O sistema deve permitir que usuários recuperem o acesso à sua conta por meio de um link de redefinição de senha enviado ao e-mail cadastrado, com validade de tempo limitado.

RF08 - **Realizar Log Out:** O sistema deve permitir que o usuário encerre sua sessão com segurança.

RF09 - **Pesquisar e Visualizar Orientadores Compatíveis:** O sistema deve apresentar ao aluno uma lista de orientadores ordenada pela compatibilidade entre as áreas de interesse cadastradas pelo aluno e as áreas de interesse cadastradas por cada orientador, limitada aos professores vinculados ao curso do aluno (RN28) e permitindo, adicionalmente, a filtragem por nome e por disponibilidade (RNF26). Por padrão, a lista mostra apenas os professores disponíveis para orientar (RN26); o aluno pode optar por exibir também os indisponíveis. Cada professor é exibido com sua disponibilidade para orientar.

RF10 - **Visualizar Perfil do Professor:** O sistema deve permitir que o aluno visualize as informações sobre o professor como: nome, instituto, cursos, áreas de interesse (com as áreas em comum com o aluno destacadas) e artigos publicados, limitado aos professores vinculados ao curso do aluno (RN28). A disponibilidade para orientar também é exibida.

RF11 - **Visualizar Perfil do Aluno:** O sistema deve permitir que o professor visualize as informações do aluno, como nome, instituto, curso, áreas de interesse (com as áreas em comum com o professor destacadas) e artigos publicados, limitado aos alunos que lhe enviaram uma solicitação de orientação, em qualquer status, ou que têm ou tiveram orientação com ele (RN32).

RF12 - **Solicitar Orientador:** O sistema deve permitir que o aluno que não possua orientador e não tenha nenhuma solicitação em andamento envie pedido de orientação para um professor cadastrado, selecionado a partir da lista de orientadores apresentada no sistema. Não é possível solicitar a um professor indisponível, mesmo quando ele é exibido na lista, nem a um professor que não seja vinculado ao curso do aluno (RN28).

RF13 - **Listar Solicitações de Alunos:** O sistema deve permitir que o professor visualize todas as solicitações de orientação recebidas, incluindo as com status não respondida.

RF14 - **Responder Solicitação de Aluno:** O sistema deve permitir que o professor aceite ou recuse solicitações de orientação enviadas por aluno. A recusa não exige justificativa.

RF15 - **Encerrar Orientação:** O sistema deve permitir que o professor encerre o vínculo de orientação com um aluno. Somente o professor orientador pode encerrá-la (RN30), informando o motivo do encerramento (RN33).

RF16 - **Visualizar Status da Solicitação:** O sistema deve permitir que o aluno visualize o status (pendente, aceita, recusada ou não respondida) de sua solicitação de orientação.

RF17 - **Solicitar Reunião com Orientador:** O sistema deve permitir que o aluno solicite reuniões com seu orientador, informando data, hora e descrição.

RF18 - **Solicitar Reunião com Aluno:** O sistema deve permitir que o professor solicite reuniões, informando data, hora, descrição e aluno.

RF19 - **Visualizar Reuniões:** O sistema deve permitir que o usuário visualize a lista de reuniões agendadas. A reunião cancelada permanece na lista com o motivo do cancelamento e, quando foi cancelada automaticamente, com a indicação de que o cancelamento foi feito pelo sistema (RN34).

RF20 - **Responder Solicitação de Reunião:** O sistema deve permitir que o usuário aceite ou recuse solicitações de reunião. Em caso de recusa é necessário adicionar a justificativa.

RF21 - **Editar Reunião:** O sistema deve permitir que reuniões sejam editadas pelo autor das solicitações, desde que ainda não realizadas.

RF22 - **Cancelar Reunião:** O sistema deve permitir que o autor da solicitação cancele uma reunião ainda não realizada.

RF23 - **Cadastrar Tema do TCC:** O sistema deve permitir que o **aluno** ou o **professor** cadastre o tema do TCC da orientação enquanto ela estiver ativa, após a aceitação da solicitação de orientação (RN12).

RF24 - **Alterar Tema do TCC:** O sistema deve permitir que o aluno e o professor alterem o tema do TCC enquanto a orientação estiver ativa. Depois do encerramento da orientação o tema não pode mais ser alterado (RN12).

RF25 - **Criar Atividade:** O sistema deve permitir que o professor crie atividades relacionadas ao TCC para seus orientados, informando título, descrição e prazo, que não pode ser anterior à data atual.

RF26 - **Editar Atividade:** O sistema deve permitir que o professor edite atividades previamente cadastradas, incluindo o prazo.

RF27 - **Deletar Atividade:** O sistema deve permitir que o professor exclua atividades cadastradas. A exclusão é lógica: a atividade deixa de ser exibida, preservando suas entregas, comentários e revisões.

RF28 - **Alterar Status da Atividade:** O sistema deve permitir que o aluno altere o status da atividade entre pendente e em andamento, e submeta a atividade para revisão do orientador, desde que haja ao menos uma entrega anexada.

RF29 - **Listar Atividades:** O sistema deve permitir que aluno e professor visualize a lista de atividades vinculadas ao TCC, exibindo como "Atrasada" a atividade cujo prazo venceu sem estar concluída.

RF30 - **Visualizar Detalhes da Atividade:** O sistema deve permitir que o usuário visualize os detalhes de uma atividade especifica, incluindo o prazo e a indicação "Atrasada" quando aplicável.

RF31 - **Entregar Atividade:** O sistema deve permitir que o aluno submeta a entrega de uma atividade, sendo possível anexar arquivos.

RF32 - **Comentar Atividade:** O sistema deve permitir que aluno e professor adicionem comentários nas atividades para acompanhamento e feedback.

RF33 - **Listar Orientados:** O sistema deve permitir que o professor visualize a lista de alunos sob sua orientação.

RF34 - **Notificar Aluno sobre Resposta de Solicitação de Orientação:** O sistema deve notificar o aluno quando o professor aceitar ou recusar sua solicitação de orientação.

RF35 - **Notificar Aluno sobre Nova Atividade:** O sistema deve notificar o aluno quando o professor criar uma nova atividade.

RF36 - **Notificar Aluno sobre Comentário em Atividade:** O sistema deve notificar o aluno quando o professor registrar um comentário em uma de suas atividades.

RF37 - **Notificar Aluno sobre Reunião Agendada pelo Professor:** O sistema deve notificar o aluno quando o professor marcar uma reunião.

RF38 - **Notificar Aluno sobre Resposta a Reunião Solicitada:** O sistema deve notificar o aluno quando o professor aceitar ou recusar uma solicitação de reunião feita pelo aluno.

RF39 - **Notificar Professor sobre Nova Solicitação de Orientação:** O sistema deve notificar o professor quando um aluno enviar uma solicitação de orientação.

RF40 - **Notificar Professor sobre Solicitação de Reunião:** O sistema deve notificar o professor quando um aluno solicitar uma reunião.

RF41 - **Notificar Professor sobre Resposta a Reunião Solicitada:** O sistema deve notificar o professor quando o aluno aceitar ou recusar uma solicitação de reunião feita pelo professor.

RF42 - **Notificar Professor sobre Entrega de Atividade:** O sistema deve notificar o professor quando um aluno realizar a entrega de uma atividade.

RF43 - **Notificar Professor sobre Comentário em Atividade:** O sistema deve notificar o professor quando um aluno registrar um comentário em uma atividade.

RF44 - **Expirar Solicitação de Orientação:** O sistema deve monitorar o prazo de resposta das solicitações de orientação e marcá-las automaticamente como "Não respondida" após 7 dias sem resposta do professor.

RF45 - **Notificar Aluno sobre Solicitação Não Respondida:** O sistema deve notificar o aluno quando sua solicitação de orientação for marcada como "Não respondida" por ausência de resposta do professor dentro do prazo.

RF46 - **Revisar Atividade:** O sistema deve permitir que o professor aceite ou recuse uma atividade com status em revisão. Em caso de aceitação o status é alterado para concluída. Em caso de recusa o status retorna para pendente e o controle volta ao aluno.

RF47 - **Notificar Professor sobre Atividade Aguardando Revisão:** O sistema deve notificar o professor quando uma atividade for submetida pelo aluno para revisão.

RF48 - **Notificar Aluno sobre Resultado da Revisão de Atividade:** O sistema deve notificar o aluno quando o professor aceitar ou recusar uma atividade em revisão.

RF49 - **Consultar Histórico de Orientações:** O sistema deve permitir que o aluno consulte as suas orientações encerradas e que o professor consulte as orientações que encerrou, exibindo a outra parte, as datas de início e de encerramento, o motivo do encerramento (RN33) e o tema do TCC congelado da orientação (RN12). Cada usuário vê somente as suas próprias orientações, da mais recente para a mais antiga e de forma paginada.

RF50 - **Visualizar Dashboard do Aluno:** O sistema deve permitir que o aluno visualize, como página inicial após o login, uma Dashboard com o resumo da sua orientação ativa: o tema do TCC, quando cadastrado, e o nome do professor orientador; o total de atividades e a quantidade por status (pendente, em andamento, em revisão e concluída); a quantidade de atividades atrasadas (RN37); o progresso geral (RN36); e as próximas atividades, ordenadas pelo prazo, em lista limitada a 5 itens com acesso à listagem completa (RN35). A Dashboard deve permitir abrir os detalhes de uma atividade e navegar para as demais funcionalidades da orientação. As próximas reuniões aceitas, com data e horário futuros, também são exibidas, a partir da entrega das reuniões. Sem orientação ativa, a Dashboard apresenta uma mensagem informativa, o status da última solicitação de orientação (pendente, recusada ou não respondida), o acesso à pesquisa de orientadores quando não houver solicitação pendente e, quando existirem orientações encerradas, o acesso ao histórico (RF49).

RF51 - **Visualizar Dashboard do Professor:** O sistema deve permitir que o professor visualize, como página inicial após o login, uma Dashboard com o resumo das suas orientações ativas: a quantidade de orientandos ativos; o total de atividades e a quantidade por status (pendente, em andamento, em revisão e concluída); a quantidade de atividades atrasadas (RN37) e de atividades aguardando revisão; o progresso geral (RN36); os orientandos que precisam de atenção, isto é, que têm ao menos uma atividade atrasada ou em revisão, priorizados conforme a RN38, com nome, tema do TCC (quando cadastrado) e as quantidades de atividades atrasadas e em revisão, em lista limitada a 5 itens com acesso à lista completa de orientandos; e os próximos prazos de atividades, com título, nome do orientando, prazo e status, em lista limitada a 5 itens. A Dashboard deve permitir acessar as atividades, os orientandos e as solicitações de orientação recebidas. As próximas reuniões aceitas, com data e horário futuros, também são exibidas, a partir da entrega das reuniões. Sem orientações ativas, a Dashboard apresenta um estado vazio informativo, sem indicadores que sugiram orientações ou atividades inexistentes.

RFADM01 - **Cadastrar Curso:** O sistema deve permitir que o admin cadastre um novo curso ao sistema.

RFADM02 - **Editar Curso:** O sistema deve permitir que o admin edite as informações de um curso.

RFADM03 - **Excluir Curso:** O sistema deve permitir que o admin exclua curso.

RFADM04 - **Cadastrar Área de Interesse:** O sistema deve permitir que o admin cadastre uma nova área de interesse.

RFADM05 - **Editar Área de Interesse:** O sistema deve permitir que o admin edite as informações de uma área de interesse.

RFADM06 - **Excluir Área de Interesse:** O sistema deve permitir que o admin exclua área de interesse.

RFADM07 - **Listar Usuários:** O sistema deve permitir que o admin visualize a lista de usuários cadastrados no sistema.

RFADM08 - **Excluir Usuário:** O sistema deve permitir que o admin exclua um usuário do sistema, por meio de exclusão lógica (RN19).
