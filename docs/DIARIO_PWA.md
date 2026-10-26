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

- Implementar a sincronização automática opcional quando a conexão retornar, mantendo a ação manual.
