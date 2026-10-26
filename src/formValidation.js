export const spouseFields = [
  'cpfCnpjConjuge', 'nomeConjuge', 'dtNascimentoConjuge', 'rgConjuge',
  'orgaoExpedidorConjuge', 'maeConjuge', 'paiConjuge', 'sexoConjuge',
  'escolaridadeConjuge', 'naturalidadeConjuge', 'nacionalidadeConjuge',
  'celularConjuge', 'profissaoConjuge',
];

export const hasSpouseData = form => spouseFields.some(field => String(form?.[field] ?? '').trim());
export const hasPartner = status => status === 'casado' || status === 'uniao_estavel';
export const clearSpouse = form => Object.fromEntries(Object.entries(form).map(([key, value]) => [key, spouseFields.includes(key) ? '' : value]));

const digits = value => String(value ?? '').replace(/\D/g, '');
const repeated = value => /^(\d)\1+$/.test(value);

function validCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || repeated(cpf)) return false;
  const check = length => {
    const sum = cpf.slice(0, length).split('').reduce((total, number, index) => total + Number(number) * (length + 1 - index), 0);
    const result = (sum * 10) % 11;
    return Number(cpf[length]) === (result === 10 ? 0 : result);
  };
  return check(9) && check(10);
}

function validCnpj(value) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || repeated(cnpj)) return false;
  const digit = length => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = cnpj.slice(0, length).split('').reduce((sum, number, index) => sum + Number(number) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return Number(cnpj[12]) === digit(12) && Number(cnpj[13]) === digit(13);
}

export const validCpfCnpj = value => validCpf(value) || validCnpj(value);

export function maskCpfCnpj(value) {
  const number = digits(value).slice(0, 14);
  if (number.length <= 11) return number.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return number.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value) {
  const number = digits(value).slice(0, 11);
  return number.length <= 10
    ? number.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
    : number.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export const maskCep = value => digits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
export const onlyDigits = (value, limit) => digits(value).slice(0, limit);
export const documentText = (value, limit = 20) => String(value ?? '').replace(/[^\p{L}\p{N}./-]/gu, '').slice(0, limit);

const empty = value => !String(value ?? '').trim();
const validDate = (value, oldestYears = 150) => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date > new Date()) return false;
  const oldest = new Date(); oldest.setFullYear(oldest.getFullYear() - oldestYears);
  return date >= oldest;
};

