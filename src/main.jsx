import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, Grid2X2, RefreshCw, UserRound, Wifi, WifiOff, Smartphone, MapPin, ChevronRight, HardDrive, CloudUpload, AlertCircle, X, Trash2, RotateCcw, CheckCheck, LoaderCircle, ShieldCheck, Info } from 'lucide-react';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { lots, demoSession, initialState, loadState, saveState, blankForm, formatDate, delay } from './storage';
import CollectionForm from './CollectionForm';
import { clearSpouse, hasPartner, hasSpouseData, validateCollectionForm } from './formValidation';
import './styles.css';
import './session.css';

const statusLabels = { pending: 'Pendente', sending: 'Enviando', sent: 'Enviado', error: 'Erro' };
const pageSubtitles = { lots: 'Consulta e coleta de dados em campo', prepare: 'Download dos dados necessários', detail: 'Dados do lote e informações da coleta', form: 'Registro de informações em campo', saved: 'Registro armazenado no dispositivo', queue: 'Fila de registros locais', synced: 'Sincronização de demonstração concluída', device: 'Seus dados, neste dispositivo' };
const screenDots = { lots: 0, prepare: 3, detail: 4, form: 5, saved: 6, queue: 7, synced: 8, device: 0 };
const normalizeForm = (lot, stored = {}) => ({ ...blankForm(lot), ...stored, nome: stored.nome || stored.name || '', possuiCnh: stored.possuiCnh ?? (stored.cnh ? true : '') });
const Button = ({ children, secondary, className = '', ...props }) => <button className={`button ${secondary ? 'secondary' : 'primary'} ${className}`} {...props}>{children}</button>;
const Banner = ({ title, children, type = 'success', icon: Icon = Info }) => <div className={`banner ${type}`}><Icon size={18} /><div><strong>{title}</strong>{children && <p>{children}</p>}</div></div>;
const Heading = ({ title, children, back }) => <div className="page-heading">{back && <button className="back" onClick={back}><ArrowLeft size={15} />Voltar</button>}<h1>{title}</h1>{children && <p>{children}</p>}</div>;

