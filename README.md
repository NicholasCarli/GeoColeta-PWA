# GeoColeta PWA - protótipo acadêmico

Protótipo em React do fluxo offline do GeoColeta. Esta versão foi criada para demonstração acadêmica, utiliza somente dados fictícios e não se conecta às APIs nem aos ambientes da WCOGEO.

## Problema demonstrado

A coleta em campo pode acontecer em locais com conexão instável ou inexistente. O protótipo mostra como preparar lotes antes da saída, registrar uma coleta sem internet e sincronizar as pendências quando a conexão retornar.

## Funcionalidades

- instalação como PWA por meio de manifest e service worker;
- sessão fictícia iniciada online e mantida para continuidade offline;
- autenticação simulada com as credenciais `teste123` / `teste123`, sem armazenamento da senha;
- cache da aplicação e das fontes para abertura offline;
- preparação de lotes fictícios para uso offline;
- formulário de coleta completo com rascunho automático e persistência no IndexedDB;
- CPF e CNPJ com máscara e validação dos dígitos verificadores;
- dados do cônjuge obrigatórios para casado e opcionais para união estável;
- telefone fixo, nome do pai, observação e início da moradia opcionais;
- pergunta sobre posse de CNH, exigindo o número somente quando a resposta for positiva;
- anexo local de imagem ou PDF para pendência judicial;
- fila de pendências com falha simulada e nova tentativa;
- prevenção de reenvio de um registro já confirmado;
- indicadores de conexão e de sincronização;
- estados da coleta independentes da sincronização: Aguardando consulta, Ativo, Pausado, Finalizado e Validado;
- pausa e retomada de rascunhos, incluindo depois de reabrir a aplicação offline;
- consulta de formulários finalizados e reabertura explícita para edição, mantendo o identificador do registro;
- bloqueio de edição de coletas validadas;
- interface responsiva baseada no protótipo do Figma.

## Estados da coleta e da sincronização

A situação da coleta é mostrada nos lotes, nos detalhes e no formulário. Iniciar ou retomar deixa a coleta **Ativa**. **Pausar coleta** salva o rascunho imediatamente e deixa a coleta **Pausada**. Sair do formulário pela navegação também salva e pausa. Ao reabrir a aplicação, uma edição interrompida volta como Pausada.

**Finalizar coleta offline** exige um formulário válido, persiste o registro e só então mostra a confirmação. A coleta fica **Finalizada**, enquanto o transporte fica **Pendente**. O envio simulado passa por **Enviando**, **Sincronizado** ou **Erro**, sem mudar o estado da coleta. Sincronizado não significa Validado.

Use **Ver coleta** para consultar dados finalizados, inclusive depois da sincronização. Para editar, escolha **Reabrir coleta**. Enquanto a revisão estiver ativa ou pausada, esse lote fica fora dos próximos envios. Finalizar novamente atualiza o mesmo registro e cria uma nova pendência com o mesmo identificador; não cria uma segunda coleta local.

O lote **012, Vila Nova, quadra 08**, é um exemplo fictício previamente **Validado** pela administração, disponível somente para consulta. O coletor não possui uma ação de validação administrativa. Baixe a área online para consultar o exemplo offline. Se uma versão anterior já tiver trabalho salvo nesse lote, esse trabalho tem prioridade sobre o exemplo.

Dados do formato anterior são preservados no mesmo IndexedDB. O antigo status `sent` passa a `synced`; rascunhos ficam Pausados e registros finalizados conservam dados, anexos, identificador e tentativas.

## Limites

- não utiliza dados reais;
- não possui autenticação real;
- o envio para o servidor é simulado;
- não contém código do frontend ou backend privados da empresa;
- reproduz somente o formulário e as regras necessários para demonstrar o fluxo acadêmico.

A execução deste protótipo é independente da infraestrutura privada. A futura integração empresarial depende das APIs e da autenticação da empresa e não faz parte desta entrega acadêmica. A prevenção de duplicidade é local; idempotência e conflitos entre dispositivos precisam de tratamento próprio na integração real.

O rascunho automático aguarda aproximadamente 600 ms após a última alteração. Para garantir o salvamento antes de encerrar, use **Pausar coleta** ou a navegação da aplicação e aguarde a confirmação. Fechar abruptamente a aba antes da gravação pode perder as últimas alterações. Limpar os dados do site também remove o armazenamento local. O uso simultâneo em múltiplas abas não faz parte do fluxo validado.

## Tecnologias

- React 18;
- Vite 6;
- IndexedDB nativo;
- service worker gerado durante o build;
- Lucide React;
- Playwright para o teste do fluxo principal.

## Executar localmente

Requer Node.js 18 ou mais recente.

```powershell
npm ci
npm run dev
```

Acesse `http://127.0.0.1:5173` ou a porta informada pelo Vite.

## Validar o modo offline

No primeiro terminal:

```powershell
npm run build
npm run preview
```

Depois de abrir a aplicação uma vez, utilize o modo offline do navegador ou o controle de simulação disponível na interface.

Para executar o teste automatizado, mantenha o preview ativo e use outro terminal:

```powershell
npm run test:form
npm run test:workflow
npm run test:smoke
npm run test:recovery
```

Os testes isolados verificam o formulário e as transições dos estados da coleta. O teste de fluxo prepara lotes, pausa e retoma offline, salva um formulário com documento, reabre a coleta sem duplicar registros, simula falha e nova tentativa e verifica a consulta de um Validado sem permitir alterações. O teste de recuperação fecha e reinicia o navegador com o mesmo perfil, abre a aplicação realmente offline e confere a migração dos dados da versão anterior.

Os testes de navegador usam o Chrome instalado no caminho padrão do Windows. Para outro caminho, configure `CHROME_PATH`. A URL padrão do preview é `http://127.0.0.1:4173`; use `SIMULATION_URL` se ela for diferente. Não existe comando de lint configurado neste protótipo.

## Estrutura principal

```text
public/              ícones, manifest e assets visuais
scripts/build.mjs    build e geração do service worker
scripts/form-validation.mjs teste das regras do formulário
scripts/collection-workflow.mjs teste dos estados e migração
scripts/smoke.mjs    teste automatizado do fluxo offline
scripts/storage-recovery.mjs recuperação após reiniciar o navegador
src/collectionWorkflow.js transições, bloqueios e migração dos estados
src/CollectionForm.jsx formulário completo da coleta
src/formValidation.js regras e máscaras do formulário
src/form.css          estilos do formulário
src/main.jsx         interface e fluxo demonstrativo
src/session.css      estilos da entrada e identificação da sessão
src/storage.js       IndexedDB e dados fictícios
src/styles.css       estilos responsivos
```
