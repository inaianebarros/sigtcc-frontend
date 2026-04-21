# Requisitos Funcionais

RF01 - **Cadastrar Aluno**: O sistema deve permitir que o aluno faça cadastro informando, na ordem: Matrícula, Nome Completo, Email, Senha, Confirmação de Senha, Tipo de Conta, Instituto e Curso.

RF02- **Cadastrar Professor**: O sistema deve permitir que o professor faça cadastro informando , na ordem: Matrícula, Nome Completo, Email, Senha, Confirmação de Senha, Tipo de Conta, Instituto e Curso(s).

RF03 - **Realizar Login:** O sistema deve permitir que usuários cadastrados realizem o login utilizando e-mail e senha, concedendo acesso às funcionalidades de acordo com seu perfil.

RF04 - **Edital Perfil do Aluno:** O sistema deve permitir que o aluno edite suas informações de perfil, como nome, áreas de interesse e artigos publicados

RF05 - **Editar** **Perfil do Professor**: O sistema deve permitir que o professor edite suas informações de perfil, como nome, cursos (um ou mais), áreas de interesse e artigos publicados.

RF06 - **Alterar Senha:** O sistema deve permitir que o usuário altere sua senha mediante confirmação da senha atual.

RF07 - **Recuperar Senha:** O sistema deve permitir que usuários recuperem o acesso à sua conta por meio de um link de redefinição de senha enviado ao e-mail cadastrado, com validade de tempo limitado.

RF08 - **Realizar Log Out:** O sistema deve permitir que o usuário encerre sua sessão com segurança.

RF09 - **Buscar Orientador:** O sistema deve permitir que o aluno busque orientadores com base nos critérios como: nome e áreas de interesse.

RF10 - **Visualizar Perfil do Professor:** O sistema deve permitir que o aluno visualize as informações sobre o professor como: nome, cursos, áreas de interesse e artigos publicados.

RF11 - **Visualizar Perfil do Aluno**: O sistema deve permitir que o professor visualize as informações do aluno, como nome, curso e áreas de interesse.

RF12 - **Solicitar Orientador:** O sistema deve permitir que o aluno que não possua orientador e não tenha nenhuma solicitação em andamento, envie pedido de orientação para um professor cadastrado.

RF13 - **Listar Solicitações de Alunos:** O sistema deve permitir que o professor visualize todas as solicitações de orientação recebidas, incluindo as com status não respondida.

RF14 - **Responder Solicitação de Aluno:** O sistema deve permitir que o professor aceite ou recuse solicitações de orientação enviadas por aluno.

RF15 - **Encerrar Orientação:** O sistema deve permitir que o professor encerre o vínculo de orientação com um aluno.

RF16 - **Visualizar Status da Solicitação:** O sistema deve permitir que o aluno visualize o status (pendente, aceito, recusado ou não respondida) de sua solicitação de orientação.

RF17 - **Solicitar Reunião com Orientador**: O sistema deve permitir que o aluno solicite reuniões com seu orientador, informando data, hora e descrição.

RF18 - **Solicitar Reunião com Aluno:** O sistema deve permitir que o professor solicite reuniões, informando data, hora, descrição e aluno.

RF19 - **Visualizar Reuniões:** O sistema deve permitir que o usuário visualize a lista de reuniões agendadas.

RF20 - **Responder Solicitação de Reunião:** O sistema deve permitir que o usuário aceite ou recuse solicitações de reunião. Em caso de recusa é necessário adicionar a justificativa.

RF21 - **Editar Reunião:** O sistema deve permitir que reuniões sejam editadas pelo autor das solicitações, desde que ainda não realizadas.

RF22 - **Cancelar Reunião:** O sistema deve permitir que o autor da solicitação cancele uma reunião ainda não realizada.

RF23 - **Cadastrar tema do TCC:** O sistema deve permitir que o professor cadastre o tema do TCC após a aceitação do orientação.

RF24 - **Alterar Tema do TCC:** O sistema deve permitir que o professor altere o tema do TCC.

RF25 - **Criar Atividade:** O sistema deve permitir que o professor crie atividades relacionadas ao TCC para seus orientados.

RF26 - **Editar Atividade:** O sistema deve permitir que o professor edite atividades previamente cadastradas.

RF27 - **Deletar Atividade:** O sistema deve permitir que o professor exclua atividades cadastradas.

