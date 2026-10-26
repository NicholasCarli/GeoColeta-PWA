const DB_NAME = 'geocoleta-simulacao-v1';
export const demoSession = Object.freeze({
  userId: 'usuario-demo-001',
  userName: 'Coletor de demonstração',
  projectId: 'projeto-demo-centro',
  projectName: 'Projeto Centro — Demonstração',
});
export const initialState = () => ({ session: null, prepared: {}, records: [], drafts: {}, lastPrepared: null });
let connection;
let writes = Promise.resolve();

function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('simulation');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Não foi possível abrir o armazenamento deste navegador.'));
    request.onblocked = () => reject(new Error('Feche outras abas da simulação e tente novamente.'));
  });
  return connection;
}

export async function loadState() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('simulation', 'readonly');
    const read = tx.objectStore('simulation').get('state');
    read.onsuccess = () => {
      const state = { ...initialState(), ...(read.result || {}) };
      const ownership = { userId: demoSession.userId, projectId: demoSession.projectId };
      state.prepared = Object.fromEntries(Object.entries(state.prepared).map(([id, lot]) => [id, { ...ownership, ...lot }]));
      state.records = state.records.map(record => ({ ...ownership, ...record }));
      resolve(state);
    };
    read.onerror = () => reject(read.error);
  });
}

export function saveState(state) {
  const operation = writes.catch(() => {}).then(async () => {
    const db = await database();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('simulation', 'readwrite');
      tx.objectStore('simulation').put(state, 'state');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(new Error('Não foi possível salvar. Verifique o espaço disponível no dispositivo.'));
      tx.onabort = () => reject(new Error('O salvamento foi interrompido. Seus campos foram mantidos.'));
    });
  });
  writes = operation;
  return operation;
}

export const lots = [
  ['001', 'Centro', '12', 'Rua Cel. Virgílio Ferreira de Almeida', 'Registrado', '120'],
  ['002', 'Centro', '12', 'Rua Nossa Senhora Aparecida', 'Registrado', '84'],
  ['003', 'Centro', '12', 'Rua Prof. Calixto', 'Aguardando', '36'],
  ['004', 'Centro', '13', 'Rua das Acácias', 'Aguardando', '210'],
  ['005', 'Centro', '13', 'Rua São Benedito', 'Ativo', '57'],
  ['006', 'Centro', '13', 'Rua dos Ipês', 'Registrado', '98'],
  ['007', 'Jardim das Flores', '04', 'Rua das Orquídeas', 'Aguardando', '15'],
  ['008', 'Jardim das Flores', '04', 'Rua das Margaridas', 'Ativo', '42'],
  ['009', 'Jardim das Flores', '04', 'Rua dos Girassóis', 'Registrado', '73'],
  ['010', 'Vila Nova', '08', 'Rua da Esperança', 'Aguardando', '101'],
  ['011', 'Vila Nova', '08', 'Rua da Amizade', 'Registrado', '109'],
  ['012', 'Vila Nova', '08', 'Rua do Sol', 'Ativo', '125'],
].map(([id, bairro, quadra, address, status, number]) => ({ id, bairro, quadra, address, status, number, inscription: `0001.${quadra.padStart(3, '0')}.${id}` }));

export const blankForm = lot => ({
  cpfCnpj: '', nome: '', dtNascimento: '', rg: '', orgaoExpedidor: '', mae: '', pai: '',
  sexo: '', escolaridade: '', naturalidade: '', nacionalidade: '', celular: '', telefoneFixo: '',
  profissao: '', cnh: '', email: '', outroImovel: '', rendaFamiliar: '', estadoCivil: '', regimeBens: '',
  cpfCnpjConjuge: '', nomeConjuge: '', dtNascimentoConjuge: '', rgConjuge: '', orgaoExpedidorConjuge: '',
  maeConjuge: '', paiConjuge: '', sexoConjuge: '', escolaridadeConjuge: '', naturalidadeConjuge: '',
  nacionalidadeConjuge: '', celularConjuge: '', profissaoConjuge: '', cep: '', bairro: lot.bairro,
  quadra: lot.quadra, lote: lot.id, logradouro: lot.address, matricula: '', valorVenal: '',
  dtInicioMoradia: '', possuiPendencia: '', observacao: '', pendingDocument: null,
});
export const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Ainda não realizada';
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
