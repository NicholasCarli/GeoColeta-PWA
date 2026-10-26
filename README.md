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
- interface responsiva baseada no protótipo do Figma.

## Limites

- não utiliza dados reais;
- não possui autenticação real;
- o envio para o servidor é simulado;
- não contém código do frontend ou backend privados da empresa;
- reproduz somente o formulário e as regras necessários para demonstrar o fluxo acadêmico.

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
npm install
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
npm run test:smoke
```

O primeiro comando verifica isoladamente as regras do formulário. O teste de fluxo prepara três lotes, salva o formulário e um documento offline, recarrega a aplicação sem rede, simula uma falha de envio e confirma a nova tentativa sem duplicidade.

## Estrutura principal

```text
public/              ícones, manifest e assets visuais
scripts/build.mjs    build e geração do service worker
scripts/form-validation.mjs teste das regras do formulário
scripts/smoke.mjs    teste automatizado do fluxo offline
src/CollectionForm.jsx formulário completo da coleta
src/formValidation.js regras e máscaras do formulário
src/form.css          estilos do formulário
src/main.jsx         interface e fluxo demonstrativo
src/session.css      estilos da entrada e identificação da sessão
src/storage.js       IndexedDB e dados fictícios
src/styles.css       estilos responsivos
```
