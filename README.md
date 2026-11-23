# GeoColeta PWA - protótipo acadêmico

Protótipo em React do fluxo offline do GeoColeta. Esta versão acadêmica usa Supabase Auth e um banco próprio com 240 lotes autorizados do projeto REURB Rosário Oeste 2026. Não se conecta às APIs nem aos ambientes privados da WCOGEO.

## Problema demonstrado

A coleta em campo pode acontecer em locais com conexão instável ou inexistente. O protótipo mostra como preparar lotes antes da saída, registrar uma coleta sem internet e sincronizar as pendências quando a conexão retornar.

## Funcionalidades

- instalação como PWA por meio de manifest e service worker;
- autenticação real pelo Supabase e sessão mantida para continuidade offline;
- perfis vinculados a projeto e permissão, incluindo `PREFEITURA_USUARIO` e `WCOGEO_ADMIN`;
- cache da aplicação e das fontes para abertura offline;
- carregamento de 240 lotes do projeto e preparação seletiva para uso offline;
- início da coleta online sem preparação manual prévia: os dados do lote e o rascunho são gravados juntos no dispositivo antes de abrir o formulário;
- formulário de coleta completo com rascunho automático e persistência no IndexedDB;
- CPF e CNPJ com máscara e validação dos dígitos verificadores;
- dados do cônjuge obrigatórios para casado e opcionais para união estável;
- telefone fixo, nome do pai, observação e início da moradia opcionais;
- pergunta sobre posse de CNH, exigindo o número somente quando a resposta for positiva;
- anexo local de imagem ou PDF para pendência judicial;
- fila de pendências com preservação de falhas e nova tentativa;
- sincronização transacional com o Supabase, atualizando a coleta e o status do lote juntos;
- recuperação das coletas sincronizadas no próximo acesso conectado, inclusive em outro dispositivo;
- painel de validação por perfil, com filtros por bairro e status e consulta completa do formulário;
- devolução e reabertura de coletas validadas para correção, com motivo obrigatório apresentado ao coletor;
- prevenção de duplicidade por vínculo único entre projeto e lote;
- indicadores de conexão e de sincronização;
- estados da coleta independentes da sincronização: Aguardando consulta, Ativo, Pausado, Finalizado, Validado e Correção solicitada;
- pausa e retomada de rascunhos, incluindo depois de reabrir a aplicação offline;
- consulta de formulários finalizados e reabertura explícita para edição, mantendo o identificador do registro;
- bloqueio de edição de coletas validadas até a reabertura por um revisor autorizado;
- interface responsiva baseada no protótipo do Figma.

## Estados da coleta e da sincronização

A situação da coleta é mostrada nos lotes, nos detalhes e no formulário. Iniciar ou retomar deixa a coleta **Ativa**. **Pausar coleta** salva o rascunho imediatamente e deixa a coleta **Pausada**. Sair do formulário pela navegação também salva e pausa. Ao reabrir a aplicação, uma edição interrompida volta como Pausada.

**Finalizar coleta** funciona com ou sem internet: exige um formulário válido, persiste o registro e só então mostra a confirmação. A coleta fica **Finalizada**, enquanto o transporte fica **Pendente**. O envio ao Supabase passa por **Enviando**, **Sincronizado** ou **Erro**. Sincronizado não significa Validado.

Com conexão, abra um lote e use **Iniciar coleta**, sem precisar baixá-lo primeiro. O protótipo guarda os dados desse lote e o rascunho na mesma gravação local, vinculados à conta e ao projeto. Se a conexão cair, a coleta pode continuar. Sem conexão, somente lotes já armazenados no dispositivo podem ser iniciados. Finalizar online também gera uma pendência local; a sincronização permanece manual para que o coletor controle o envio.

Use **Ver coleta** para consultar dados finalizados, inclusive depois da sincronização. Para editar, escolha **Reabrir coleta**. Enquanto a revisão estiver ativa ou pausada, esse lote fica fora dos próximos envios. Finalizar novamente atualiza o mesmo registro e cria uma nova pendência com o mesmo identificador; não cria uma segunda coleta local.

Dados do formato anterior são preservados no mesmo IndexedDB. O antigo status `sent` passa a `synced`; rascunhos ficam Pausados e registros finalizados conservam dados, anexos, identificador e tentativas.

## Limites

- os dados pessoais preenchidos durante os testes devem ser fictícios;
- utiliza somente o banco acadêmico do Supabase e os lotes autorizados para esta demonstração;
- não contém código do frontend ou backend privados da empresa;
- reproduz somente o formulário e as regras necessários para demonstrar o fluxo acadêmico;
- rascunhos e pendências ainda não sincronizados permanecem somente no dispositivo de origem;
- a recuperação remota ocorre no acesso conectado; não há atualização em tempo real;
- os campos de devolução representam a última revisão e são limpos no reenvio; não há histórico permanente de revisão.

