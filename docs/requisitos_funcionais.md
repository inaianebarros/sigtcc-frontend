# Requisitos Funcionais

RF01 - **Cadastrar Aluno:** O sistema deve permitir que o aluno faça cadastro informando, na ordem: Matrícula, Nome Completo, E-mail, Senha, Confirmação de Senha, Tipo de Conta, Instituto, Curso e Áreas de Interesse (ao menos uma).

RF02 - **Cadastrar Professor:** O sistema deve permitir que o professor faça cadastro informando, na ordem: Matrícula, Nome Completo, E-mail, Senha, Confirmação de Senha, Tipo de Conta, Instituto, Curso(s) e Áreas de Interesse (ao menos uma).

RF03 - **Realizar Login:** O sistema deve permitir que usuários cadastrados realizem o login utilizando e-mail e senha, concedendo acesso às funcionalidades de acordo com seu perfil.

RF04 - **Editar Perfil do Aluno:** O sistema deve permitir que o aluno edite suas informações de perfil, como nome, áreas de interesse (ao menos uma deve permanecer cadastrada) e artigos publicados.

RF05 - **Editar Perfil do Professor:** O sistema deve permitir que o professor edite suas informações de perfil, como nome, cursos (um ou mais), áreas de interesse (ao menos uma deve permanecer cadastrada) e artigos publicados. O professor também informa se está disponível para orientar.

RF06 - **Alterar Senha:** O sistema deve permitir que o usuário altere sua senha mediante confirmação da senha atual.

RF07 - **Recuperar Senha:** O sistema deve permitir que usuários recuperem o acesso à sua conta por meio de um link de redefinição de senha enviado ao e-mail cadastrado, com validade de tempo limitado.

RF08 - **Realizar Log Out:** O sistema deve permitir que o usuário encerre sua sessão com segurança.

RF09 - **Pesquisar e Visualizar Orientadores Compatíveis:** O sistema deve apresentar ao aluno uma lista de orientadores ordenada pela compatibilidade entre as áreas de interesse cadastradas pelo aluno e as áreas de interesse cadastradas por cada orientador, limitada aos professores vinculados ao curso do aluno (RN28) e permitindo, adicionalmente, a filtragem por nome (RNF26). Cada professor é exibido com sua disponibilidade para orientar.

RF10 - **Visualizar Perfil do Professor:** O sistema deve permitir que o aluno visualize as informações sobre o professor como: nome, cursos, áreas de interesse e artigos publicados. A disponibilidade para orientar também é exibida.

RF11 - **Visualizar Perfil do Aluno:** O sistema deve permitir que o professor visualize as informações do aluno, como nome, curso, áreas de interesse e artigos publicados, limitado aos alunos com os quais tem vínculo de orientação (RN32).

RF12 - **Solicitar Orientador:** O sistema deve permitir que o aluno que não possua orientador e não tenha nenhuma solicitação em andamento envie pedido de orientação para um professor cadastrado, selecionado a partir da lista de orientadores apresentada no sistema. Não é possível solicitar a um professor indisponível nem a um professor que não seja vinculado ao curso do aluno (RN28).

RF13 - **Listar Solicitações de Alunos:** O sistema deve permitir que o professor visualize todas as solicitações de orientação recebidas, incluindo as com status não respondida.

RF14 - **Responder Solicitação de Aluno:** O sistema deve permitir que o professor aceite ou recuse solicitações de orientação enviadas por aluno. A recusa não exige justificativa.

RF15 - **Encerrar Orientação:** O sistema deve permitir que o professor encerre o vínculo de orientação com um aluno. Somente o professor orientador pode encerrá-la (RN30), informando o motivo do encerramento (RN33).

RF16 - **Visualizar Status da Solicitação:** O sistema deve permitir que o aluno visualize o status (pendente, aceita, recusada ou não respondida) de sua solicitação de orientação.

RF17 - **Solicitar Reunião com Orientador:** O sistema deve permitir que o aluno solicite reuniões com seu orientador, informando data, hora e descrição.

RF18 - **Solicitar Reunião com Aluno:** O sistema deve permitir que o professor solicite reuniões, informando data, hora, descrição e aluno.

RF19 - **Visualizar Reuniões:** O sistema deve permitir que o usuário visualize a lista de reuniões agendadas.

RF20 - **Responder Solicitação de Reunião:** O sistema deve permitir que o usuário aceite ou recuse solicitações de reunião. Em caso de recusa é necessário adicionar a justificativa.

RF21 - **Editar Reunião:** O sistema deve permitir que reuniões sejam editadas pelo autor das solicitações, desde que ainda não realizadas.

RF22 - **Cancelar Reunião:** O sistema deve permitir que o autor da solicitação cancele uma reunião ainda não realizada.

RF23 - **Cadastrar Tema do TCC:** O sistema deve permitir que o **aluno** ou o **professor** cadastre o tema do TCC após a aceitação da solicitação de orientação.

RF24 - **Alterar Tema do TCC:** O sistema deve permitir que o aluno e o professor alterem o tema do TCC.

RF25 - **Criar Atividade:** O sistema deve permitir que o professor crie atividades relacionadas ao TCC para seus orientados, informando título, descrição e prazo.

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

RF49 - **Consultar Histórico de Orientações:** O sistema deve permitir que o aluno consulte as suas orientações encerradas e que o professor consulte as orientações que encerrou, exibindo a outra parte, as datas de início e de encerramento e o motivo do encerramento (RN33). Cada usuário vê somente as suas próprias orientações, da mais recente para a mais antiga e de forma paginada.

RFADM01 - **Cadastrar Curso:** O sistema deve permitir que o admin cadastre um novo curso ao sistema.

RFADM02 - **Editar Curso:** O sistema deve permitir que o admin edite as informações de um curso.

RFADM03 - **Excluir Curso:** O sistema deve permitir que o admin exclua curso.

RFADM04 - **Cadastrar Área de Interesse:** O sistema deve permitir que o admin cadastre uma nova área de interesse.

RFADM05 - **Editar Área de Interesse:** O sistema deve permitir que o admin edite as informações de uma área de interesse.

RFADM06 - **Excluir Área de Interesse:** O sistema deve permitir que o admin exclua área de interesse.

RFADM07 - **Listar Usuários:** O sistema deve permitir que o admin visualize a lista de usuários cadastrados no sistema.

RFADM08 - **Excluir Usuário:** O sistema deve permitir que o admin exclua um usuário do sistema, por meio de exclusão lógica (RN19).