export function validateCollectionForm(form) {
  const errors = {};
  const required = (field, message) => { if (empty(form[field])) errors[field] = message; };

  [
    ['cpfCnpj', 'Informe o CPF ou CNPJ.'], ['nome', 'Informe o nome.'],
    ['dtNascimento', 'Informe a data de nascimento.'], ['rg', 'Informe o RG.'],
    ['orgaoExpedidor', 'Informe o órgão expedidor.'], ['mae', 'Informe o nome da mãe.'],
    ['pai', 'Informe o nome do pai.'], ['sexo', 'Selecione o sexo.'],
    ['escolaridade', 'Selecione a escolaridade.'], ['naturalidade', 'Informe a naturalidade.'],
    ['nacionalidade', 'Informe a nacionalidade.'], ['celular', 'Informe o celular.'],
    ['telefoneFixo', 'Informe o telefone fixo.'], ['profissao', 'Informe a profissão.'],
    ['cnh', 'Informe a CNH.'], ['email', 'Informe o e-mail.'],
    ['rendaFamiliar', 'Informe a renda familiar.'], ['estadoCivil', 'Selecione o estado civil.'],
  ].forEach(([field, message]) => required(field, message));
  if (form.outroImovel !== true && form.outroImovel !== false) errors.outroImovel = 'Informe se possui outro imóvel.';

  if (form.cpfCnpj && !validCpfCnpj(form.cpfCnpj)) errors.cpfCnpj = 'Informe um CPF ou CNPJ válido.';
  if (form.dtNascimento && !validDate(form.dtNascimento)) errors.dtNascimento = 'Informe uma data de nascimento válida.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Informe um e-mail válido.';
  if (form.celular && ![10, 11].includes(digits(form.celular).length)) errors.celular = 'Informe um celular com DDD.';
  if (form.telefoneFixo && ![10, 11].includes(digits(form.telefoneFixo).length)) errors.telefoneFixo = 'Informe um telefone com DDD.';
  if (form.rg && (String(form.rg).length < 5 || String(form.rg).length > 20)) errors.rg = 'Informe um RG válido.';
  if (form.cnh && digits(form.cnh).length !== 11) errors.cnh = 'A CNH deve possuir 11 dígitos.';
  if (form.rendaFamiliar !== '' && Number(form.rendaFamiliar) < 0) errors.rendaFamiliar = 'A renda não pode ser negativa.';
  if (hasPartner(form.estadoCivil) && empty(form.regimeBens)) errors.regimeBens = 'Informe o regime de bens.';

  const spouseRequired = form.estadoCivil === 'casado';
  const spouseActive = spouseRequired || (form.estadoCivil === 'uniao_estavel' && hasSpouseData(form));
  if (spouseRequired) {
    [
      ['cpfCnpjConjuge', 'Informe o CPF ou CNPJ do cônjuge.'], ['nomeConjuge', 'Informe o nome do cônjuge.'],
      ['dtNascimentoConjuge', 'Informe o nascimento do cônjuge.'], ['rgConjuge', 'Informe o RG do cônjuge.'],
      ['orgaoExpedidorConjuge', 'Informe o órgão expedidor do cônjuge.'], ['maeConjuge', 'Informe o nome da mãe do cônjuge.'],
      ['paiConjuge', 'Informe o nome do pai do cônjuge.'], ['sexoConjuge', 'Selecione o sexo do cônjuge.'],
      ['escolaridadeConjuge', 'Selecione a escolaridade do cônjuge.'], ['nacionalidadeConjuge', 'Informe a nacionalidade do cônjuge.'],
      ['celularConjuge', 'Informe o celular do cônjuge.'], ['profissaoConjuge', 'Informe a profissão do cônjuge.'],
    ].forEach(([field, message]) => required(field, message));
  }
  if (spouseActive) {
    if (form.cpfCnpjConjuge && !validCpfCnpj(form.cpfCnpjConjuge)) errors.cpfCnpjConjuge = 'Informe um CPF ou CNPJ válido.';
    if (form.dtNascimentoConjuge && !validDate(form.dtNascimentoConjuge)) errors.dtNascimentoConjuge = 'Informe uma data de nascimento válida.';
    if (form.celularConjuge && ![10, 11].includes(digits(form.celularConjuge).length)) errors.celularConjuge = 'Informe um celular com DDD.';
    if (form.rgConjuge && (String(form.rgConjuge).length < 5 || String(form.rgConjuge).length > 20)) errors.rgConjuge = 'Informe um RG válido.';
  }

  [
    ['cep', 'Informe o CEP.'], ['bairro', 'Informe o bairro.'], ['quadra', 'Informe a quadra.'],
    ['lote', 'Informe o lote.'], ['logradouro', 'Informe o logradouro.'], ['matricula', 'Informe a matrícula.'],
    ['valorVenal', 'Informe o valor venal.'], ['dtInicioMoradia', 'Informe o início da moradia.'],
    ['observacao', 'Informe a observação.'],
  ].forEach(([field, message]) => required(field, message));
  if (form.possuiPendencia !== true && form.possuiPendencia !== false) errors.possuiPendencia = 'Informe se existe pendência judicial.';
  if (form.cep && digits(form.cep).length !== 8) errors.cep = 'Informe um CEP válido.';
  if (form.matricula && !/^[\p{L}\p{N}./-]{1,30}$/u.test(form.matricula)) errors.matricula = 'Informe uma matrícula válida.';
  if (form.valorVenal !== '' && Number(form.valorVenal) < 0) errors.valorVenal = 'O valor venal não pode ser negativo.';
  if (form.dtInicioMoradia && !validDate(form.dtInicioMoradia)) errors.dtInicioMoradia = 'Informe uma data de início válida.';

  const propertyFields = ['cep', 'bairro', 'quadra', 'lote', 'logradouro', 'matricula', 'valorVenal', 'dtInicioMoradia', 'observacao', 'possuiPendencia'];
  const personalError = Object.keys(errors).some(field => !spouseFields.includes(field) && !propertyFields.includes(field));
  const spouseError = spouseFields.some(field => errors[field]);
  return { errors, firstTab: personalError ? 'pessoais' : spouseError ? 'conjuge' : 'imovel' };
}
