# Regras de Negócio

RN01 - Unicidade de E-mail: O e-mail utilizado no cadastro deve ser único no sistema, independente do tipo de usuário.

RN02 - Confirmação de Senha na Alteração: Para alterar a senha, o usuário deve confirmar sua senha atual antes de definir a nova.

RN03 - Validade do Link de Recuperação: O link de redefinição de senha enviado por e-mail deve ter validade de tempo limitada, expirando após o prazo definido.

RN04 - Unicidade de Orientador: Um aluno pode ter no máximo um orientador ativo por vez.

RN05 - Restrição de Solicitação de Orientação: Um aluno só pode enviar uma solicitação de orientação se não possuir orientador ativo e não tiver nenhuma solicitação com status pendente.

RN06 - Imutabilidade de Solicitação Respondida: Uma solicitação de orientação não pode ser alterada após ser aceita ou recusada pelo professor.

RN07 - Arquivamento de Atividades ao Encerrar Orientação: Ao encerrar o vínculo de orientação, todas as atividades pendentes e em andamento do aluno são arquivadas automaticamente pelo sistema.

RN08 - Restrição de Solicitação de Reunião pelo Aluno: O aluno só pode solicitar reunião com seu orientador ativo.

RN09 - Edição de Reunião: Uma reunião só pode ser editada pelo seu autor e somente enquanto ainda não tiver sido realizada.

RN10 - Cancelamento de Reunião: Uma reunião só pode ser cancelada pelo seu autor e somente enquanto ainda não tiver sido realizada.

RN11 - Justificativa de Recusa de Reunião: A recusa de uma solicitação de reunião deve ser obrigatoriamente acompanhada de uma justificativa.

RN12 - Pré-requisito para Cadastro de Tema: O aluno somente pode cadastrar o tema do TCC após ter um orientador ativo.

RN13 - Vínculo de Atividade ao Orientado: O professor só pode criar atividades para alunos sob sua orientação ativa.

RN14 - Restrição de Edição de Atividade: Somente o professor que criou a atividade pode editá-la ou excluí-la.

RN15 - Progressão de Status de Atividade: O status da atividade segue o fluxo: pendente → em andamento → revisão → concluída. O aluno pode transitar livremente entre pendente e em andamento. Ao submeter para revisão, o aluno perde o controle sobre o status. Se o professor recusar na revisão, o status retorna para pendente e o aluno retoma o controle. O status concluída é definitivo e não pode ser revertido por nenhum dos usuários.

RN16 - Entrega de Atividade: O aluno só pode submeter a entrega de uma atividade quando seu status for pendente ou em andamento.

RN17 - Exclusão de Curso em Uso: Um curso não pode ser excluído enquanto houver usuários vinculados a ele.

RN18 - Exclusão de Área de Interesse em Uso: Uma área de interesse não pode ser excluída enquanto houver usuários ou atividades vinculadas a ela.

RN19 - Exclusão de Usuário: A exclusão de um usuário deve encerrar todos os vínculos ativos relacionados a ele, como orientações e atividades em andamento.

RN20 - Prazo de Resposta de Solicitação de Orientação: O professor tem 7 dias corridos para responder uma solicitação de orientação. Após esse prazo sem resposta, o sistema marca automaticamente a solicitação como "Não respondida", notifica o aluno e o libera para enviar uma nova solicitação.

RN21 - Revisão de Atividade: Somente o orientador ativo do aluno pode revisar uma atividade. A revisão só é possível quando a atividade estiver com status em revisão.
