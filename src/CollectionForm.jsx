import React from 'react';
import { AlertCircle, FileText, HardDrive, LoaderCircle, Paperclip, ShieldCheck, Trash2 } from 'lucide-react';
import { documentText, hasPartner, maskCep, maskCpfCnpj, maskPhone, onlyDigits } from './formValidation';
import './form.css';

const education = [
  ['superior_completo', 'Superior completo'], ['superior_incompleto', 'Superior incompleto'],
  ['medio_completo', 'Ensino médio completo'], ['medio_incompleto', 'Ensino médio incompleto'],
  ['fundamental_completo', 'Ensino fundamental completo'], ['fundamental_incompleto', 'Ensino fundamental incompleto'],
];
const sex = [['masculino', 'Masculino'], ['feminino', 'Feminino'], ['outro', 'Outro']];

function FieldShell({ name, label, errors, children }) {
  return <label className="field" htmlFor={name}><span>{label}</span>{children}{errors[name] && <small className="field-error" id={`error-${name}`}>{errors[name]}</small>}</label>;
}

function TextField({ form, errors, updateField, name, label, transform, type = 'text', ...props }) {
  return <FieldShell name={name} label={label} errors={errors}><input id={name} type={type} value={form[name] ?? ''} onChange={event => updateField(name, transform ? transform(event.target.value) : event.target.value)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined} {...props} /></FieldShell>;
}

function SelectField({ form, errors, updateField, name, label, options, onChange }) {
  return <FieldShell name={name} label={label} errors={errors}><select id={name} value={form[name] ?? ''} onChange={event => onChange ? onChange(event.target.value) : updateField(name, event.target.value)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined}><option value="">Selecione uma opção</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></FieldShell>;
}

function BooleanField({ form, errors, updateField, name, label }) {
  const value = form[name] === true ? 'true' : form[name] === false ? 'false' : '';
  return <FieldShell name={name} label={label} errors={errors}><select id={name} value={value} onChange={event => updateField(name, event.target.value === '' ? '' : event.target.value === 'true')} aria-invalid={!!errors[name]}><option value="">Selecione uma opção</option><option value="true">Sim</option><option value="false">Não</option></select></FieldShell>;
}