A execução deste protótipo é independente da infraestrutura privada. A futura integração empresarial depende das APIs e da autenticação da empresa e não faz parte desta entrega acadêmica. Conflitos de edição entre dispositivos ainda precisam de tratamento próprio.

O rascunho automático aguarda aproximadamente 600 ms após a última alteração. Para garantir o salvamento antes de encerrar, use **Pausar coleta** ou a navegação da aplicação e aguarde a confirmação. Fechar abruptamente a aba antes da gravação pode perder as últimas alterações. Limpar os dados do site também remove o armazenamento local. O uso simultâneo em múltiplas abas não faz parte do fluxo validado.

## Tecnologias

- React 18;
- Vite 6;
- IndexedDB nativo;
- service worker gerado durante o build;
- Lucide React;
- Supabase Auth e Postgres;
- Playwright para o teste do fluxo principal.

## Executar localmente

Requer Node.js 22 ou mais recente, conforme a versão instalada do cliente Supabase.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Preencha o arquivo local com a URL e a chave publicável do projeto. O `.env.local` não é versionado.

Acesse `http://127.0.0.1:5173` ou a porta informada pelo Vite.

## Validar o modo offline

No primeiro terminal:

```powershell
npm run build
npm run preview
```

Depois de entrar e baixar ao menos uma área, utilize o modo offline do navegador ou o controle de conectividade disponível na interface.

Para executar o teste automatizado, mantenha o preview ativo e use outro terminal:

```powershell
npm run test:form
npm run test:workflow
$env:TEST_USER_PASSWORD='senha-da-conta-de-teste'
npm run test:smoke
npm run test:sync
```

Os testes isolados verificam o formulário e as transições dos estados da coleta. O teste de integração entra com uma conta real, confirma o perfil e os 240 lotes, prepara uma área e reabre a aplicação offline. O teste de sincronização preenche uma coleta de teste e confirma seu envio ao Supabase.

`npm run test:review` verifica a interface de revisão com respostas simuladas, sem senha nem alterações no banco: reabertura pelos três perfis revisores, motivo obrigatório, cancelamento e exibição do motivo ao coletor nas pendências e no formulário.

## Validação e reabertura

`WCOGEO_ADMIN`, `WCOGEO_ANALISTA` e `PREFEITURA_ADMIN` revisam as coletas na aba Validação. Em uma coleta validada, a ação **Reabrir para correção** exige um motivo de 5 a 500 caracteres. O banco altera a coleta para `Devolvida` e o lote para `Correcao` na mesma transação, preservando o formulário e registrando o responsável e a data da devolução. O coletor recebe o resultado no próximo acesso conectado.

Ao clicar novamente na aba Validação, o detalhe é fechado e a lista volta ao topo, mantendo os filtros escolhidos.

O SQL correspondente está em `scripts/sql/reabrir-coleta-validada.sql`. O teste de integração do banco em `scripts/sql/testar-reabertura-coleta.sql` usa os perfis existentes, verifica autorização, motivo e preservação dos dados e reverte todas as mudanças ao terminar. Deve ser executado em conexão administrativa no ambiente de teste, com uma coleta finalizada ou validada de um coletor comum.

Os testes de navegador usam o Chrome instalado no caminho padrão do Windows. Para outro caminho, configure `CHROME_PATH`. A URL padrão do preview é `http://127.0.0.1:4173`; use `SIMULATION_URL` se ela for diferente. Não existe comando de lint configurado neste protótipo.

## Estrutura principal

```text
public/              ícones, manifest e assets visuais
scripts/build.mjs    build e geração do service worker
scripts/form-validation.mjs teste das regras do formulário
scripts/collection-workflow.mjs teste dos estados e migração
scripts/supabase-smoke.mjs autenticação, lotes e reabertura offline
scripts/supabase-sync.mjs sincronização completa com o Supabase
scripts/review-reopening.mjs revisão e retorno à lista com respostas simuladas
scripts/sql/         ajuste e teste transacional da reabertura
src/collectionWorkflow.js transições, bloqueios e migração dos estados
src/CollectionForm.jsx formulário completo da coleta
src/formValidation.js regras e máscaras do formulário
src/form.css          estilos do formulário
src/main.jsx         interface e fluxo demonstrativo
src/session.css      estilos da entrada e identificação da sessão
src/storage.js       IndexedDB, migração e fixtures dos testes isolados
src/supabase.js      autenticação, consulta e sincronização remotas
src/styles.css       estilos responsivos
```