RF28 - Alterar Status da Atividade: O sistema deve permitir que o aluno altere o status da atividade entre pendente e em andamento, e submeta a atividade para revisão do orientador, desde que haja ao menos uma entrega anexada.

RF29 - **Listar Atividades:** O sistema deve permitir que aluno e professor visualize a lista de atividades vinculadas ao TCC.

RF30 - **Visualizar Detalhes da Atividade:** O sistema deve permitir que o usuário visualize os detalhes de uma atividade especifica.

RF31 - **Entregar Atividade:** O sistema deve permitir que o aluno submeta a entrega de uma atividade, sendo possível anexar arquivos.

RF32 - **Comentar Atividade:** O sistema deve permitir que aluno e professor adicionem comentários nas atividades para acompanhamento e feedback.

RF33 - **Listar Orientados:** O sistema deve permitir que o professor visualize a lista de alunos sob sua orientação.

RF34 - **Notificar Aluno sobre Resposta de Solicitação de Orientação**: O sistema deve notificar o aluno quando o professor aceitar ou recusar sua solicitação de orientação.

RF35 - **Notificar Aluno sobre Nova Atividade**: O sistema deve notificar o aluno quando o professor solicitar uma nova atividade.

RF36 - **Notificar Aluno sobre Comentário em Atividade**: O sistema deve notificar o aluno quando o professor registrar um comentário em uma de suas atividades.

RF37 - **Notificar Aluno sobre Reunião Agendada pelo Professor**: O sistema deve notificar o aluno quando o professor marcar uma reunião.

RF38 - **Notificar Aluno sobre Resposta a Reunião Solicitada**: O sistema deve notificar o aluno quando o professor aceitar ou recusar uma solicitação de reunião feita pelo aluno.

RF39 - **Notificar Professor sobre Nova Solicitação de Orientação**: O sistema deve notificar o professor quando um aluno enviar uma solicitação de orientação.

RF40 - **Notificar Professor sobre Solicitação de Reunião**: O sistema deve notificar o professor quando um aluno solicitar uma reunião.

RF41 - **Notificar Professor sobre Resposta a Reunião Solicitada**: O sistema deve notificar o professor quando o aluno aceitar ou recusar uma solicitação de reunião feita pelo professor.

RF42 - **Notificar Professor sobre Entrega de Atividade**: O sistema deve notificar o professor quando um aluno realizar a entrega de uma atividade.

RF43 - **Notificar Professor sobre Comentário em Atividade**: O sistema deve notificar o professor quando um aluno registrar um comentário em uma atividade.

_RF44 - Expirar Solicitação de Orientação: O sistema deve monitorar o prazo de resposta das solicitações de orientação e marcá-las automaticamente como "Não respondida" após 7 dias sem resposta do professor._

_RF45 - Notificar Aluno sobre Solicitação Não Respondida: O sistema deve notificar o aluno quando sua solicitação de orientação for marcada como "Não respondida" por ausência de resposta do professor dentro do prazo._

_RF46 - Revisar Atividade: O sistema deve permitir que o professor aceite ou recuse uma atividade com status em revisão. Em caso de aceitação o status é alterado para concluída. Em caso de recusa o status retorna para pendente e o controle volta ao aluno._

_RF47 - Notificar Professor sobre Atividade Aguardando Revisão: O sistema deve notificar o professor quando uma atividade for submetida pelo aluno para revisão._

_RF48 - Notificar Aluno sobre Resultado da Revisão de Atividade: O sistema deve notificar o aluno quando o professor aceitar ou recusar uma atividade em revisão._

RFADM01 - **Cadastrar Curso**: O sistema deve permitir que o admin cadastre um novo curso ao sistema.

RFADM02 - **Editar Curso**: O sistema deve permitir que o admin edite as informações de um curso.

RFADM03 - **Excluir Curso**: O sistema deve permitir que o admin exclua curso.

RFADM04 - **Cadastrar Área de Interesse**: O sistema deve permitir que o admin cadastre uma nova área de interesse.

RFADM05 - **Editar Área de Interesse**: O sistema deve permitir que o admin edite as informações de uma área de interesse.

RFADM06 - **Excluir Área de Interesse**: O sistema deve permitir que o admin exclua área de interesse.

RFADM07 - **Listar Usuários**: O sistema deve permitir que o admin visualize a lista de usuários cadastrados no sistema.

RFADM08 - **Excluir Usuário**: O sistema deve permitir que o admin exclua um usuário do sistema.
