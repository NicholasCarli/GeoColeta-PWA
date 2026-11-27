# Criar o banco de demonstração

Estes arquivos preparam um **novo projeto Supabase** para executar a PWA.
Não execute `schema.sql` no ambiente publicado: ele não é uma migração nem apaga/recria tabelas existentes.

## Ordem de execução

No Dashboard do **novo projeto**, abra **SQL Editor > New query** e execute cada arquivo completo, como administrador, nesta ordem:

1. [schema.sql](schema.sql): cria as cinco tabelas, relacionamentos, índices, RLS, grants, trigger e as três funções RPC.
2. [seed-demo.sql](seed-demo.sql): cria o projeto de demonstração e os **12 lotes fictícios originais** de `src/storage.js`, com seus vínculos.
3. Crie as contas no Supabase Auth, conforme abaixo.
4. Edite os dois UUIDs em [vincular-perfis.sql](vincular-perfis.sql) e execute-o para atribuir projeto e permissão.
5. Execute [testar-instalacao.sql](testar-instalacao.sql) para conferir os acessos e o fluxo remoto.

Cada script tem sua própria transação. Se um passo falhar, corrija o erro antes de continuar. No SQL Editor, execute o arquivo inteiro, não somente uma seleção.
Se uma execução manual deixar a conexão em transação abortada, execute `ROLLBACK;` antes de tentar novamente.

O schema é de primeira instalação: falha se as tabelas já existirem, evitando mascarar estruturas divergentes com `IF NOT EXISTS`.
A carga pode ser repetida: ignora registros com os mesmos IDs e não reseta status, formulários ou perfis. IDs/inscrições conflitantes podem impedir a carga em outra base; não use estes scripts como importação de produção.

## Contas e permissões

Em **Authentication > Users > Add user > Create new user**, crie duas contas com senhas definidas por você:

- um coletor, associado a `COLETOR`;
- um administrador, associado a `ADMIN`.

Para um teste sem envio de e-mail, confirme o e-mail pela opção administrativa disponível no Dashboard. Copie o **User UID** de cada conta e preencha `v_coletor` e `v_admin` em `vincular-perfis.sql`.
O script falha enquanto houver placeholders, se as contas forem iguais, inexistentes ou já tiverem perfil. Não modifica permissões anteriores silenciosamente.

Não crie usuários com INSERT em `auth.users`. O Supabase Auth administra credenciais e identidades; `public.perfis` armazena apenas vínculo, nome e permissão.
Nenhuma senha é incluída nos scripts. O projeto usa um perfil e um projeto por usuário.

| Permissão | Uso na PWA |
| --- | --- |
| `ADMIN` | Coleta e revisão de todas as coletas do seu projeto |
| `COLETOR` | Coleta e consulta das próprias coletas do seu projeto |

O administrador também fica limitado ao projeto do seu perfil. O cliente não pode alterar a própria permissão. Altere perfis somente pela administração do banco, com autorização.
Se não houver necessidade de cadastro público, desative novos cadastros nas configurações do Auth e mantenha a criação de contas administrativa.

## Atualizar um banco existente

Use [simplificar-permissoes.sql](simplificar-permissoes.sql), **não** `schema.sql`, para converter uma base já configurada:

1. Faça backup do banco e publique o frontend novo, que entende `ADMIN`/`COLETOR` e converte os nomes antigos ao carregar o perfil.
2. Recarregue a aplicação nos dispositivos. Não execute a conversão enquanto depender do frontend antigo: ele não reconhece os novos nomes e esconderia Validação.
3. No SQL Editor, execute `simplificar-permissoes.sql` completo, como administrador.
4. Confira as permissões em `perfis` e entre novamente com coletor e administrador para validar o fluxo.

A conversão é transacional: os três perfis antes autorizados a revisar passam a `ADMIN`; os dois perfis de coleta passam a `COLETOR`. IDs, contas, projetos, lotes e coletas são preservados. Atualiza também a constraint, três políticas RLS e três funções, sem ampliar o acesso entre projetos ou permitir edição de perfis pelo cliente.
O script rejeita permissões desconhecidas e pode ser repetido sem reconverter contas já atualizadas.

