# Diário acadêmico - GeoColeta PWA

Este arquivo registra a evolução do protótipo acadêmico. Não devem ser incluídos dados reais, credenciais, URLs privadas ou conteúdo dos repositórios internos da empresa.

## 2026-10-26 - Base acadêmica

### Resumo

- Organizada a base do protótipo acadêmico em repositório próprio e privado.
- Mantido somente o fluxo essencial da PWA com dados fictícios e sincronização simulada.

### Estrutura preparada

- aplicação React e estilos responsivos;
- manifest e ícones da PWA;
- IndexedDB para lotes preparados, rascunhos, fotos e pendências;
- service worker gerado durante o build;
- teste automatizado do fluxo offline;
- documentação de execução, escopo e limitações.
- Vite atualizado de 6.1.0 para 6.4.5 para eliminar vulnerabilidades conhecidas no servidor de desenvolvimento.

### Decisões

- O protótipo acadêmico não contém código ou dados privados da empresa.
- A integração com as APIs existentes será desenvolvida no frontend da empresa.
- Materiais pessoais de aprendizagem permanecem fora deste repositório.

### Verificações

- [x] `npm ci` - instalação limpa concluída;
- [x] `npm audit` - nenhuma vulnerabilidade após a atualização do Vite;
- [x] `npm run build` - build de produção e service worker gerados;
- [x] `npm run test:smoke` - fluxo offline, persistência, falha e nova tentativa validados;
- [x] revisão final dos arquivos versionados - escopo acadêmico, proteção dos dados locais, manifesto, ícones e ausência de informações privadas conferidos.

### Próximo passo

- Iniciar a implementação incremental das próximas funcionalidades do protótipo acadêmico.

## 2026-10-26 - Sessão offline simulada

### Implementação

- Adicionado primeiro acesso online com usuário e projeto fictícios, sem senha real.
- A tela de entrada passou a validar as credenciais fictícias `teste123` / `teste123`; a senha permanece apenas em memória e não é persistida.
- Sessão persistida no IndexedDB para permitir a continuidade do fluxo depois de perder a conexão.
- Lotes preparados e registros locais passaram a guardar os identificadores do usuário e do projeto de demonstração.
- A saída da sessão oculta os dados e exige confirmação quando existem rascunhos ou pendências, sem apagá-los.
- Registros antigos da simulação recebem a identificação fictícia durante a leitura para preservar os testes já realizados.

### Verificações

- [x] build de produção;
- [x] primeiro acesso bloqueado sem conexão;
- [x] sessão e registro associados ao usuário e projeto fictícios;
- [x] sessão preservada durante recarregamento offline;
- [x] aviso de saída com pendências;
- [x] saída após sincronização sem apagar os dados locais;
- [x] fluxo completo sem erros JavaScript.

### Próximo passo

- Completar o formulário de coleta com as regras validadas para uso offline.

## 2026-10-26 - Formulário completo da coleta

### Implementação

- Substituído o formulário reduzido pelo conjunto de dados pessoais, cônjuge e imóvel usado no fluxo de coleta.
- Mantido o salvamento automático do rascunho no IndexedDB durante o preenchimento.
- Adicionadas máscaras e validações básicas para CPF/CNPJ, telefones, CEP, RG, CNH, e-mail, matrícula, datas e valores.
- Dados do cônjuge são obrigatórios para pessoa casada e opcionais para união estável; quando algum dado opcional é informado, ele é validado.
- Ao retirar um estado civil com cônjuge, a confirmação para limpar a seção aparece somente quando existem dados preenchidos.
- Adicionado anexo opcional de imagem ou PDF, com limite de 5 MB, quando existe pendência judicial.
- Rascunhos do modelo anterior continuam abrindo, com preenchimento dos novos campos pelo modelo atual.

### Decisões

- O protótipo continua usando autenticação simulada, dados fictícios e IndexedDB, sem banco ou API externa.
- Uma integração real ficará para uma etapa posterior e isolada, somente se for necessária para a demonstração.
- A validação completa acontece antes de transformar o rascunho em registro pendente de sincronização.

### Verificações

- [x] `npm run test:form` - CPF/CNPJ, regras de casamento e união estável validados;
- [x] `npm run build` - aplicação e service worker gerados;
- [x] `npm run test:smoke` - formulário, confirmação de limpeza, documento e persistência offline validados;
- [x] compatibilidade de leitura dos rascunhos do modelo anterior conferida.

### Próximo passo

- Ampliar os dados fictícios de lotes e avaliar a sincronização automática sem remover a ação manual.
