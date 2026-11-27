# GeoColeta PWA — protótipo acadêmico

Protótipo em React do fluxo offline do GeoColeta. Esta versão acadêmica utiliza Supabase Auth e um banco independente com 240 lotes autorizados para demonstração. Não se conecta às APIs nem aos ambientes privados da WCOGEO.

[Acessar a demonstração](https://geocoleta-simulacao.netlify.app/)

## Problema resolvido

A coleta em campo pode acontecer em locais com conexão instável ou inexistente. A aplicação permite preparar os lotes enquanto houver internet, preencher os dados sem conexão e sincronizar os registros quando o acesso à rede retornar.

## Funcionalidades

### Coleta em campo

- Consulta de lotes com filtros por bairro e quadra.
- Formulário com validação de CPF/CNPJ, máscaras e campos condicionais.
- Dados do cônjuge obrigatórios para casados e opcionais para união estável.
- Telefone fixo, nome do pai, observação e início da moradia opcionais; número da CNH exigido somente quando o usuário informa que possui o documento.
- Rascunho automático, pausa e retomada da coleta.
- Anexo de imagem ou PDF para pendência judicial.

### Uso offline e sincronização

- Instalação como PWA e cache dos arquivos essenciais da aplicação.
- Download seletivo dos lotes para uso offline.
- Início online sem download prévio: os dados do lote e o rascunho são gravados no dispositivo antes de abrir o formulário.
- Persistência dos lotes, rascunhos e pendências no IndexedDB, com estado local separado por usuário.
- Sincronização manual com preservação das pendências em caso de falha e possibilidade de nova tentativa.
- Gravação da coleta e atualização do status do lote na mesma transação, com vínculo único para evitar duplicidade.
- Recuperação das coletas sincronizadas no próximo acesso conectado, inclusive em outro dispositivo.

### Revisão administrativa

- Autenticação pelo Supabase e acesso vinculado ao projeto e à permissão do perfil.
- Dois perfis: `COLETOR` preenche e sincroniza suas coletas; `ADMIN` também consulta e revisa as coletas do projeto.
- Consulta do formulário completo, com filtros por bairro e status.
- Validação, devolução e reabertura de coletas validadas para correção.
- Motivo obrigatório na devolução, exibido ao coletor nas pendências e no formulário.

## Como funciona o fluxo

1. Entre com uma conta configurada, enquanto houver conexão.
2. Filtre e baixe os lotes que pretende visitar. Também é possível iniciar uma coleta diretamente online.
3. Preencha o formulário. Use **Pausar coleta** para salvar e continuar depois.
4. Finalize a coleta após preencher os campos obrigatórios.
5. Abra **Pendências** e sincronize quando estiver conectado.
6. Um revisor pode validar ou solicitar correções. Após corrigir, o coletor finaliza e sincroniza novamente.

O status da coleta — Aguardando consulta, Ativo, Pausado, Finalizado, Validado ou Correção solicitada — é independente do status de sincronização: Pendente, Enviando, Sincronizado ou Erro. **Sincronizado não significa Validado.**

Coletas finalizadas ficam disponíveis para consulta e podem ser reabertas explicitamente para edição. Coletas validadas só voltam a ser editáveis depois da reabertura por um revisor autorizado, com motivo de 5 a 500 caracteres. O banco registra o responsável e a data da devolução, preservando o formulário.

Ao clicar novamente na aba **Validação**, a lista volta ao topo e mantém os filtros escolhidos.

## Tecnologias

React 18, Vite 6, Supabase Auth e Postgres, IndexedDB nativo, Web App Manifest, service worker, Lucide React e Playwright.

O Supabase mantém autenticação e dados sincronizados. O IndexedDB mantém os dados necessários ao trabalho offline; o cache do service worker permite abrir a aplicação sem internet depois do primeiro carregamento.

## Executar localmente

### Pré-requisitos

- Node.js 22 ou mais recente e npm.
- Projeto Supabase com a estrutura e os acessos necessários já configurados.
- Conta do Supabase Auth vinculada a um perfil com projeto e permissão.

A aplicação espera as tabelas `projetos`, `perfis`, `lotes`, `projeto_lotes` e `coletas`, além das políticas de acesso e das funções `sincronizar_coleta`, `validar_coleta` e `devolver_coleta`.

Para criar o **banco de demonstração**, siga [scripts/sql/README.md](scripts/sql/README.md): execute a estrutura inicial, carregue os **12 lotes fictícios originais**, crie as contas no Supabase Auth e vincule seus perfis. Os scripts incluem RLS, permissões, funções e um teste com rollback. Não os execute sobre o banco publicado; os 240 lotes autorizados não são exportados nem substituídos.

### Instalação

Na pasta do repositório, instale as dependências e crie a configuração local:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Antes de iniciar a aplicação, preencha o `.env.local` com os valores do projeto:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

Use a chave publicável do projeto. Não coloque senha do banco nem chave secreta ou `service_role` no frontend. O `.env.local` não é versionado.

Depois de configurar:

```powershell
npm run dev
```

Abra `http://127.0.0.1:5173` ou a porta informada pelo Vite.

## Build e teste offline

```powershell
npm run build
npm run preview
```

Abra o endereço do preview, entre e baixe uma área. Em seguida, ative o modo offline do navegador ou use o controle de conectividade da interface. Para testar a reabertura sem rede, carregue a aplicação inicialmente online.

O build é gerado em `dist/`, incluindo o service worker. Essa pasta não é versionada e pode ser utilizada na publicação estática.

## Testes automatizados

Testes isolados do formulário e dos estados da coleta:

```powershell
npm run test:form
npm run test:workflow
```

Com o preview ativo, execute o teste da interface administrativa com respostas simuladas:

```powershell
npm run test:review
```

Para autenticação, consulta dos lotes, recuperação remota, reabertura offline e sincronização com o banco de teste:

```powershell
$env:TEST_USER_PASSWORD='senha-da-conta-de-teste'
npm run test:supabase
npm run test:sync
```

O teste de sincronização preenche e envia uma coleta com dados pessoais fictícios. Execute-o somente no ambiente de teste. O comando `test:smoke` é um alias de `test:supabase`.

Os testes de navegador usam o Chrome instalado no caminho padrão do Windows. Configure `CHROME_PATH` para outro caminho e `SIMULATION_URL` para outro endereço do preview; o padrão é `http://127.0.0.1:4173`. Não há comando de lint configurado.

O [teste SQL da reabertura](scripts/sql/testar-reabertura-coleta.sql) verifica autorização, motivo e preservação dos dados e reverte as alterações. Ele exige conexão administrativa no ambiente de teste e uma coleta finalizada ou validada de um coletor comum.

## Estrutura principal

```text
public/                   ícones, manifesto e arquivos visuais
scripts/build.mjs         build e geração do service worker
scripts/*.mjs             testes do formulário, workflow e navegador
scripts/sql/              estrutura, carga demonstrativa, perfis e testes SQL
src/main.jsx              interface, navegação e fluxo da aplicação
src/CollectionForm.jsx    formulário da coleta
src/formValidation.js     regras de validação e máscaras
src/collectionWorkflow.js estados e transições da coleta
src/storage.js            IndexedDB, migração e dados dos testes isolados
src/supabase.js           autenticação, consultas e operações remotas
src/*.css                 estilos da aplicação
```

## Limitações atuais

- Versão acadêmica independente da infraestrutura privada da empresa, com lotes autorizados para demonstração. Dados pessoais preenchidos nos testes devem ser fictícios.
- O primeiro acesso exige conexão. Sem internet, somente os lotes já armazenados no dispositivo podem ser iniciados.
- Rascunhos e registros ainda não sincronizados permanecem no dispositivo de origem. Limpar os dados do site remove esse armazenamento.
- O rascunho automático aguarda aproximadamente 600 ms após a última alteração. Use **Pausar coleta** ou a navegação da aplicação e aguarde o salvamento antes de encerrar; fechar abruptamente pode perder as últimas alterações.
- A recuperação remota ocorre no acesso conectado, sem atualização em tempo real.
- Conflitos de edição entre dispositivos ainda não possuem tratamento próprio; o uso simultâneo em múltiplas abas não faz parte do fluxo validado.
- Os campos de devolução registram somente a última revisão e são limpos no reenvio. Ainda não há histórico permanente de revisões.
- A integração com as APIs e a autenticação do sistema empresarial permanece fora desta entrega.
