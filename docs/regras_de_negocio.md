# Regras de Negócio

RN01 - **Unicidade de E-mail:** O e-mail utilizado no cadastro deve ser único no sistema, independente do tipo de usuário.

RN02 - **Confirmação de Senha na Alteração:** Para alterar a senha, o usuário deve confirmar sua senha atual antes de definir a nova, e a nova senha deve ser diferente da atual.

RN03 - **Validade do Link de Recuperação:** O link de redefinição de senha enviado por e-mail deve ter validade de tempo limitada, expirando após o prazo definido.

RN04 - **Unicidade de Orientador:** Um aluno pode ter no máximo um orientador ativo por vez.

RN05 - **Restrição de Solicitação de Orientação:** Um aluno só pode enviar uma solicitação de orientação se não possuir orientador ativo e não tiver nenhuma solicitação com status pendente. Depois de uma solicitação recusada ou não respondida, o aluno pode solicitar novamente, inclusive ao mesmo professor. O aluno não pode cancelar uma solicitação pendente.

RN06 - **Imutabilidade de Solicitação Respondida:** Uma solicitação de orientação não pode ser alterada após ser aceita ou recusada pelo professor.

RN07 - **Arquivamento de Atividades ao Encerrar Orientação:** Ao encerrar o vínculo de orientação, todas as atividades pendentes, em andamento e em revisão do aluno são arquivadas automaticamente pelo sistema.

RN08 - **Restrição de Solicitação de Reunião pelo Aluno:** O aluno só pode solicitar reunião com seu orientador ativo.

RN09 - **Edição de Reunião:** Uma reunião só pode ser editada pelo seu autor e somente enquanto ainda não tiver sido realizada, isto é, marcada como realizada pelo professor (RN43) ou com o horário já passado.

RN10 - **Cancelamento de Reunião:** Uma reunião pendente só pode ser cancelada pelo seu autor. Uma reunião aceita pode ser cancelada por qualquer das partes da orientação, o autor ou a outra parte, para o caso de imprevisto. Em ambos os casos o cancelamento só vale enquanto a reunião ainda não tiver sido realizada, exige um motivo e é definitivo. A outra parte de uma reunião pendente não a cancela: ela a recusa (RN11).

RN11 - **Justificativa de Recusa de Reunião:** A recusa de uma solicitação de reunião deve ser obrigatoriamente acompanhada de uma justificativa.

RN12 - **Pré-requisito para Cadastro de Tema:** O tema do TCC pertence à orientação: somente pode ser cadastrado e alterado enquanto a orientação estiver ativa, tanto pelo aluno quanto pelo seu orientador. Ao encerrar a orientação (RN30), o tema fica congelado e ninguém mais pode alterá-lo; uma nova orientação começa sem tema.

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

RN23 - **Cálculo de Compatibilidade:** A compatibilidade entre aluno e orientador é calculada com base no número de áreas de interesse em comum entre os perfis, utilizadas para filtrar e ordenar a lista de orientadores apresentada ao aluno: por padrão a lista só inclui professores com ao menos uma área em comum, e a opção "Mostrar todos" remove esse corte. Dentro de cada grupo de disponibilidade (RN26), quanto mais áreas em comum, mais acima o professor aparece.

RN24 - **Atividade Atrasada:** Uma atividade cujo prazo venceu, sem que esteja concluída nem arquivada, é exibida como "Atrasada". O prazo é uma data sem hora: a atividade passa a ser atrasada no dia seguinte ao prazo, pela data atual do servidor. Atrasada não é um status persistido: é uma indicação calculada pelo servidor a partir do prazo e do status, que a fornece junto de cada atividade e nas contagens da Dashboard (RN35, RN37). A atividade mantém o status original. O professor que criou a atividade pode editar o prazo (RN14).

RN25 - **Unicidade de Matrícula:** A matrícula deve ser única entre os alunos e única entre os professores.

RN26 - **Disponibilidade do Professor:** O professor indica em seu perfil se está disponível para orientar. Ele pode ter nenhum ou vários orientandos, conforme sua capacidade e disponibilidade, e é o próprio professor quem controla essa indicação. Um professor indisponível não recebe novas solicitações de orientação; solicitações já pendentes e orientações ativas não são afetadas. Na busca de orientadores, o aluno vê os professores disponíveis e indisponíveis, sempre com os disponíveis primeiro e só depois os indisponíveis; os indisponíveis continuam sem poder receber solicitações.