Os nomes antigos permanecem somente nos caminhos de conversão/compatibilidade e nos testes correspondentes; não são cargos aceitos no novo schema. `src/permissions.js` é utilizado ao carregar perfis remotos e restaurar sessões locais, sem apagar o IndexedDB. O banco continua sendo a autoridade para autorizar operações remotas.

O seed de 12 lotes é exclusivo de uma **nova base de demonstração**. Não o execute na base existente de 240 lotes para esta conversão.

## O que a carga contém

- Projeto `Projeto Centro - Demonstracao`, categoria `reurb`, cidade fictícia.
- 12 lotes com IDs `001` a `012`, bairros Centro, Jardim das Flores e Vila Nova.
- Endereços e inscrições da base original, usados apenas como exemplos fictícios; não são uma base cadastral oficial.
- Situação cadastral preservada; status da coleta inicia em `Aguardando` para todos os vínculos. São conceitos diferentes.
- Nenhum proprietário, CPF, formulário preenchido ou coleta previamente validada.

Os 240 lotes autorizados do site publicado **não são exportados nem substituídos** por estes arquivos.

**Limite da interface atual:** `src/storage.js` ainda inicializa o lote `012` como um exemplo local validado e fornece um formulário fictício para consulta. Com os IDs originais, ele pode aparecer como Validado no navegador, embora o seed não crie validação no Supabase. Para testar coleta e sincronização, use os lotes `001` a `011`. A conversão de cargos não altera essa fixture.

## Verificar a instalação

Execute `testar-instalacao.sql` como administrador no banco de demonstração, com os perfis configurados e pelo menos dois lotes sem coleta.

O teste assume os 12 vínculos do seed, usa as contas configuradas e alterna para o papel `authenticated` para exercitar RLS.
Verifica isolamento por projeto/perfil, restrições anônimas, sincronização atômica, reenvio sem duplicidade, bloqueio de validação e autoelevação de permissão pelo coletor, validação administrativa, reabertura com motivo, reenvio da correção e coleta pelo administrador.
Cria dados temporários e termina com `ROLLBACK`: nenhuma coleta ou status de teste permanece. Em caso de falha, execute `ROLLBACK;` se necessário.

O teste SQL não substitui a verificação do Supabase Auth e da API. Depois:

1. Configure `.env.local` conforme o [README principal](../../README.md#executar-localmente), usando a URL e a chave publicável **do novo projeto**.
2. Execute build e preview, entre com as duas contas e confirme os 12 lotes.
3. Como coletor, baixe um lote entre `001` e `011`, preencha dados pessoais fictícios, finalize e sincronize.
4. Como revisor, valide ou devolva com motivo; entre novamente como coletor conectado e confira o resultado.
5. Teste a reabertura offline após baixar os dados.

Os testes de integração real (`test:supabase` e `test:sync`) incluem expectativas da demonstração publicada com 240 lotes e contas específicas. Não os trate como validação automática desta nova base de 12 lotes sem adaptar os fixtures.

## Arquivos antigos e limites

- [reabrir-coleta-validada.sql](reabrir-coleta-validada.sql): ajuste de reabertura que agora usa `ADMIN`. Em uma base com cargos antigos, execute primeiro `simplificar-permissoes.sql`. O novo `schema.sql` incorpora essa regra; **não é um passo extra** da instalação.
- [testar-reabertura-coleta.sql](testar-reabertura-coleta.sql): teste adicional que exige uma coleta finalizada ou validada de coletor comum; também reverte suas alterações.

O schema é uma fotografia do modelo atual, não um backup, um conjunto de migrações incrementais ou um instalador do Supabase.
Não instala Auth, Storage, APIs privadas, configurações do Dashboard ou segredos. Em novas mudanças estruturais, mantenha o snapshot alinhado e adote migrações antes de administrar vários ambientes com dados.

As RPCs usam `SECURITY INVOKER` e as tabelas usam grants + RLS conforme a [documentação oficial](https://supabase.com/docs/guides/database/postgres/row-level-security).
O formulário continua validado pela aplicação; armazenar JSONB no banco não substitui essas validações.
