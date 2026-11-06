# Regras de Negócio

RN01 - **Unicidade de E-mail:** O e-mail utilizado no cadastro deve ser único no sistema, independente do tipo de usuário.

RN02 - **Confirmação de Senha na Alteração:** Para alterar a senha, o usuário deve confirmar sua senha atual antes de definir a nova, e a nova senha deve ser diferente da atual.

RN03 - **Validade do Link de Recuperação:** O link de redefinição de senha enviado por e-mail deve ter validade de tempo limitada, expirando após o prazo definido.

RN04 - **Unicidade de Orientador:** Um aluno pode ter no máximo um orientador ativo por vez.

RN05 - **Restrição de Solicitação de Orientação:** Um aluno só pode enviar uma solicitação de orientação se não possuir orientador ativo e não tiver nenhuma solicitação com status pendente. Depois de uma solicitação recusada ou não respondida, o aluno pode solicitar novamente, inclusive ao mesmo professor. O aluno não pode cancelar uma solicitação pendente.

RN06 - **Imutabilidade de Solicitação Respondida:** Uma solicitação de orientação não pode ser alterada após ser aceita ou recusada pelo professor.

RN07 - **Arquivamento de Atividades ao Encerrar Orientação:** Ao encerrar o vínculo de orientação, todas as atividades pendentes, em andamento e em revisão do aluno são arquivadas automaticamente pelo sistema.

RN08 - **Restrição de Solicitação de Reunião pelo Aluno:** O aluno só pode solicitar reunião com seu orientador ativo.

RN09 - **Edição de Reunião:** Uma reunião só pode ser editada pelo seu autor e somente enquanto ainda não tiver sido realizada.

RN10 - **Cancelamento de Reunião:** Uma reunião só pode ser cancelada pelo seu autor e somente enquanto ainda não tiver sido realizada.

RN11 - **Justificativa de Recusa de Reunião:** A recusa de uma solicitação de reunião deve ser obrigatoriamente acompanhada de uma justificativa.

RN12 - **Pré-requisito para Cadastro de Tema:** O tema do TCC somente pode ser cadastrado após o aluno ter um orientador ativo, e pode ser cadastrado e alterado tanto pelo aluno quanto pelo seu orientador.

RN13 - **Vínculo de Atividade ao Orientado:** O professor só pode criar atividades para alunos sob sua orientação ativa.

RN14 - **Restrição de Edição de Atividade:** Somente o professor que criou a atividade pode editá-la ou excluí-la.

RN15 - **Progressão de Status de Atividade:** O status da atividade segue o fluxo: pendente → em andamento → em revisão → concluída. O aluno pode transitar livremente entre pendente e em andamento. Ao submeter para revisão, o aluno perde o controle sobre o status. Se o professor recusar na revisão, o status retorna para pendente e o aluno retoma o controle. O status concluída é definitivo e não pode ser revertido por nenhum dos usuários.

RN16 - **Entrega de Atividade:** O aluno só pode submeter a entrega de uma atividade quando seu status for pendente ou em andamento.

RN17 - **Exclusão de Curso em Uso:** Um curso não pode ser excluído enquanto houver usuários vinculados a ele.

RN18 - **Exclusão de Área de Interesse em Uso:** Uma área de interesse não pode ser excluída enquanto houver usuários vinculados a ela.

RN19 - **Exclusão de Usuário:** A exclusão de um usuário é lógica (desativação da conta, preservando o histórico) e deve encerrar todos os vínculos ativos relacionados a ele, como orientações, atividades em andamento e sessões ativas (RN27).

RN20 - **Prazo de Resposta de Solicitação de Orientação:** O professor tem 7 dias corridos para responder uma solicitação de orientação. Após esse prazo sem resposta, o sistema marca automaticamente a solicitação como "Não respondida", notifica o aluno e o libera para enviar uma nova solicitação. Enquanto essa marcação não for gravada, o sistema já trata como "Não respondida" a solicitação pendente com mais de 7 dias, em todas as consultas e validações.

RN21 - **Revisão de Atividade:** Somente o orientador ativo do aluno pode revisar uma atividade. A revisão só é possível quando a atividade estiver com status em revisão.

RN22 - **Áreas de Interesse Obrigatórias:** Todo aluno e todo professor deve ter ao menos uma área de interesse cadastrada, informada no cadastro e mantida ao editar o perfil (não é possível remover a última). O cálculo de compatibilidade depende das áreas cadastradas no perfil de ambos.

RN23 - **Cálculo de Compatibilidade:** A compatibilidade entre aluno e orientador é calculada com base no número de áreas de interesse em comum entre os perfis, utilizadas para ordenar a lista de orientadores apresentada ao aluno.

RN24 - **Atividade Atrasada:** Uma atividade cujo prazo venceu sem que esteja concluída é exibida como "Atrasada". Atrasada não é um status persistido: é uma indicação calculada a partir do prazo e do status, e pode ser feita no frontend. O professor que criou a atividade pode editar o prazo (RN14).

RN25 - **Unicidade de Matrícula:** A matrícula deve ser única entre os alunos e única entre os professores.

RN26 - **Disponibilidade do Professor:** O professor indica em seu perfil se está disponível para orientar. Ele pode ter nenhum ou vários orientandos, conforme sua capacidade e disponibilidade, e é o próprio professor quem controla essa indicação. Um professor indisponível não recebe novas solicitações de orientação; solicitações já pendentes e orientações ativas não são afetadas.

RN27 - **Encerramento de Sessões:** Ao redefinir ou alterar a senha de um usuário, e ao desativar a sua conta, todas as sessões ativas desse usuário são encerradas.

RN28 - **Orientadores do Curso do Aluno:** O aluno só visualiza, na lista de orientadores e em seus perfis, e só pode solicitar orientação a professores vinculados ao seu curso. O curso da lista é sempre o do aluno e não pode ser alterado por ele.

RN29 - **Funcionalidades Condicionadas à Orientação Ativa:** As funcionalidades que dependem de uma orientação ativa (para o aluno: tema do TCC, atividades e reuniões; para o professor: atividades e reuniões com orientandos) permanecem visíveis, porém desabilitadas, enquanto o aluno não tiver orientador ativo ou o professor não tiver orientandos ativos, com a explicação do motivo.

RN30 - **Encerramento de Orientação:** Somente o professor orientador pode encerrar uma orientação ativa; o aluno não pode. O encerramento é irreversível e exige confirmação explícita, com mensagem que deixe claro que a ação não pode ser desfeita e que as atividades em aberto serão arquivadas (RN07, RNF21).

RN31 - **Unicidade de Artigo Publicado:** Um usuário não pode ter dois artigos publicados com o mesmo título e o mesmo ano. A comparação ignora maiúsculas, acentos e espaços nas pontas; a URL não entra na comparação.

RN32 - **Perfis de Alunos Visíveis ao Professor:** O professor só visualiza o perfil de alunos que lhe enviaram uma solicitação de orientação, em qualquer status, ou que têm ou tiveram orientação com ele. Para qualquer outro aluno, ou para um aluno inativo, o sistema responde como se o perfil não existisse, sem revelar o motivo. O perfil nunca exibe e-mail nem matrícula.