RN27 - **Encerramento de Sessões:** Ao redefinir ou alterar a senha de um usuário, e ao desativar a sua conta, todas as sessões ativas desse usuário são encerradas.

RN28 - **Orientadores do Curso do Aluno:** O aluno só visualiza, na lista de orientadores e em seus perfis, e só pode solicitar orientação a professores vinculados ao seu curso. O curso da lista é sempre o do aluno e não pode ser alterado por ele.

RN29 - **Funcionalidades Condicionadas à Orientação Ativa:** As funcionalidades que dependem de uma orientação ativa (para o aluno: tema do TCC, atividades e reuniões; para o professor: atividades e reuniões com orientandos) permanecem visíveis, porém desabilitadas, enquanto o aluno não tiver orientador ativo ou o professor não tiver orientandos ativos, com a explicação do motivo.

RN30 - **Encerramento de Orientação:** Somente o professor orientador pode encerrar uma orientação ativa; o aluno não pode. O encerramento é irreversível e exige confirmação explícita, com mensagem que deixe claro que a ação não pode ser desfeita e que as atividades em aberto serão arquivadas, que as reuniões pendentes ou aceitas ainda não realizadas serão canceladas e que o tema do TCC ficará congelado (RN07, RN12, RN34, RNF21).

RN31 - **Unicidade de Artigo Publicado:** Um usuário não pode ter dois artigos publicados com o mesmo título e o mesmo ano. A comparação ignora maiúsculas, acentos e espaços nas pontas; a URL não entra na comparação.

RN32 - **Perfis de Alunos Visíveis ao Professor:** O professor só visualiza o perfil de alunos que lhe enviaram uma solicitação de orientação, em qualquer status, ou que têm ou tiveram orientação com ele. Para qualquer outro aluno, ou para um aluno inativo, o sistema responde como se o perfil não existisse, sem revelar o motivo. O perfil nunca exibe e-mail nem matrícula.

RN33 - **Motivo do Encerramento de Orientação:** Ao encerrar uma orientação, o professor deve informar o motivo, em texto livre de 10 a 500 caracteres, sem contar espaços nas pontas. Sem o motivo, o encerramento não é realizado. O motivo fica registrado junto com a data do encerramento e é exibido ao aluno e ao professor na tela de relatório da orientação encerrada, aberta a partir do histórico (RF49), junto do tema congelado (RN12, RN30).

RN34 - **Cancelamento de Reuniões ao Encerrar Orientação:** Ao encerrar uma orientação, as reuniões pendentes ou aceitas dessa orientação que ainda não foram realizadas, isto é, com data e hora no futuro e não marcadas como realizadas (RN43), são canceladas automaticamente pelo sistema, junto com o arquivamento das atividades (RN07). O cancelamento fica registrado como feito pelo sistema, com a mensagem padrão "Esta reunião foi cancelada automaticamente pelo sistema porque a orientação foi encerrada.", exibida ao aluno e ao professor. As reuniões já realizadas, recusadas ou canceladas permanecem como estão, como histórico.

RN35 - **Cálculo dos Indicadores de Atividades:** Os indicadores da Dashboard consideram exclusivamente as atividades não arquivadas nem excluídas (RF27) das orientações ativas, contadas pelo status persistido: pendente, em andamento, em revisão e concluída. As atividades arquivadas (RN07), as excluídas e as de orientações encerradas não participam. Para o professor, os indicadores somam as atividades de todos os seus orientandos ativos; para o aluno, só as da sua orientação ativa.

RN36 - **Cálculo do Progresso Geral:** O progresso geral é a proporção entre as atividades concluídas e o total de atividades não arquivadas nem excluídas: (concluídas ÷ total) × 100. O resultado é apresentado em percentual inteiro, truncado, de modo que nunca indique 100% enquanto houver atividade não concluída. Sem atividades a contabilizar, o sistema apresenta um estado informativo de ausência de atividades, sem divisão por zero e sem percentual. Como o status concluída é definitivo (RN15), o progresso nunca regride por reversão de conclusão.

RN37 - **Identificação de Atividades Atrasadas na Dashboard:** A identificação de atividades atrasadas segue integralmente a RN24: o prazo venceu, o status é diferente de concluída e a atividade não está arquivada. Atrasada é uma indicação calculada, não um status persistido, e a atividade continua exibindo o status original, acompanhado da indicação visual de atraso.

