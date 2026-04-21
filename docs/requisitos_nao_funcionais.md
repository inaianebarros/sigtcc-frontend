# Requisitos Não Funcionais

## Usabilidade

RNF01 - **Interface Responsivas:** O sistema deve ser acessível e funcional em dispositivos móveis e desktops, adaptando seu loyout ao tamanho da tela.

RNF02 - **Feedback de Ações:** O sistema deve fornecer feedback visual ao usuário após a execução de ações, como confirmações, erros e carregamentos.

## Desempenho

RNF03 - **Tempo de Resposta:** O sistema deve responder às requisições do usuário em até 3 segundos em condições normais de uso.

RNF04 - **Entrega de Notificações:** O sistema deve entregar notificações ao usuário em até 1 minuto após o evento que a originou.

## Segurança

RNF05 - **Criptografia de Senha:** As senhas dos usuários devem ser armazenadas de forma criptografada, não sendo possivel recuperar o valor original.

RNF06 - **Controle de Acesso:** O sistema deve garantir que cada usuário acesse apenas as funcionalidades e dados correspondentes do perfil.

RNF07 - **Expiração de Sessão:** A sessão do usuário deve experir automaticamente após um periodo de inatividade.

RNF08 - **Validade do Link de Recuperação:** O link de recuperação de senha deve expirar em até 1 hora após seu envio.

## Confiabilidade

RNF09 - **Disponibilidade:** O sistema deve estar disponível pelo menos 95% do tempo em horário comercial.

RNF10 - **Integridade dos Dados**: O sistema deve garantir que nenhuma ação do usuário resulte em perda ou corrução de dados, utilizando transações no banco de dados onde necessário.

## Manutenibilidade

RNF11 - **Registro de Erros:** O sistema deve registrar erros e execuções em logs para facilitar a indentificação e correção de problemas.

## Implementação

RNF12 - **Linguagem de Frontend:** O frontend do sistema deve ser desenvolvido utilizando Typescript.

RNF13 - **Biblioteca de Componentes do Frontend:** Os componentes de interface do sistema devem ser desenvolvidos utilizando React em conjunto com a biblioteca Material UI.

RNF14 - **Linguagem Backend:** O backend do sistema deve ser desenvolvido utilizando Python.

RNF15 - **Framework do Backend:** O backend do sistema deve ser desenvolvido utilizando o framework Django Ninja Extra.

RNF16 - **Banco de Dados:** O sistema deve utilizar PostgreSQL como sistema gerenciador de banco de dados.

**RNF17 - Tema de Interface:** O sistema deve utilizar o tema padrão do Material UI como base visual da interface, sem customizações de paleta de cores.

## Usabilidade

**RNF18 - Consistência Visual:** A interface do sistema deve seguir os padrões de componentes e espaçamento do Material UI, mantendo consistência visual entre todas as telas.

**RNF19 - Feedback de Ações:** O sistema deve fornecer feedback visual para todas as ações do usuário, incluindo estados de carregamento, sucesso e erro.

**RNF20 - Mensagens de Erro Inline:** Erros de validação de formulários devem ser exibidos diretamente nos campos correspondentes, sem uso de alertas ou popups.

**RNF21 - Confirmação de Ações Destrutivas:** Ações irreversíveis ou de alto impacto, como encerramento de orientação e exclusão de registros, devem exigir confirmação explícita do usuário antes de serem executadas.

**RNF22 - Estados Vazios:** O sistema deve apresentar mensagens informativas quando listagens não possuírem dados a exibir.

**RNF23 - Contraste de Interface:** Os elementos visuais da interface devem seguir uma razão mínima de contraste de 4.5:1 entre texto e fundo, conforme diretrizes WCAG 2.1 nível AA.

**RNF24 - Responsividade:** A interface do sistema deve ser responsiva, adaptando seu layout para diferentes tamanhos de tela com base nos breakpoints do Material UI.