export default function CollectionForm({ lot, form, errors, updateField, formTab, setFormTab, onCivilChange, onSubmit, busy, draftTime, attachDocument }) {
  const partner = hasPartner(form.estadoCivil);
  const spouseRequired = form.estadoCivil === 'casado';
  const tabItems = [['pessoais', 'Dados pessoais'], ...(partner ? [['conjuge', spouseRequired ? 'Cônjuge *' : 'Cônjuge (opcional)']] : []), ['imovel', 'Imóvel']];
  const required = spouseRequired ? ' *' : '';

  return <>
    <div className="page-heading"><h1>{`Coleta — Lote ${lot.id}`}</h1><p>REURB · O rascunho é salvo automaticamente neste dispositivo.</p></div>
    <div className="form-tabs" role="tablist" aria-label="Seções do formulário">{tabItems.map(([key, label]) => <button type="button" role="tab" aria-selected={formTab === key} key={key} onClick={() => setFormTab(key)}>{label}</button>)}</div>
    <form onSubmit={onSubmit} noValidate>
      {formTab === 'pessoais' && <div className="form-section form-grid">
        <TextField form={form} errors={errors} updateField={updateField} name="cpfCnpj" label="CPF/CNPJ *" transform={maskCpfCnpj} inputMode="numeric" placeholder="000.000.000-00" />
        <TextField form={form} errors={errors} updateField={updateField} name="nome" label="NOME *" maxLength="120" placeholder="Nome completo" />
        <TextField form={form} errors={errors} updateField={updateField} name="dtNascimento" label="DATA DE NASCIMENTO *" type="date" />
        <SelectField form={form} errors={errors} updateField={updateField} name="sexo" label="SEXO *" options={sex} />
        <TextField form={form} errors={errors} updateField={updateField} name="email" label="E-MAIL *" type="email" maxLength="120" placeholder="nome@exemplo.com" />
        <TextField form={form} errors={errors} updateField={updateField} name="rg" label="RG *" transform={value => documentText(value, 20)} placeholder="Número do RG" />
        <TextField form={form} errors={errors} updateField={updateField} name="orgaoExpedidor" label="ÓRGÃO EXPEDIDOR *" transform={value => documentText(value, 20)} placeholder="Ex.: SSP/MT" />
        <TextField form={form} errors={errors} updateField={updateField} name="cnh" label="CNH *" transform={value => onlyDigits(value, 11)} inputMode="numeric" placeholder="11 dígitos" />
        <TextField form={form} errors={errors} updateField={updateField} name="mae" label="NOME DA MÃE *" maxLength="120" />
        <TextField form={form} errors={errors} updateField={updateField} name="pai" label="NOME DO PAI *" maxLength="120" />
        <SelectField form={form} errors={errors} updateField={updateField} name="escolaridade" label="ESCOLARIDADE *" options={education} />
        <TextField form={form} errors={errors} updateField={updateField} name="naturalidade" label="NATURALIDADE *" maxLength="80" />
        <TextField form={form} errors={errors} updateField={updateField} name="nacionalidade" label="NACIONALIDADE *" maxLength="80" />
        <BooleanField form={form} errors={errors} updateField={updateField} name="outroImovel" label="POSSUI OUTRO IMÓVEL? *" />
        <TextField form={form} errors={errors} updateField={updateField} name="telefoneFixo" label="TELEFONE FIXO *" transform={maskPhone} inputMode="tel" placeholder="(00) 0000-0000" />
        <TextField form={form} errors={errors} updateField={updateField} name="celular" label="CELULAR *" transform={maskPhone} inputMode="tel" placeholder="(00) 00000-0000" />
        <TextField form={form} errors={errors} updateField={updateField} name="profissao" label="PROFISSÃO *" maxLength="80" />
        <TextField form={form} errors={errors} updateField={updateField} name="rendaFamiliar" label="RENDA FAMILIAR *" type="number" min="0" step="0.01" inputMode="decimal" />
        <SelectField form={form} errors={errors} updateField={updateField} name="estadoCivil" label="ESTADO CIVIL *" onChange={onCivilChange} options={[["solteiro", "Solteiro(a)"], ["casado", "Casado(a)"], ["divorciado", "Divorciado(a)"], ["viuvo", "Viúvo(a)"], ["uniao_estavel", "União estável"]]} />
        {partner && <SelectField form={form} errors={errors} updateField={updateField} name="regimeBens" label={`REGIME DE BENS${required}`} options={[["comunhao_parcial", "Comunhão parcial"], ["comunhao_universal", "Comunhão universal"], ["separacao", "Separação de bens"], ["participacao_final", "Participação final nos aquestos"]]} />}
      </div>}

      {formTab === 'conjuge' && partner && <div className="form-section form-grid">
        {!spouseRequired && <div className="form-note">Em união estável, os dados do cônjuge são opcionais. Campos informados ainda serão validados.</div>}
        <TextField form={form} errors={errors} updateField={updateField} name="cpfCnpjConjuge" label={`CPF/CNPJ DO CÔNJUGE${required}`} transform={maskCpfCnpj} inputMode="numeric" />
        <TextField form={form} errors={errors} updateField={updateField} name="nomeConjuge" label={`NOME DO CÔNJUGE${required}`} maxLength="120" />
        <TextField form={form} errors={errors} updateField={updateField} name="dtNascimentoConjuge" label={`NASCIMENTO DO CÔNJUGE${required}`} type="date" />
        <SelectField form={form} errors={errors} updateField={updateField} name="sexoConjuge" label={`SEXO DO CÔNJUGE${required}`} options={sex} />
        <TextField form={form} errors={errors} updateField={updateField} name="rgConjuge" label={`RG DO CÔNJUGE${required}`} transform={value => documentText(value, 20)} />
        <TextField form={form} errors={errors} updateField={updateField} name="orgaoExpedidorConjuge" label={`ÓRGÃO EXPEDIDOR${required}`} transform={value => documentText(value, 20)} />
        <TextField form={form} errors={errors} updateField={updateField} name="maeConjuge" label={`MÃE DO CÔNJUGE${required}`} maxLength="120" />
        <TextField form={form} errors={errors} updateField={updateField} name="paiConjuge" label={`PAI DO CÔNJUGE${required}`} maxLength="120" />
        <SelectField form={form} errors={errors} updateField={updateField} name="escolaridadeConjuge" label={`ESCOLARIDADE${required}`} options={education} />
        <TextField form={form} errors={errors} updateField={updateField} name="naturalidadeConjuge" label="NATURALIDADE (OPCIONAL)" maxLength="80" />
        <TextField form={form} errors={errors} updateField={updateField} name="nacionalidadeConjuge" label={`NACIONALIDADE${required}`} maxLength="80" />
        <TextField form={form} errors={errors} updateField={updateField} name="celularConjuge" label={`CELULAR${required}`} transform={maskPhone} inputMode="tel" />
        <TextField form={form} errors={errors} updateField={updateField} name="profissaoConjuge" label={`PROFISSÃO${required}`} maxLength="80" />
      </div>}

      {formTab === 'imovel' && <div className="form-section form-grid">
        <TextField form={form} errors={errors} updateField={updateField} name="cep" label="CEP *" transform={maskCep} inputMode="numeric" placeholder="00000-000" />
        <TextField form={form} errors={errors} updateField={updateField} name="bairro" label="BAIRRO *" maxLength="80" />
        <TextField form={form} errors={errors} updateField={updateField} name="quadra" label="QUADRA *" transform={value => documentText(value, 20)} />
        <TextField form={form} errors={errors} updateField={updateField} name="lote" label="LOTE *" transform={value => documentText(value, 20)} />
        <TextField form={form} errors={errors} updateField={updateField} name="logradouro" label="LOGRADOURO *" maxLength="160" />
        <BooleanField form={form} errors={errors} updateField={updateField} name="possuiPendencia" label="POSSUI PENDÊNCIA JUDICIAL? *" />
        <TextField form={form} errors={errors} updateField={updateField} name="matricula" label="MATRÍCULA *" transform={value => documentText(value, 30)} />
        <TextField form={form} errors={errors} updateField={updateField} name="valorVenal" label="VALOR VENAL *" type="number" min="0" step="0.01" inputMode="decimal" />
        <TextField form={form} errors={errors} updateField={updateField} name="dtInicioMoradia" label="INÍCIO DA MORADIA *" type="date" />
        <FieldShell name="observacao" label="OBSERVAÇÃO *" errors={errors}><textarea id="observacao" rows="4" maxLength="1000" value={form.observacao} onChange={event => updateField('observacao', event.target.value)} aria-invalid={!!errors.observacao} /></FieldShell>
        {form.possuiPendencia === true && <div className="document-field"><strong>DOCUMENTO DA PENDÊNCIA (OPCIONAL)</strong>{form.pendingDocument ? <div className="document-preview"><FileText size={18} /><span>{form.pendingDocument.name}</span><button type="button" onClick={() => updateField('pendingDocument', null)} aria-label="Remover documento"><Trash2 size={16} /></button></div> : <label className="document-upload"><Paperclip size={18} />Anexar imagem ou PDF<input type="file" accept="image/*,application/pdf" onChange={attachDocument} /></label>}</div>}
      </div>}

      <button className="button primary" type="submit" disabled={!!busy}>{busy === 'save' ? <LoaderCircle className="spin" size={18} /> : <HardDrive size={17} />}{busy === 'save' ? 'Finalizando…' : 'Finalizar coleta offline'}</button>
      <p className="draft-status"><ShieldCheck size={13} />{draftTime ? 'Rascunho salvo neste dispositivo' : 'As alterações serão salvas automaticamente'}</p>
      {Object.keys(errors).length > 0 && <div className="form-summary" role="alert"><AlertCircle size={16} />Revise os campos destacados antes de finalizar.</div>}
    </form>
  </>;
}
