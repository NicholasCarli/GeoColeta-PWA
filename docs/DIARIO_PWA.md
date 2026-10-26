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