function App() {
  const [data, setData] = useState(initialState);
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('lots');
  const [bairro, setBairro] = useState('Centro');
  const [quadra, setQuadra] = useState('');
  const [selected, setSelected] = useState(lots.filter(l => l.bairro === 'Centro').map(l => l.id));
  const [active, setActive] = useState(null);
  const [form, setForm] = useState(null);
  const [formTab, setFormTab] = useState('pessoais');
  const [errors, setErrors] = useState({});
  const [simOffline, setSimOffline] = useState(false);
  const [realOnline, setRealOnline] = useState(navigator.onLine);
  const online = realOnline && !simOffline;
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const [progress, setProgress] = useState(0);
  const [failNext, setFailNext] = useState(false);
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [draftTime, setDraftTime] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmClearSpouse, setConfirmClearSpouse] = useState(false);
  const [pendingCivil, setPendingCivil] = useState('');
  const [installEvent, setInstallEvent] = useState(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const mainRef = useRef(null);

  const notify = (message, kind = 'success') => setToast({ message, kind, id: Date.now() });
  useEffect(() => {
    loadState().then(async stored => {
      const recovered = { ...stored, records: stored.records.map(r => r.status === 'sending' ? { ...r, status: 'error', error: 'O envio foi interrompido. Tente novamente.' } : r) };
      await saveState(recovered);
      dataRef.current = recovered; setData(recovered); setReady(true);
    }).catch(e => { setStorageError(e.message); setReady(true); });
    const network = () => setRealOnline(navigator.onLine);
    const install = e => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('online', network); window.addEventListener('offline', network);
    window.addEventListener('beforeinstallprompt', install);
    return () => { window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('beforeinstallprompt', install); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [screen]);

  async function commit(change) {
    const previous = dataRef.current;
    const next = change(previous);
    dataRef.current = next;
    try { await saveState(next); setData(dataRef.current); return next; }
    catch (error) { if (dataRef.current === next) dataRef.current = previous; throw error; }
  }

  useEffect(() => {
    if (screen !== 'form' || !form || busy || !active) return;
    const timer = setTimeout(() => {
      commit(s => ({ ...s, drafts: { ...s.drafts, [active.id]: form } }))
        .then(() => setDraftTime(new Date().toISOString()))
        .catch(e => notify(e.message, 'error'));
    }, 600);
    return () => clearTimeout(timer);
  }, [form, screen, busy, active]);

  const session = data.session;
  const sessionRecords = data.records.filter(r => !session || (r.userId === session.userId && r.projectId === session.projectId));
  const pending = sessionRecords.filter(r => r.status !== 'sent');
  const prepared = Object.values(data.prepared);
  const source = online ? lots : prepared;
  const visible = source.filter(l => (!bairro || l.bairro === bairro) && (!quadra || l.quadra === quadra));
  const chosen = visible.filter(l => selected.includes(l.id));
  const quadras = [...new Set(lots.filter(l => !bairro || l.bairro === bairro).map(l => l.quadra))];
  const step = ['prepare'].includes(screen) ? 1 : ['detail', 'form'].includes(screen) ? 2 : ['saved', 'queue'].includes(screen) ? 3 : screen === 'synced' ? 4 : 0;

  async function navigate(target) {
    if (busy) return;
    if (screen === 'form' && form && active) {
      try { await commit(s => ({ ...s, drafts: { ...s.drafts, [active.id]: form } })); }
      catch (error) { notify(error.message, 'error'); return; }
    }
    setScreen(target);
  }
  function changeFilter(nextBairro, nextQuadra) {
    setBairro(nextBairro); setQuadra(nextQuadra);
    setSelected(lots.filter(l => (!nextBairro || l.bairro === nextBairro) && (!nextQuadra || l.quadra === nextQuadra)).map(l => l.id));
  }
  function openLot(lot) { setActive(lot); setScreen('detail'); }
  function openForm() {
    if (!data.prepared[active.id]) return notify('Prepare este lote para iniciar a coleta nesta simulação.', 'error');
    const existing = sessionRecords.find(r => r.lotId === active.id && r.status !== 'sent');
    const stored = data.drafts[active.id] || existing?.form;
    setForm(normalizeForm(active, stored));
    setFormTab('pessoais'); setErrors({}); setDraftTime(null); setScreen('form');
  }
  function updateField(key, value) { setForm(prev => ({ ...prev, [key]: value })); setErrors(prev => ({ ...prev, [key]: '' })); }
  function changeCivilStatus(next) {
    if (hasPartner(form.estadoCivil) && !hasPartner(next) && hasSpouseData(form)) {
      setPendingCivil(next); setConfirmClearSpouse(true); return;
    }
    setForm(prev => ({ ...prev, estadoCivil: next, ...(!hasPartner(next) ? { regimeBens: '' } : {}) }));
    setErrors(prev => ({ ...prev, estadoCivil: '', regimeBens: '' }));
    if (!hasPartner(next)) setFormTab('pessoais');
  }
  function confirmCivilChange() {
    setForm(prev => ({ ...clearSpouse(prev), estadoCivil: pendingCivil, regimeBens: '' }));
    setErrors({}); setFormTab('pessoais'); setPendingCivil(''); setConfirmClearSpouse(false);
  }

  async function prepareLots() {
    if (lock.current) return;
    if (!onlineRef.current) return notify('Conecte-se para preparar os dados.', 'error');
    if (!chosen.length) return notify('Selecione ao menos um lote.', 'error');
    lock.current = true; setBusy('prepare'); setProgress(0);
    try {
      for (let i = 1; i <= 4; i++) { await delay(250); if (!onlineRef.current) throw new Error('Preparação interrompida. Sua seleção foi mantida para tentar novamente.'); setProgress(i * 25); }
      await commit(s => ({ ...s, lastPrepared: new Date().toISOString(), prepared: { ...s.prepared, ...Object.fromEntries(chosen.map(l => [l.id, { ...l, userId: session.userId, projectId: session.projectId, preparedAt: new Date().toISOString() }])) } }));
      notify(`${chosen.length} lotes preparados para uso offline.`); setScreen('lots');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (lock.current) return;
    const validation = validateCollectionForm(form);
    if (Object.keys(validation.errors).length) {
      setErrors(validation.errors); setFormTab(validation.firstTab); notify('Revise os campos destacados antes de finalizar.', 'error'); return;
    }
    lock.current = true; setBusy('save');
    try {
      await commit(s => {
        const existing = s.records.find(r => r.userId === session.userId && r.projectId === session.projectId && r.lotId === active.id && r.status !== 'sent');
        const record = { id: existing?.id || crypto.randomUUID(), userId: session.userId, projectId: session.projectId, lotId: active.id, form, status: 'pending', createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), attempts: existing?.attempts || 0, error: '' };
        const drafts = { ...s.drafts }; delete drafts[active.id];
        return { ...s, drafts, records: existing ? s.records.map(r => r.id === existing.id ? record : r) : [...s.records, record] };
      });
      setScreen('saved');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }

  async function synchronize() {
    if (lock.current || !onlineRef.current || storageError) return;
    const queue = dataRef.current.records.filter(r => r.userId === session.userId && r.projectId === session.projectId && (r.status === 'pending' || r.status === 'error'));
    if (!queue.length) return;
    lock.current = true; setBusy('sync'); setProgress(0);
    let success = 0; let shouldFail = failNext;
    setFailNext(false);
    try {
      for (const [index, record] of queue.entries()) {
        if (!onlineRef.current) break;
        await commit(s => ({ ...s, records: s.records.map(r => r.id === record.id ? { ...r, status: 'sending', attempts: r.attempts + 1, error: '' } : r) }));
        await delay(850);
        const error = !onlineRef.current ? 'Conexão interrompida. O registro continua neste dispositivo.' : shouldFail ? 'O servidor simulado não respondeu. Tente novamente.' : '';
        shouldFail = false;
        await commit(s => ({ ...s, records: s.records.map(r => r.id === record.id ? { ...r, status: error ? 'error' : 'sent', error, sentAt: error ? null : new Date().toISOString() } : r) }));
        if (!error) success++;
        setProgress(Math.round((index + 1) / queue.length * 100));
      }
      const remaining = dataRef.current.records.filter(r => r.userId === session.userId && r.projectId === session.projectId && r.status !== 'sent');
      if (!remaining.length) { setSyncedCount(success); setScreen('synced'); }
      else notify(`${success} enviado(s). ${remaining.length} registro(s) preservado(s) para nova tentativa.`, 'error');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }

  async function attachDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if ((!file.type.startsWith('image/') && file.type !== 'application/pdf') || file.size > 5 * 1024 * 1024) { notify('Escolha uma imagem ou PDF com até 5 MB.', 'error'); event.target.value = ''; return; }
    const reader = new FileReader(); reader.onload = () => updateField('pendingDocument', { name: file.name, type: file.type, data: reader.result }); reader.onerror = () => notify('Não foi possível ler o documento.', 'error'); reader.readAsDataURL(file);
  }

  async function clearPrepared() {
    if (pending.length || Object.keys(data.drafts).length) return notify('Conclua os rascunhos e sincronize as pendências antes de remover os lotes.', 'error');
    try { await commit(s => ({ ...s, prepared: {}, lastPrepared: null })); notify('Lotes preparados removidos deste dispositivo.'); }
    catch (e) { notify(e.message, 'error'); }
  }
  async function resetDemo() {
    try { await commit(() => ({ ...initialState(), session })); setConfirmReset(false); setSimOffline(false); changeFilter('Centro', ''); setScreen('lots'); notify('Simulação reiniciada.'); }
    catch (e) { notify(e.message, 'error'); }
  }

  async function signIn() {
    if (!realOnline || lock.current) return;
    if (credentials.username !== 'teste123' || credentials.password !== 'teste123') {
      setAuthError('Usuário ou senha inválidos. Use as credenciais de demonstração.');
      return;
    }
    lock.current = true; setBusy('signin');
    try { await delay(350); await commit(s => ({ ...s, session: demoSession })); setAuthError(''); setScreen('lots'); }
    catch (e) { setStorageError(e.message); }
    finally { setBusy(''); lock.current = false; }
  }

  async function signOut() {
    try { await commit(s => ({ ...s, session: null })); setCredentials({ username: '', password: '' }); setAuthError(''); setConfirmLogout(false); setScreen('lots'); }
    catch (e) { notify(e.message, 'error'); }
  }

  if (!ready) return <div className="auth-page"><LoaderCircle className="spin" /><p>Preparando seu dispositivo...</p></div>;
  if (storageError) return <div className="auth-page"><section className="auth-card"><Banner type="error" title="Armazenamento indisponível">{storageError} Tente abrir em uma janela normal do navegador.</Banner></section></div>;
  if (!session) return <div className="auth-page"><form className="auth-card" onSubmit={e => { e.preventDefault(); signIn(); }}><div className="auth-brand">GEOCOLETA</div><span className="auth-label">SIMULAÇÃO · DADOS FICTÍCIOS</span><h1>Acessar demonstração</h1><p>O primeiro acesso exige conexão. Depois de preparar os lotes, esta sessão poderá continuar funcionando offline.</p><div className="auth-fields"><label className="field"><span>USUÁRIO</span><input autoComplete="username" value={credentials.username} onChange={e => { setCredentials(c => ({ ...c, username: e.target.value })); setAuthError(''); }} placeholder="Digite o usuário" /></label><label className="field"><span>SENHA</span><input type="password" autoComplete="current-password" value={credentials.password} onChange={e => { setCredentials(c => ({ ...c, password: e.target.value })); setAuthError(''); }} placeholder="Digite a senha" /></label>{authError && <p className="field-error" role="alert">{authError}</p>}<small>Credenciais de teste: <strong>teste123</strong> / <strong>teste123</strong></small></div><div className="auth-identity"><UserRound size={20} /><div><strong>{demoSession.userName}</strong><span>{demoSession.projectName}</span></div></div><Banner title={realOnline ? 'Conexão disponível' : 'Conecte-se para entrar'} type={realOnline ? 'success' : 'warning'} icon={realOnline ? Wifi : WifiOff}>{realOnline ? 'A senha é validada somente na simulação e não é armazenada.' : 'O acesso offline só é liberado depois de uma sessão iniciada online.'}</Banner><Button type="submit" disabled={!realOnline || !!busy}>{busy === 'signin' ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={17} />}{busy === 'signin' ? 'Entrando…' : 'Entrar na demonstração'}</Button><small>Conta e projeto fictícios para validação acadêmica.</small></form></div>;

  return <div className="demo-layout">
    <aside className="demo-guide">
      <div className="eyebrow"><span className="live-dot" />PROTÓTIPO INTERATIVO</div>
      <h2>Seu trabalho<br />continua.<br /><span>Mesmo offline.</span></h2>
      <p className="guide-intro">Prepare a área, vá a campo e registre cada detalhe. Sincronize quando a conexão voltar.</p>
      <ol className="journey">{[['Selecione os lotes', 'Filtre por bairro e quadra.'], ['Prepare para offline', 'Guarde os dados neste dispositivo.'], ['Faça a coleta', 'Preencha o REURB sem internet.'], ['Sincronize os registros', 'Envie suas pendências ao reconectar.']].map(([title, description], i) => <li className={step === i ? 'current' : step > i ? 'complete' : ''} key={title}><span>{step > i ? <Check size={15} /> : `0${i + 1}`}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
      <div className="demo-controls"><div className="control-heading"><Smartphone size={17} /><strong>Controles da simulação</strong></div><label className="toggle-row"><span>Simular sem internet<small>O aplicativo continua funcionando.</small></span><input type="checkbox" checked={simOffline} onChange={e => setSimOffline(e.target.checked)} aria-label="Simular sem internet" /><span className="switch" aria-hidden="true" /></label><label className="failure-control"><input type="checkbox" checked={failNext} onChange={e => setFailNext(e.target.checked)} disabled={!!busy} />Simular falha no próximo envio</label></div>
      <p className="demo-disclaimer"><ShieldCheck size={15} />Dados fictícios. Nenhuma conexão com as APIs reais.</p>
      <a className="figma-link" href="https://www.figma.com/design/jqhxF8XHFV0Q6FbgWiocYx/GeoColeta-PWA?node-id=0-1" target="_blank" rel="noreferrer">Baseado no protótipo do Figma<ArrowRight size={14} /></a>
    </aside>

    <div className="app-shell">
      <div className="simulation-ribbon"><span>SIMULAÇÃO · DADOS FICTÍCIOS</span><span>GeoColeta PWA</span></div>
      <header className="app-header"><div><div className="wordmark">GEOCOLETA</div><p>{pageSubtitles[screen]}</p></div><button className={`connection-toggle ${online ? '' : 'offline'}`} onClick={() => setSimOffline(v => !v)} aria-label={simOffline ? 'Voltar ao modo online' : 'Ativar modo offline'} title="Alternar modo da simulação">{online ? <Wifi size={20} /> : <WifiOff size={20} />}</button></header>
      <div className={`connection-bar ${online ? 'online' : 'offline'}`} role="status"><img src={`/assets/figma-${online ? (['detail','form','saved'].includes(screen) ? 0 : screenDots[screen]) : (['detail','form','saved'].includes(screen) ? screenDots[screen] : 4)}.svg`} width="9" height="9" alt="" />{online ? 'Online — conexão disponível' : 'Offline — registros salvos neste dispositivo'}</div>

      <main ref={mainRef} className={`app-content screen-${screen}`}>
        {!ready ? <div className="loading-screen"><LoaderCircle className="spin" /><p>Preparando seu dispositivo...</p></div> : storageError ? <Banner type="error" title="Armazenamento indisponível">{storageError} Tente abrir em uma janela normal do navegador.</Banner> : <>
          {screen === 'lots' && <><Heading title="Lotes disponíveis">Filtre os lotes e prepare os dados antes de sair para campo.</Heading><div className="filters"><label className="field"><span>BAIRRO</span><select aria-label="Bairro" value={bairro} onChange={e => changeFilter(e.target.value, '')}><option value="">Todos</option>{[...new Set(lots.map(l => l.bairro))].map(b => <option key={b}>{b}</option>)}</select></label><label className="field"><span>QUADRA</span><select aria-label="Quadra" value={quadra} onChange={e => changeFilter(bairro, e.target.value)}><option value="">Todas</option>{quadras.map(q => <option key={q} value={q}>Q-{q}</option>)}</select></label></div><Button secondary onClick={() => { if (!online) return notify('A preparação precisa de internet. Os lotes já preparados continuam disponíveis.', 'error'); if (!chosen.length) return notify('Selecione pelo menos um lote.', 'error'); setScreen('prepare'); }} disabled={!ready || !!busy}><Download size={17} />Preparar lotes para uso offline</Button>{!online && <Banner title="Você está trabalhando offline" icon={HardDrive}>Somente os lotes preparados neste dispositivo aparecem na lista.</Banner>}<div className="results-heading"><span>RESULTADOS <b>{visible.length} lotes</b></span><button onClick={() => setSelected(chosen.length === visible.length ? [] : visible.map(l => l.id))}>{chosen.length === visible.length && visible.length ? 'Desmarcar' : 'Selecionar todos'}</button></div><div className="lots-list">{visible.map(lot => <article className="lot-card" key={lot.id}><div className="lot-top"><span className={`business-status status-${lot.status}`}><img src={`/assets/figma-${lot.status === 'Aguardando' ? 2 : 1}.svg`} width="7" height="7" alt="" />{lot.status}</span><div>{data.prepared[lot.id] && <span className="badge green">offline</span>}{online && <input type="checkbox" aria-label={`Selecionar lote ${lot.id}`} checked={selected.includes(lot.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, lot.id] : prev.filter(id => id !== lot.id))} />}</div></div><button className="lot-open" onClick={() => openLot(lot)}><strong>{lot.address}</strong><span><span>Lote {lot.id} <i>·</i> Quadra {lot.quadra}</span><b>Abrir <ChevronRight size={13} /></b></span></button>{data.drafts[lot.id] && <span className="draft-indicator">Rascunho neste dispositivo</span>}</article>)}</div>{!visible.length && <div className="empty-state"><MapPin size={32} /><h3>{online ? 'Nenhum lote nesta seleção' : 'Esta área ainda não está offline'}</h3><p>{online ? 'Experimente outro bairro ou quadra.' : 'Volte ao modo online e prepare os lotes antes de sair para campo.'}</p></div>}<p className="last-update">Última preparação: {formatDate(data.lastPrepared)}</p></>}

          {screen === 'prepare' && <><Heading title="Preparar uso offline" back={() => navigate('lots')}>Escolha quais dados ficarão disponíveis neste dispositivo.</Heading><Banner title={online ? 'Conexão disponível' : 'Conexão indisponível'} type={online ? 'success' : 'error'} icon={online ? Wifi : WifiOff}>{online ? 'Faça o download antes de ir para uma região sem sinal.' : 'Seus filtros foram mantidos. Reconecte para continuar.'}</Banner><section className="data-card"><h3>Dados selecionados</h3><ul className="check-list"><li><Check size={16} />{chosen.length} lotes da área selecionada</li><li><Check size={16} />Endereços e situação atual</li><li><Check size={16} />Formulário REURB e dados do lote</li></ul><div className="area-summary"><span>{bairro || 'Todos os bairros'}</span><span>{quadra ? `Quadra ${quadra}` : 'Todas as quadras'}</span></div><small>Dados de demonstração · armazenamento local</small></section>{busy === 'prepare' && <div className="progress" role="progressbar" aria-label="Preparação dos lotes" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>}<Button onClick={prepareLots} disabled={!online || !!busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}{busy ? `Preparando dados… ${progress}%` : 'Baixar dados para uso offline'}</Button><p className="last-update">Última preparação: {formatDate(data.lastPrepared)}</p></>}

          {screen === 'detail' && active && <><Heading title={`Lote ${active.id}`} back={() => navigate('lots')}>{active.address}</Heading>{data.prepared[active.id] ? <Banner title="Disponível offline" icon={HardDrive}>Esses dados foram preparados neste dispositivo.</Banner> : <Banner title="Este lote ainda não foi preparado" type="warning">Prepare os dados na lista para iniciar a coleta.</Banner>}<section className="data-card lot-facts"><dl>{[['Bairro', active.bairro], ['Quadra', `Q-${active.quadra}`], ['Inscrição', active.inscription], ['Situação', active.status]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section><div className="location-placeholder"><MapPin size={23} /><div><strong>{active.address}, {active.number}</strong><p>Localização textual disponível. O mapa não faz parte desta simulação.</p></div></div>{data.drafts[active.id] && <Banner type="warning" title="Você tem um rascunho">Continue de onde parou. Os campos foram mantidos.</Banner>}<div className="bottom-action"><Button onClick={openForm} disabled={!data.prepared[active.id]}>{data.drafts[active.id] ? 'Continuar coleta' : 'Iniciar coleta'}<ArrowRight size={17} /></Button></div></>}

          {screen === 'form' && form && active && <CollectionForm lot={active} form={form} errors={errors} updateField={updateField} formTab={formTab} setFormTab={setFormTab} onCivilChange={changeCivilStatus} onSubmit={saveRecord} busy={busy} draftTime={draftTime} attachDocument={attachDocument} />}

          {screen === 'saved' && <><section className="success-panel"><span className="success-icon"><Check size={34} strokeWidth={2.5} /></span><h1>Registro salvo</h1><p>A coleta foi armazenada no dispositivo e está aguardando sincronização.</p></section><Banner type="warning" title={`${pending.length} ${pending.length === 1 ? 'item pendente' : 'itens pendentes'}`}>Sincronize quando a conexão estiver disponível.</Banner><Button onClick={() => navigate('queue')}>Ver pendências<ArrowRight size={17} /></Button><Button secondary onClick={() => navigate('lots')}>Voltar para lotes</Button></>}

          {screen === 'queue' && <><Heading title="Pendências de sincronização">Revise os registros salvos neste dispositivo.</Heading><Banner title={online ? 'Conexão disponível' : 'Sem conexão no momento'} type={online ? 'success' : 'warning'} icon={online ? Wifi : WifiOff}>{online ? 'Agora é possível simular o envio dos registros pendentes.' : 'Suas coletas estão seguras. Reconecte para sincronizar.'}</Banner>{!sessionRecords.length && <div className="empty-state"><CheckCheck size={35} /><h3>Nenhuma pendência por aqui</h3><p>Suas coletas salvas aparecerão nesta tela.</p><button className="text-button" onClick={() => navigate('lots')}>Ir para os lotes<ArrowRight size={14} /></button></div>}<div className="queue-list">{[...sessionRecords].reverse().map(record => { const lot = lots.find(l => l.id === record.lotId); return <article className="data-card queue-card" key={record.id}><div className="queue-title"><h3>Lote {record.lotId}</h3><span className={`badge ${record.status}`}>{record.status === 'sending' && <LoaderCircle size={11} className="spin" />}{statusLabels[record.status]}</span></div><p>{lot.address}</p><small>{record.status === 'sent' ? 'Enviado na simulação' : 'Salvo'} em {formatDate(record.status === 'sent' ? record.sentAt : record.createdAt)}</small>{record.error && <div className="queue-error"><AlertCircle size={14} /><span>{record.error}</span></div>}{record.status !== 'sent' && record.status !== 'sending' && <button className="text-button" onClick={() => { setActive(lot); setForm(normalizeForm(lot, record.form)); setFormTab('pessoais'); setErrors({}); setScreen('form'); }}>Revisar coleta<ChevronRight size={13} /></button>}</article>; })}</div><div className="bottom-action">{busy === 'sync' && <div className="progress" role="progressbar" aria-label="Sincronização" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>}<Button onClick={synchronize} disabled={!online || !pending.length || !!busy}>{busy === 'sync' ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={17} />}{busy === 'sync' ? `Sincronizando… ${progress}%` : `Sincronizar ${pending.length} ${pending.length === 1 ? 'registro' : 'registros'}`}</Button><label className="mobile-failure"><input type="checkbox" checked={failNext} onChange={e => setFailNext(e.target.checked)} disabled={!!busy} />Simular falha no próximo envio</label></div></>}

          {screen === 'synced' && <><section className="success-panel synced"><span className="success-icon"><Check size={34} strokeWidth={2.5} /></span><h1>Tudo sincronizado</h1><p>{syncedCount} {syncedCount === 1 ? 'registro enviado' : 'registros enviados'} com sucesso na simulação.</p><span className="badge green">0 pendências</span></section><Banner title="Demonstração concluída" type="info">Nenhum dado foi enviado ao sistema real da empresa.</Banner><Button onClick={() => navigate('lots')}>Voltar para a lista de lotes</Button><Button secondary onClick={() => navigate('queue')}>Ver registros enviados</Button></>}

          {screen === 'device' && <><Heading title="Meu dispositivo">Acompanhe os dados disponíveis neste navegador.</Heading><section className="session-card"><UserRound size={19} /><div><strong>{session.userName}</strong><span>{session.projectName}</span></div></section><div className="storage-stats"><div><HardDrive size={21} /><strong>{prepared.length}</strong><span>Lotes offline</span></div><div><CloudUpload size={21} /><strong>{pending.length}</strong><span>Pendências</span></div><div><CheckCheck size={21} /><strong>{sessionRecords.filter(r => r.status === 'sent').length}</strong><span>Enviados</span></div></div><section className="data-card"><h3>Áreas preparadas</h3>{!prepared.length ? <p>Nenhuma área preparada neste dispositivo.</p> : [...new Set(prepared.map(l => l.bairro))].map(b => <div className="prepared-area" key={b}><MapPin size={17} /><div><strong>{b}</strong><small>{prepared.filter(l => l.bairro === b).length} lotes disponíveis offline</small></div><CheckCircle2 size={17} /></div>)}<small className="last-update">Atualizado: {formatDate(data.lastPrepared)}</small></section>{installEvent && <Button onClick={async () => { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); }}><Download size={17} />Instalar aplicativo</Button>}<Button secondary onClick={clearPrepared} disabled={!!busy || !prepared.length}><Trash2 size={17} />Remover lotes preparados</Button><Banner title="Seus registros permanecem aqui" type="info">As coletas e os rascunhos são mantidos ao fechar ou atualizar a página. Não limpe os dados do navegador durante o teste.</Banner><button className="reset-button" onClick={() => setConfirmReset(true)}><RotateCcw size={15} />Reiniciar a simulação</button><button className="reset-button" onClick={() => pending.length || Object.keys(data.drafts).length ? setConfirmLogout(true) : signOut()}><ArrowLeft size={15} />Sair da demonstração</button><p className="version">GeoColeta PWA · Simulação 1.0<br />Estrutura baseada no protótipo Figma</p></>}
        </>}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">{[['lots', Grid2X2, 'Lotes'], ['queue', RefreshCw, 'Pendências'], ['device', UserRound, 'Dispositivo']].map(([key, Icon, label]) => <button key={key} className={(key === 'lots' && !['queue','synced','device'].includes(screen)) || screen === key || (key === 'queue' && screen === 'synced') ? 'active' : ''} onClick={() => navigate(key)} disabled={!!busy}><span className="nav-icon"><Icon size={19} />{key === 'queue' && pending.length > 0 && <b>{pending.length}</b>}</span>{label}</button>)}</nav>
    </div>
    {toast && <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.kind === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Fechar mensagem"><X size={17} /></button></div>}
    {confirmReset && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><RotateCcw size={27} /><h2 id="reset-title">Começar de novo?</h2><p>Isso remove somente os dados desta simulação neste navegador, incluindo rascunhos e pendências.</p><button className="button primary" onClick={resetDemo}>Reiniciar simulação</button><button autoFocus className="button secondary" onClick={() => setConfirmReset(false)}>Continuar de onde parei</button></div></div>}
    {confirmLogout && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="logout-title"><AlertCircle size={27} /><h2 id="logout-title">Existem dados não sincronizados</h2><p>Ao sair, eles permanecerão protegidos neste dispositivo e voltarão a aparecer no próximo acesso desta conta fictícia.</p><button className="button primary" onClick={signOut}>Sair sem apagar os dados</button><button autoFocus className="button secondary" onClick={() => setConfirmLogout(false)}>Continuar conectado</button></div></div>}
    {confirmClearSpouse && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="spouse-title"><AlertCircle size={27} /><h2 id="spouse-title">Remover dados do cônjuge?</h2><p>O novo estado civil não utiliza essa seção. Confirme para apagar os dados já preenchidos.</p><button className="button primary" onClick={confirmCivilChange}>Alterar e remover dados</button><button autoFocus className="button secondary" onClick={() => { setPendingCivil(''); setConfirmClearSpouse(false); }}>Manter estado civil anterior</button></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Cache offline indisponível:', error.message));