RN38 - **Priorização dos Orientandos que Precisam de Atenção:** Na Dashboard do professor, um orientando precisa de atenção quando possui ao menos uma atividade atrasada ou ao menos uma atividade em revisão. A lista prioriza quem tem mais atividades atrasadas; em caso de empate, quem tem mais atividades em revisão; persistindo o empate, o nome em ordem alfabética. A classificação é informativa e não altera o status das atividades nem das orientações.

RN39 - **Edição de Reunião Aceita:** Quando o autor altera a data, a hora de início ou a hora de término de uma reunião aceita, ela volta ao status pendente e a outra parte precisa aceitá-la de novo, porque aceitou outro horário. Alterar apenas a descrição mantém o status. Só o autor edita (RN09).

RN40 - **Justificativa de Recusa de Revisão:** A recusa de uma atividade em revisão deve ser obrigatoriamente acompanhada de uma justificativa, de 1 a 500 caracteres, que o aluno e o professor veem no histórico de revisões da atividade. O aceite não tem justificativa.

RN41 - **Proposta de Tema:** A proposta de tema é um título de 5 a 150 caracteres, sem contar espaços nas pontas, que o professor registra para oferecer a alunos um trabalho que ele deseja orientar. Cada professor tem no máximo 50 propostas e não pode ter duas com o mesmo título, comparando sem diferenciar maiúsculas, acentos e espaços nas pontas. A proposta é só informativa: não se vincula à solicitação de orientação nem ao tema do TCC (RN12), e quem se interessa envia a solicitação normal (RN04, RN05). Não tem status: quando deixa de valer, o professor a remove.

RN42 - **Visibilidade das Propostas de Tema:** Só o professor cadastra, edita e remove suas propostas. O aluno as vê somente no perfil de um professor do seu curso (RN28), em leitura, e a seção não aparece para ele quando o professor não tem propostas. As propostas continuam visíveis para o aluno mesmo com o professor indisponível (RN26), junto do aviso de indisponibilidade do perfil, e não entram na busca de orientadores nem na compatibilidade (RN23).

RN43 - **Marcação de Reunião como Realizada:** Só o professor orientador, com a orientação ativa (RN29), marca como realizada uma reunião aceita cujo horário ainda não passou; o aluno não marca, e reuniões pendentes, recusadas ou canceladas não são marcadas. A marcação é irreversível, exige confirmação explícita e registra o momento e o autor. A reunião marcada é realizada para todos os efeitos: não pode mais ser editada nem cancelada (RN09, RN10), sai das próximas reuniões dos dashboards (RF50, RF51) e não é cancelada ao encerrar a orientação (RN34) nem ao desativar o usuário (RN19). A reunião aceita com horário passado continua realizada sem precisar de marcação, e a ação de marcar só é oferecida enquanto o horário não passou. A marcação não gera notificação.

RN44 - **Apontamentos da Reunião:** Os apontamentos são um texto livre e opcional de até 3000 caracteres, sem contar espaços nas pontas, que só existe para uma reunião realizada, seja marcada pelo professor (RN43) ou pelo horário passado. Só o professor orientador adiciona, edita e remove os apontamentos, e apenas enquanto a orientação estiver ativa: ao encerrá-la, os apontamentos ficam congelados, como o tema do TCC (RN12). O aluno orientando os vê, em leitura. O professor pode marcar a reunião como realizada sem escrever apontamentos e escrevê-los depois. Adicionar ou alterar apontamentos não gera notificação.

RN45 - **Intervalo da Reunião:** Toda reunião tem uma hora de início e uma hora de término, ambas obrigatórias ao solicitar e ao editar. O término deve ser depois do início e no mesmo dia, sem duração mínima nem máxima. Não há regra de conflito: duas reuniões do mesmo usuário podem se sobrepor. A reunião realizada continua definida pelo horário de início (RN43), não pelo de término. As reuniões criadas antes desse campo receberam o término uma hora depois do início.

RN46 - **Preferências do Calendário de Reuniões:** O calendário de reuniões abre sempre no dia de hoje, com todos os orientandos e todas as situações ligados. Só a visão escolhida (Dia, Semana ou Mês) fica salva no navegador do usuário, de forma automática e sem pedir permissão, separada por usuário. Sem preferência salva, a visão é o Mês.
