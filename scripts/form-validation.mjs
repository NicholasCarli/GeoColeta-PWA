import assert from 'node:assert/strict';
import { clearSpouse, hasSpouseData, maskCpfCnpj, validateCollectionForm, validCpfCnpj } from '../src/formValidation.js';

const valid = {
  cpfCnpj: '529.982.247-25', nome: 'Maria de Teste', dtNascimento: '1990-05-20',
  rg: '1234567-8', orgaoExpedidor: 'SSP-MT', mae: 'Mãe de Teste', pai: '',
  sexo: 'feminino', escolaridade: 'medio_completo', naturalidade: 'Cuiabá', nacionalidade: 'Brasileira',
  celular: '(65) 99999-9999', telefoneFixo: '', profissao: 'Professora', possuiCnh: false, cnh: '',
  email: 'maria@example.com', outroImovel: false, rendaFamiliar: 3500, estadoCivil: 'solteiro', regimeBens: '',
  cpfCnpjConjuge: '', nomeConjuge: '', dtNascimentoConjuge: '', rgConjuge: '', orgaoExpedidorConjuge: '',
  maeConjuge: '', paiConjuge: '', sexoConjuge: '', escolaridadeConjuge: '', naturalidadeConjuge: '',
  nacionalidadeConjuge: '', celularConjuge: '', profissaoConjuge: '', cep: '78000-000', bairro: 'Centro',
  quadra: '12', lote: '001', logradouro: 'Rua Fictícia', matricula: 'MAT-001', valorVenal: 120000,
  dtInicioMoradia: '', possuiPendencia: false, observacao: '', pendingDocument: null,
};

assert.equal(Object.keys(validateCollectionForm(valid).errors).length, 0);
assert.equal(validCpfCnpj('529.982.247-25'), true);
assert.equal(validCpfCnpj('04.252.011/0001-10'), true);
assert.equal(validCpfCnpj('111.111.111-11'), false);
assert.equal(maskCpfCnpj('04252011000110'), '04.252.011/0001-10');
assert.equal(validateCollectionForm({ ...valid, possuiCnh: '' }).errors.possuiCnh, 'Informe se possui CNH.');
assert.equal(validateCollectionForm({ ...valid, possuiCnh: true }).errors.cnh, 'Informe o número da CNH.');
assert.equal(validateCollectionForm({ ...valid, possuiCnh: true, cnh: '123' }).errors.cnh, 'A CNH deve possuir 11 dígitos.');
assert.equal(Object.keys(validateCollectionForm({ ...valid, possuiCnh: true, cnh: '12345678901' }).errors).length, 0);

const married = { ...valid, estadoCivil: 'casado', regimeBens: 'comunhao_parcial' };
assert.equal(validateCollectionForm(married).errors.nomeConjuge, 'Informe o nome do cônjuge.');
assert.equal(validateCollectionForm(married).errors.paiConjuge, undefined);

const stable = { ...valid, estadoCivil: 'uniao_estavel', regimeBens: 'comunhao_parcial' };
assert.equal(Object.keys(validateCollectionForm(stable).errors).length, 0);
assert.equal(validateCollectionForm({ ...stable, cpfCnpjConjuge: '123' }).errors.cpfCnpjConjuge, 'Informe um CPF ou CNPJ válido.');

assert.equal(hasSpouseData({ ...stable, nomeConjuge: 'Pessoa' }), true);
assert.equal(hasSpouseData(stable), false);
assert.equal(clearSpouse({ ...stable, nomeConjuge: 'Pessoa' }).nomeConjuge, '');

console.log('OK — CPF/CNPJ, validação básica e regras condicionais do cônjuge');
