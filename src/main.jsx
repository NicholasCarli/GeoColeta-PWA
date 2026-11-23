import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, Grid2X2, RefreshCw, UserRound, Wifi, WifiOff, MapPin, ChevronRight, HardDrive, CloudUpload, AlertCircle, X, Trash2, RotateCcw, CheckCheck, LoaderCircle, Info, ClipboardCheck } from 'lucide-react';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { initialState, loadState, saveState, blankForm, validatedForms, formatDate, delay } from './storage';
import { collectionLabels, syncLabels, collectionStatus, recordForLot, isReadOnly, canSynchronize, startCollection, saveDraft, finishCollection } from './collectionWorkflow';
import CollectionForm from './CollectionForm';
import { clearSpouse, hasPartner, hasSpouseData, validateCollectionForm } from './formValidation';
import { authenticate, endAuthentication, loadRemoteCollections, loadRemoteContext, restoreAuthentication, returnRemoteCollection, synchronizeCollection, validateRemoteCollection } from './supabase';
import './styles.css';
import './session.css';

const statusLabels = syncLabels;
const pageSubtitles = { lots: 'Consulta e coleta de dados em campo', prepare: 'Download dos dados necessários', detail: 'Dados do lote e informações da coleta', form: 'Registro de informações em campo', saved: 'Registro armazenado no dispositivo', queue: 'Fila de registros locais', synced: 'Sincronização concluída', validation: 'Análise das coletas sincronizadas', device: 'Seus dados, neste dispositivo' };
const screenDots = { lots: 0, prepare: 3, detail: 4, form: 5, saved: 6, queue: 7, synced: 8, validation: 0, device: 0 };
const remoteStatus = { Aguardando: 'waiting', Ativo: 'active', Pausado: 'paused', Finalizado: 'finished', Validado: 'validated', Correcao: 'returned' };
const remoteCollectionStatus = { Finalizada: 'finished', Validada: 'validated', Devolvida: 'returned' };
const reviewRoles = ['WCOGEO_ADMIN', 'WCOGEO_ANALISTA', 'PREFEITURA_ADMIN'];
const reviewLabels = { Finalizada: 'Aguardando validação', Validada: 'Validada', Devolvida: 'Devolvida para correção' };
const permissionLabels = { WCOGEO_ADMIN: 'Administrador WCOGEO', WCOGEO_ANALISTA: 'Analista WCOGEO', WCOGEO_USUARIO: 'Usuário WCOGEO', PREFEITURA_ADMIN: 'Administrador da prefeitura', PREFEITURA_USUARIO: 'Usuário da prefeitura' };
const applyRemoteContext = (stored, context) => {
  const serverStates = Object.fromEntries(context.lots.filter(lot => lot.status !== 'Aguardando').map(lot => [lot.id, remoteStatus[lot.status]]));
  const collectionStates = { ...serverStates, ...stored.collectionStates };
  if (reviewRoles.includes(context.session.permission)) return { ...stored, session: context.session, collectionStates };
  const records = [...stored.records];
  const prepared = { ...stored.prepared };
  for (const remote of context.collections || []) {
    const localIndex = records.findIndex(record => record.lotId === remote.lotId && record.userId === context.session.userId && record.projectId === context.session.projectId);
    const local = records[localIndex];
    if (stored.drafts[remote.lotId] || ['pending', 'sending', 'error'].includes(local?.status)) continue;
    const record = {
      id: remote.id, userId: context.session.userId, projectId: context.session.projectId,
      lotId: remote.lotId, form: remote.form, status: 'synced', createdAt: remote.createdAt,
      updatedAt: remote.updatedAt, attempts: local?.attempts || 0, error: '', sentAt: remote.sentAt,
      remoteStatus: remote.remoteStatus, validatedAt: remote.validatedAt,
      returnedAt: remote.returnedAt, returnReason: remote.returnReason,
    };
    if (localIndex >= 0) records[localIndex] = record; else records.push(record);
    prepared[remote.lotId] = { ...remote.lot, userId: context.session.userId, projectId: context.session.projectId, preparedAt: remote.sentAt };
    collectionStates[remote.lotId] = remoteCollectionStatus[remote.remoteStatus];
  }
  return { ...stored, session: context.session, collectionStates, records, prepared };
};
const normalizeForm = (lot, stored = {}) => ({ ...blankForm(lot), ...stored, nome: stored.nome || stored.name || '', possuiCnh: stored.possuiCnh ?? (stored.cnh ? true : '') });
const Button = ({ children, secondary, className = '', ...props }) => <button className={`button ${secondary ? 'secondary' : 'primary'} ${className}`} {...props}>{children}</button>;
const Banner = ({ title, children, type = 'success', icon: Icon = Info }) => <div className={`banner ${type}`}><Icon size={18} /><div><strong>{title}</strong>{children && <p>{children}</p>}</div></div>;
const Heading = ({ title, children, back }) => <div className="page-heading">{back && <button className="back" onClick={back}><ArrowLeft size={15} />Voltar</button>}<h1>{title}</h1>{children && <p>{children}</p>}</div>;
const CollectionBadge = ({ status }) => <span className={`collection-status collection-${status}`}>Coleta: {collectionLabels[status]}</span>;

function App() {
  const [data, setData] = useState(initialState);
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [lots, setLots] = useState([]);
  const [remoteCollections, setRemoteCollections] = useState([]);
  const [screen, setScreen] = useState('lots');
  const [bairro, setBairro] = useState('');
  const [quadra, setQuadra] = useState('');
  const [selected, setSelected] = useState([]);
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
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [draftTime, setDraftTime] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmClearSpouse, setConfirmClearSpouse] = useState(false);
  const [pendingCivil, setPendingCivil] = useState('');
  const [installEvent, setInstallEvent] = useState(null);
  const [syncedCount, setSyncedCount] = useState(0);
  const [reviewStatus, setReviewStatus] = useState('Finalizada');
  const [reviewBairro, setReviewBairro] = useState('');
  const [reviewCollection, setReviewCollection] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [confirmReturn, setConfirmReturn] = useState(false);
  const mainRef = useRef(null);
  const storageKey = useRef('state');
  const activeStatus = active ? collectionStatus(data, active.id) : 'waiting';
  const readOnly = isReadOnly(activeStatus);
  const activeRecord = active ? recordForLot(data, active.id) : null;

  const notify = (message, kind = 'success') => setToast({ message, kind, id: Date.now() });
  useEffect(() => {
    let activeEffect = true;
    async function initialize() {
      try {
        const user = await restoreAuthentication();
        if (!activeEffect || !user) return;
        storageKey.current = `state:${user.id}`;
        const stored = await loadState(storageKey.current);
        let next = stored;
        if (navigator.onLine) {
          const context = await loadRemoteContext(user);
          if (!activeEffect) return;
          setLots(context.lots);
          setRemoteCollections(context.collections);
          const firstBairro = context.lots[0]?.bairro || '';
          setBairro(firstBairro);
          setSelected(context.lots.filter(lot => lot.bairro === firstBairro).map(lot => lot.id));
          next = applyRemoteContext(stored, context);
        } else if (stored.session) {
          const offlineLots = Object.values(stored.prepared);
          const firstBairro = offlineLots[0]?.bairro || '';
          setBairro(firstBairro);
          setSelected(offlineLots.filter(lot => lot.bairro === firstBairro).map(lot => lot.id));
        }
        await saveState(next, storageKey.current);
        if (!activeEffect) return;
        dataRef.current = next;
        setData(next);
      } catch (error) { if (activeEffect) setStorageError(error.message); }
      finally { if (activeEffect) setReady(true); }
    }
    initialize();
    const network = () => setRealOnline(navigator.onLine);
    const install = e => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('online', network); window.addEventListener('offline', network);
    window.addEventListener('beforeinstallprompt', install);
    return () => { activeEffect = false; window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('beforeinstallprompt', install); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [screen, reviewCollection?.id]);

  async function commit(change) {
    const previous = dataRef.current;
    const next = change(previous);
    dataRef.current = next;
    try { await saveState(next, storageKey.current); setData(dataRef.current); return next; }
    catch (error) { if (dataRef.current === next) dataRef.current = previous; throw error; }
  }

  useEffect(() => {
    if (screen !== 'form' || !form || busy || !active || readOnly) return;
    const timer = setTimeout(() => {
      if (lock.current) return;
      commit(s => saveDraft(s, active.id, form))
        .then(() => setDraftTime(new Date().toISOString()))
        .catch(e => notify(e.message, 'error'));
    }, 600);
    return () => clearTimeout(timer);
  }, [form, screen, busy, active, readOnly]);

  const session = data.session;
  const canReview = reviewRoles.includes(session?.permission);
  const sessionRecords = data.records.filter(r => !session || (r.userId === session.userId && r.projectId === session.projectId));
  const pending = sessionRecords.filter(r => canSynchronize(data, r));
  const prepared = Object.values(data.prepared);
  const source = online ? lots : prepared;
  const visible = source.filter(l => (!bairro || l.bairro === bairro) && (!quadra || l.quadra === quadra));
  const chosen = visible.filter(l => selected.includes(l.id));
  const quadras = [...new Set(source.filter(l => !bairro || l.bairro === bairro).map(l => l.quadra))];
  const reviewItems = remoteCollections.filter(item => (!reviewStatus || item.remoteStatus === reviewStatus) && (!reviewBairro || item.lot.bairro === reviewBairro));

  async function navigate(target) {
    if (busy || lock.current) return;
    if (target === 'validation') {
      setReviewCollection(null);
      mainRef.current?.scrollTo(0, 0);
    }
    if (screen === 'form' && form && active && !readOnly) {
      lock.current = true; setBusy('pause');
      try { await commit(s => saveDraft(s, active.id, form, true)); setScreen(target); }
      catch (error) { notify(error.message, 'error'); }
      finally { setBusy(''); lock.current = false; }
      return;
    }
    setScreen(target);
  }
  function changeFilter(nextBairro, nextQuadra) {
    setBairro(nextBairro); setQuadra(nextQuadra);
    setSelected(source.filter(l => (!nextBairro || l.bairro === nextBairro) && (!nextQuadra || l.quadra === nextQuadra)).map(l => l.id));
  }
  function openLot(lot) { setActive(lot); setScreen('detail'); }
  async function openForm(lot = active, reopen = false) {
    if (lock.current || busy) return;
    const current = dataRef.current;
    const viewOnly = isReadOnly(collectionStatus(current, lot.id)) && !reopen;
    if (!current.prepared[lot.id] && !onlineRef.current) return notify('Este lote ainda não está disponível offline. Conecte-se para iniciar a coleta.', 'error');
    lock.current = true; setBusy('open');
    try {
      let stored;
      if (viewOnly) {
        stored = recordForLot(current, lot.id)?.form || validatedForms[lot.id];
        if (!stored) throw new Error('O formulário desta coleta não está disponível neste dispositivo.');
      } else {
        const next = await commit(s => {
          let available = s;
          if (!s.prepared[lot.id]) {
            if (!onlineRef.current) throw new Error('Conecte-se para carregar os dados deste lote.');
            const preparedAt = new Date().toISOString();
            available = {
              ...s, lastPrepared: preparedAt,
              prepared: { ...s.prepared, [lot.id]: { ...lot, userId: s.session.userId, projectId: s.session.projectId, preparedAt } },
            };
          }
          return startCollection(available, lot.id, blankForm(lot), reopen);
        });
        stored = next.drafts[lot.id];
      }
      setActive(lot); setForm(normalizeForm(lot, stored));
      setFormTab('pessoais'); setErrors({}); setDraftTime(null); setScreen('form');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }
  function updateField(key, value) {
    if (readOnly || lock.current) return;
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
  }
  async function pauseCollection() {
    if (lock.current || readOnly) return;
    lock.current = true; setBusy('pause');
    try {
      await commit(s => saveDraft(s, active.id, form, true));
      setScreen('detail'); notify('Coleta pausada. Seu rascunho foi salvo neste dispositivo.');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }
  function changeCivilStatus(next) {
    if (readOnly || lock.current) return;
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
    if (lock.current || readOnly) return;
    const validation = validateCollectionForm(form);
    if (Object.keys(validation.errors).length) {
      setErrors(validation.errors); setFormTab(validation.firstTab); notify('Revise os campos destacados antes de finalizar.', 'error'); return;
    }
    lock.current = true; setBusy('save');
    try {
      await commit(s => finishCollection(s, active.id, form));
      setErrors({});
      setScreen('saved');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }

  async function synchronize() {
    if (lock.current || !onlineRef.current || storageError) return;
    const queue = dataRef.current.records.filter(r => r.userId === session.userId && r.projectId === session.projectId && canSynchronize(dataRef.current, r));
    if (!queue.length) return;
    lock.current = true; setBusy('sync'); setProgress(0);
    let success = 0;
    try {
      for (const [index, record] of queue.entries()) {
        if (!onlineRef.current) break;
        await commit(s => ({ ...s, records: s.records.map(r => r.id === record.id ? { ...r, status: 'sending', attempts: r.attempts + 1, error: '' } : r) }));
        let error = '';
        try {
          await synchronizeCollection(record, lots.find(lot => lot.id === record.lotId) || dataRef.current.prepared[record.lotId]);
        } catch (syncError) { error = syncError.message; }
        await commit(s => ({ ...s, records: s.records.map(r => r.id === record.id ? { ...r, status: error ? 'error' : 'synced', error, sentAt: error ? null : new Date().toISOString() } : r) }));
        if (!error) success += 1;
        setProgress(Math.round((index + 1) / queue.length * 100));
      }
      const remaining = dataRef.current.records.filter(r => r.userId === session.userId && r.projectId === session.projectId && canSynchronize(dataRef.current, r));
      if (onlineRef.current) setRemoteCollections(await loadRemoteCollections(session.projectId));
      if (!remaining.length) { setSyncedCount(success); setScreen('synced'); }
      else notify(`${success} enviado(s). ${remaining.length} registro(s) preservado(s) para nova tentativa.`, 'error');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }

  async function reviewCurrent(action) {
    if (!reviewCollection || !canReview || lock.current || !onlineRef.current) return;
    if (action === 'return' && (returnReason.trim().length < 5 || returnReason.trim().length > 500)) return notify('Informe um motivo entre 5 e 500 caracteres.', 'error');
    lock.current = true; setBusy('review');
    try {
      if (action === 'validate') await validateRemoteCollection(reviewCollection.id);
      else await returnRemoteCollection(reviewCollection.id, returnReason);
      const refreshed = await loadRemoteCollections(session.projectId);
      setRemoteCollections(refreshed);
      setReviewCollection(refreshed.find(item => item.id === reviewCollection.id) || null);
      setConfirmReturn(false); setReturnReason('');
      notify(action === 'validate' ? 'Coleta validada com sucesso.' : reviewCollection.remoteStatus === 'Validada' ? 'Coleta reaberta para correção.' : 'Coleta devolvida ao coletor para correção.');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); lock.current = false; }
  }

  async function attachDocument(event) {
    if (readOnly || busy) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if ((!file.type.startsWith('image/') && file.type !== 'application/pdf') || file.size > 5 * 1024 * 1024) { notify('Escolha uma imagem ou PDF com até 5 MB.', 'error'); event.target.value = ''; return; }
    setBusy('document');
    const reader = new FileReader();
    reader.onload = () => { updateField('pendingDocument', { name: file.name, type: file.type, data: reader.result }); setBusy(''); };
    reader.onerror = () => { notify('Não foi possível ler o documento.', 'error'); setBusy(''); };
    reader.readAsDataURL(file);
  }

  async function clearPrepared() {
    if (pending.length || Object.keys(data.drafts).length) return notify('Conclua os rascunhos e sincronize as pendências antes de remover os lotes.', 'error');
    try { await commit(s => ({ ...s, prepared: {}, lastPrepared: null })); notify('Lotes preparados removidos deste dispositivo.'); }
    catch (e) { notify(e.message, 'error'); }
  }
  async function resetDemo() {
    const firstBairro = lots[0]?.bairro || '';
    try { await commit(() => ({ ...initialState(), session })); setConfirmReset(false); setSimOffline(false); changeFilter(firstBairro, ''); setScreen('lots'); notify('Dados locais reiniciados.'); }
    catch (e) { notify(e.message, 'error'); }
  }

  async function signIn() {
    if (!realOnline || lock.current) return;
    if (!credentials.email.trim() || !credentials.password) return setAuthError('Informe o e-mail e a senha.');
    lock.current = true; setBusy('signin');
    try {
      const context = await authenticate(credentials.email.trim(), credentials.password);
      storageKey.current = `state:${context.session.userId}`;
      const stored = await loadState(storageKey.current);
      const next = applyRemoteContext(stored, context);
      await saveState(next, storageKey.current);
      dataRef.current = next;
      setData(next);
      setLots(context.lots);
      setRemoteCollections(context.collections);
      const firstBairro = context.lots[0]?.bairro || '';
      setBairro(firstBairro);
      setQuadra('');
      setSelected(context.lots.filter(lot => lot.bairro === firstBairro).map(lot => lot.id));
      setAuthError(''); setScreen('lots');
    }
    catch (e) { setAuthError(e.message); }
    finally { setBusy(''); lock.current = false; }
  }

  async function signOut() {
    try { await endAuthentication(); await commit(s => ({ ...s, session: null })); setLots([]); setRemoteCollections([]); setReviewCollection(null); setBairro(''); setQuadra(''); setSelected([]); setCredentials({ email: '', password: '' }); setAuthError(''); setConfirmLogout(false); setScreen('lots'); }
    catch (e) { notify(e.message, 'error'); }
  }

  if (!ready) return <div className="auth-page"><LoaderCircle className="spin" /><p>Preparando seu dispositivo...</p></div>;
  if (storageError) return <div className="auth-page"><section className="auth-card"><Banner type="error" title="Aplicação indisponível">{storageError}</Banner></section></div>;
  if (!session) return <div className="auth-page"><form className="auth-card" onSubmit={e => { e.preventDefault(); signIn(); }}><div className="auth-brand">GEOCOLETA</div><h1>Acessar GeoColeta</h1><p>O primeiro acesso exige conexão. Depois de baixar os lotes, a sessão e as coletas continuam disponíveis offline.</p><div className="auth-fields"><label className="field"><span>E-MAIL</span><input type="email" autoComplete="username" value={credentials.email} onChange={e => { setCredentials(c => ({ ...c, email: e.target.value })); setAuthError(''); }} placeholder="Digite o e-mail" /></label><label className="field"><span>SENHA</span><input type="password" autoComplete="current-password" value={credentials.password} onChange={e => { setCredentials(c => ({ ...c, password: e.target.value })); setAuthError(''); }} placeholder="Digite a senha" /></label>{authError && <p className="field-error" role="alert">{authError}</p>}<small>Teste: <strong>teste@geocoleta.com.br</strong> / <strong>teste123</strong></small></div><Button type="submit" disabled={!realOnline || !!busy}>{busy === 'signin' ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={17} />}{busy === 'signin' ? 'Entrando…' : 'Entrar'}</Button></form></div>;

  return <div className="demo-layout" style={{ maxWidth: 528, gridTemplateColumns: 'minmax(0, 440px)', gap: 0, justifyContent: 'center' }}>
    <div className="app-shell">
      <header className="app-header"><div><div className="wordmark">GEOCOLETA</div><p>{pageSubtitles[screen]}</p></div><button className={`connection-toggle ${online ? '' : 'offline'}`} onClick={() => setSimOffline(v => !v)} aria-label={simOffline ? 'Voltar ao modo online' : 'Ativar modo offline'} title="Alternar conectividade">{online ? <Wifi size={20} /> : <WifiOff size={20} />}</button></header>
      <div className={`connection-bar ${online ? 'online' : 'offline'}`} role="status"><img src={`/assets/figma-${online ? (['detail','form','saved'].includes(screen) ? 0 : screenDots[screen]) : (['detail','form','saved'].includes(screen) ? screenDots[screen] : 4)}.svg`} width="9" height="9" alt="" />{online ? 'Online — conexão disponível' : 'Offline — registros salvos neste dispositivo'}</div>

      <main ref={mainRef} className={`app-content screen-${screen}`}>
        {!ready ? <div className="loading-screen"><LoaderCircle className="spin" /><p>Preparando seu dispositivo...</p></div> : storageError ? <Banner type="error" title="Armazenamento indisponível">{storageError} Tente abrir em uma janela normal do navegador.</Banner> : <>
          {screen === 'lots' && <>
            <Heading title="Lotes disponíveis">Filtre os lotes e prepare os dados antes de sair para campo.</Heading>
            <div className="filters">
              <label className="field"><span>BAIRRO</span><select aria-label="Bairro" value={bairro} onChange={e => changeFilter(e.target.value, '')}><option value="">Todos</option>{[...new Set(source.map(l => l.bairro))].map(b => <option key={b}>{b}</option>)}</select></label>
              <label className="field"><span>QUADRA</span><select aria-label="Quadra" value={quadra} onChange={e => changeFilter(bairro, e.target.value)}><option value="">Todas</option>{quadras.map(q => <option key={q} value={q}>Q-{q}</option>)}</select></label>
            </div>
            <Button secondary onClick={() => { if (!online) return notify('A preparação precisa de internet. Os lotes já preparados continuam disponíveis.', 'error'); if (!chosen.length) return notify('Selecione pelo menos um lote.', 'error'); setScreen('prepare'); }} disabled={!ready || !!busy}><Download size={17} />Baixar dados para uso offline</Button>
            {!online && <Banner title="Você está trabalhando offline" icon={HardDrive}>Somente os lotes preparados neste dispositivo aparecem na lista.</Banner>}
            <div className="results-heading"><span>RESULTADOS <b>{visible.length} lotes</b></span><button onClick={() => setSelected(chosen.length === visible.length ? [] : visible.map(l => l.id))}>{chosen.length === visible.length && visible.length ? 'Desmarcar' : 'Selecionar todos'}</button></div>
            <div className="lots-list">{visible.map(lot => <article className="lot-card" key={lot.id}>
              <div className="lot-top"><CollectionBadge status={collectionStatus(data, lot.id)} /><div>{data.prepared[lot.id] && <span className="badge green">offline</span>}{online && <input type="checkbox" aria-label={'Selecionar lote ' + lot.id} checked={selected.includes(lot.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, lot.id] : prev.filter(id => id !== lot.id))} />}</div></div>
              <button className="lot-open" onClick={() => openLot(lot)}><strong>{lot.address}</strong><span><span>Lote {lot.id} <i>·</i> Quadra {lot.quadra}</span><b>Abrir <ChevronRight size={13} /></b></span></button>
              {data.drafts[lot.id] && <span className="draft-indicator">Rascunho neste dispositivo</span>}
            </article>)}</div>
            {!visible.length && <div className="empty-state"><MapPin size={32} /><h3>{online ? 'Nenhum lote nesta seleção' : 'Esta área ainda não está offline'}</h3><p>{online ? 'Experimente outro bairro ou quadra.' : 'Volte ao modo online e prepare os lotes antes de sair para campo.'}</p></div>}
            <p className="last-update">Última preparação: {formatDate(data.lastPrepared)}</p>
          </>}

          {screen === 'prepare' && <><Heading title="Preparar uso offline" back={() => navigate('lots')}>Escolha quais dados ficarão disponíveis neste dispositivo.</Heading><Banner title={online ? 'Conexão disponível' : 'Conexão indisponível'} type={online ? 'success' : 'error'} icon={online ? Wifi : WifiOff}>{online ? 'Faça o download antes de ir para uma região sem sinal.' : 'Seus filtros foram mantidos. Reconecte para continuar.'}</Banner><section className="data-card"><h3>Dados selecionados</h3><ul className="check-list"><li><Check size={16} />{chosen.length} lotes da área selecionada</li><li><Check size={16} />Endereços e situação atual</li><li><Check size={16} />Formulário REURB e dados do lote</li></ul><div className="area-summary"><span>{bairro || 'Todos os bairros'}</span><span>{quadra ? `Quadra ${quadra}` : 'Todas as quadras'}</span></div><small>Dados do projeto · armazenamento local</small></section>{busy === 'prepare' && <div className="progress" role="progressbar" aria-label="Preparação dos lotes" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>}<Button onClick={prepareLots} disabled={!online || !!busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}{busy ? `Preparando dados… ${progress}%` : 'Baixar dados para uso offline'}</Button><p className="last-update">Última preparação: {formatDate(data.lastPrepared)}</p></>}

          {screen === 'detail' && active && <>
            <Heading title={'Lote ' + active.id} back={() => navigate('lots')}>{active.address}</Heading>
            {data.prepared[active.id] ? <Banner title="Disponível offline" icon={HardDrive}>Você pode coletar com ou sem internet. Os dados deste lote estão neste dispositivo.</Banner> : online ? <Banner title="Coleta disponível online" type="info">Ao iniciar, os dados deste lote serão salvos no dispositivo para continuar mesmo se a conexão cair.</Banner> : <Banner title="Este lote ainda não está disponível offline" type="warning">Conecte-se para iniciar a coleta. Antes de sair para uma área sem sinal, baixe os lotes que pretende visitar.</Banner>}
            <section className="data-card lot-facts"><dl>{[
              ['Bairro', active.bairro], ['Quadra', 'Q-' + active.quadra], ['Inscrição', active.inscription],
              ['Situação da coleta', collectionLabels[activeStatus]], ['Sincronização', activeRecord ? statusLabels[activeRecord.status] : activeStatus === 'validated' ? 'Sem pendência local' : 'Sem registro finalizado'],
            ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
            <div className="location-placeholder"><MapPin size={23} /><div><strong>{active.address}, {active.number}</strong><p>Localização textual disponível. O mapa não faz parte desta versão.</p></div></div>
            {data.drafts[active.id] && <Banner type="warning" title="Você tem um rascunho">Continue de onde parou. Os campos foram mantidos.</Banner>}
            {activeStatus === 'validated' && <Banner title="Coleta validada">Esta coleta já foi validada pela administração e está disponível somente para consulta.</Banner>}
            {activeStatus === 'returned' && <Banner type="error" title="Correção solicitada">{activeRecord?.returnReason || 'Revise os dados informados e finalize a coleta novamente.'}</Banner>}
            <div className="bottom-action"><Button onClick={() => openForm()} disabled={!!busy || (!data.prepared[active.id] && !online)}>
              {readOnly ? 'Ver coleta' : activeStatus === 'returned' ? 'Corrigir coleta' : activeStatus === 'paused' ? 'Retomar coleta' : activeStatus === 'active' ? 'Continuar coleta' : 'Iniciar coleta'}<ArrowRight size={17} />
            </Button></div>
          </>}

          {screen === 'form' && form && active && <>
          {activeRecord?.returnReason && !readOnly && <Banner type="warning" title="Motivo da correção">{activeRecord.returnReason}</Banner>}
          <CollectionForm
            lot={active} form={form} errors={errors} updateField={updateField} formTab={formTab} setFormTab={setFormTab}
            onCivilChange={changeCivilStatus} onSubmit={saveRecord} onPause={pauseCollection}
            onReopen={() => openForm(active, true)} onBack={() => navigate('detail')}
            readOnly={readOnly} collectionLabel={collectionLabels[activeStatus]} validated={activeStatus === 'validated'}
            busy={busy} draftTime={draftTime} attachDocument={attachDocument}
          /></>}

          {screen === 'saved' && <><section className="success-panel"><span className="success-icon"><Check size={34} strokeWidth={2.5} /></span><h1>Registro salvo</h1><p>A coleta foi armazenada no dispositivo e está aguardando sincronização.</p></section><Banner type="warning" title={`${pending.length} ${pending.length === 1 ? 'item pendente' : 'itens pendentes'}`}>Sincronize quando a conexão estiver disponível.</Banner><Button onClick={() => navigate('queue')}>Ver pendências<ArrowRight size={17} /></Button><Button secondary onClick={() => navigate('lots')}>Voltar para lotes</Button></>}

          {screen === 'queue' && <>
            <Heading title="Pendências de sincronização">Somente coletas finalizadas são incluídas no envio.</Heading>
            <Banner title={online ? 'Conexão disponível' : 'Sem conexão no momento'} type={online ? 'success' : 'warning'} icon={online ? Wifi : WifiOff}>{online ? 'Agora é possível enviar os registros pendentes ao banco acadêmico.' : 'Suas coletas estão seguras. Reconecte para sincronizar.'}</Banner>
            {!sessionRecords.length && <div className="empty-state"><CheckCheck size={35} /><h3>Nenhuma pendência por aqui</h3><p>Finalize uma coleta para adicioná-la à fila. Os rascunhos permanecem nos lotes.</p><button className="text-button" onClick={() => navigate('lots')}>Ir para os lotes<ArrowRight size={14} /></button></div>}
            <div className="queue-list">{[...sessionRecords].reverse().map(record => {
              const lot = lots.find(l => l.id === record.lotId);
              const status = collectionStatus(data, record.lotId);
              return <article className="data-card queue-card" key={record.id}>
                <div className="queue-title"><h3>Lote {record.lotId}</h3><span className={'badge ' + record.status}>{record.status === 'sending' && <LoaderCircle size={11} className="spin" />}Sincronização: {statusLabels[record.status]}</span></div>
                <div className="queue-collection"><CollectionBadge status={status} /></div>
                {record.returnReason && !isReadOnly(status) && <Banner type="warning" title="Motivo da correção">{record.returnReason}</Banner>}
                <p>{lot?.address || 'Lote armazenado no dispositivo'}</p>
                <small>{record.status === 'synced' ? 'Sincronizado no banco acadêmico' : 'Salvo'} em {formatDate(record.status === 'synced' ? record.sentAt : record.createdAt)}</small>
                {!isReadOnly(status) && <p className="queue-hint">Coleta em edição. Finalize novamente para incluir as alterações no envio.</p>}
                {record.error && <div className="queue-error"><AlertCircle size={14} /><span>{record.error}</span></div>}
                {lot && <button className="text-button" disabled={!!busy} onClick={() => openForm(lot)}>{isReadOnly(status) ? 'Ver coleta' : 'Retomar coleta'}<ChevronRight size={13} /></button>}
              </article>;
            })}</div>
            <div className="bottom-action">
              {busy === 'sync' && <div className="progress" role="progressbar" aria-label="Sincronização" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: progress + '%' }} /></div>}
              <Button onClick={synchronize} disabled={!online || !pending.length || !!busy}>{busy === 'sync' ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={17} />}{busy === 'sync' ? 'Sincronizando… ' + progress + '%' : 'Sincronizar ' + pending.length + ' ' + (pending.length === 1 ? 'registro' : 'registros')}</Button>
            </div>
          </>}

          {screen === 'synced' && <><section className="success-panel synced"><span className="success-icon"><Check size={34} strokeWidth={2.5} /></span><h1>Tudo sincronizado</h1><p>{syncedCount} {syncedCount === 1 ? 'registro enviado' : 'registros enviados'} com sucesso ao banco acadêmico.</p><span className="badge green">0 pendências</span></section><Banner title="Sincronização confirmada" type="info">Os registros foram persistidos no Supabase e continuam disponíveis neste dispositivo.</Banner><Button onClick={() => navigate('lots')}>Voltar para a lista de lotes</Button><Button secondary onClick={() => navigate('queue')}>Ver registros sincronizados</Button></>}

          {screen === 'validation' && canReview && (reviewCollection ? <CollectionForm
            lot={reviewCollection.lot} form={normalizeForm(reviewCollection.lot, reviewCollection.form)} errors={{}} updateField={() => {}}
            formTab={formTab} setFormTab={setFormTab} onCivilChange={() => {}} onSubmit={event => event.preventDefault()}
            onPause={() => {}} onReopen={() => {}} onBack={() => setReviewCollection(null)} readOnly
            collectionLabel={reviewLabels[reviewCollection.remoteStatus]} validated={reviewCollection.remoteStatus === 'Validada'}
            busy={busy} attachDocument={() => {}} allowReopen={false} backLabel="Voltar para validações"
            readOnlyMessage={reviewCollection.remoteStatus === 'Finalizada' ? 'Confira os dados antes de validar ou devolver ao coletor.' : reviewCollection.remoteStatus === 'Validada' ? 'Esta coleta já foi validada.' : `Devolvida para correção: ${reviewCollection.returnReason}`}
            reviewActions={['Finalizada', 'Validada'].includes(reviewCollection.remoteStatus) && <div className="review-actions">{reviewCollection.remoteStatus === 'Finalizada' && <Button type="button" onClick={() => reviewCurrent('validate')} disabled={!online || !!busy}><CheckCircle2 size={17} />Validar coleta</Button>}<Button type="button" secondary onClick={() => setConfirmReturn(true)} disabled={!online || !!busy}><RotateCcw size={17} />{reviewCollection.remoteStatus === 'Validada' ? 'Reabrir para correção' : 'Devolver para correção'}</Button></div>}
          /> : <>
            <Heading title="Validação das coletas">Analise os registros sincronizados do projeto antes da aprovação.</Heading>
            {!online && <Banner type="warning" title="Painel indisponível offline">Conecte-se para consultar e validar as coletas do servidor.</Banner>}
            <div className="storage-stats review-stats"><div><CloudUpload size={21} /><strong>{remoteCollections.filter(item => item.remoteStatus === 'Finalizada').length}</strong><span>Aguardando</span></div><div><CheckCircle2 size={21} /><strong>{remoteCollections.filter(item => item.remoteStatus === 'Validada').length}</strong><span>Validadas</span></div><div><RotateCcw size={21} /><strong>{remoteCollections.filter(item => item.remoteStatus === 'Devolvida').length}</strong><span>Devolvidas</span></div></div>
            <div className="filters"><label className="field"><span>STATUS</span><select aria-label="Status da coleta" value={reviewStatus} onChange={event => setReviewStatus(event.target.value)}><option value="">Todos</option>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>BAIRRO</span><select aria-label="Bairro da coleta" value={reviewBairro} onChange={event => setReviewBairro(event.target.value)}><option value="">Todos</option>{[...new Set(remoteCollections.map(item => item.lot.bairro))].map(value => <option key={value}>{value}</option>)}</select></label></div>
            {!reviewItems.length && <div className="empty-state"><ClipboardCheck size={35} /><h3>Nenhuma coleta neste filtro</h3><p>As coletas aparecem aqui depois que o coletor finaliza e sincroniza.</p></div>}
            <div className="queue-list">{reviewItems.map(item => <article className="data-card review-card" key={item.id}><div className="queue-title"><h3>Lote {item.lotId}</h3><span className={`badge ${item.remoteStatus === 'Validada' ? 'green' : item.remoteStatus === 'Devolvida' ? 'error' : ''}`}>{reviewLabels[item.remoteStatus]}</span></div><strong>{item.form.nome || 'Responsável não informado'}</strong><p>{item.lot.address}, {item.lot.number} · {item.lot.bairro}</p><small>Sincronizada em {formatDate(item.sentAt)}</small><button className="text-button" onClick={() => { setReviewCollection(item); setFormTab('pessoais'); }}>Abrir coleta<ChevronRight size={13} /></button></article>)}</div>
          </>)}

          {screen === 'device' && <><Heading title="Meu dispositivo">Acompanhe os dados disponíveis neste navegador.</Heading><section className="session-card"><UserRound size={19} /><div><strong>{session.userName || session.email}</strong><span>{session.email}</span><span>{permissionLabels[session.permission] || session.permission} · {session.projectName}</span></div></section><div className="storage-stats"><div><HardDrive size={21} /><strong>{prepared.length}</strong><span>Lotes offline</span></div><div><CloudUpload size={21} /><strong>{pending.length}</strong><span>Pendências</span></div><div><CheckCheck size={21} /><strong>{sessionRecords.filter(r => r.status === 'synced').length}</strong><span>Sincronizados</span></div></div><section className="data-card"><h3>Áreas preparadas</h3>{!prepared.length ? <p>Nenhuma área preparada neste dispositivo.</p> : [...new Set(prepared.map(l => l.bairro))].map(b => <div className="prepared-area" key={b}><MapPin size={17} /><div><strong>{b}</strong><small>{prepared.filter(l => l.bairro === b).length} lotes disponíveis offline</small></div><CheckCircle2 size={17} /></div>)}<small className="last-update">Atualizado: {formatDate(data.lastPrepared)}</small></section>{installEvent && <Button onClick={async () => { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); }}><Download size={17} />Instalar aplicativo</Button>}<Button secondary onClick={clearPrepared} disabled={!!busy || !prepared.length}><Trash2 size={17} />Remover lotes preparados</Button><Banner title="Seus registros permanecem aqui" type="info">As coletas e os rascunhos são mantidos ao fechar ou atualizar a página. Não limpe os dados do navegador durante o teste.</Banner><button className="reset-button" onClick={() => setConfirmReset(true)}><RotateCcw size={15} />Reiniciar dados locais</button><button className="reset-button" onClick={() => pending.length || Object.keys(data.drafts).length ? setConfirmLogout(true) : signOut()}><ArrowLeft size={15} />Sair</button><p className="version">GeoColeta · Ambiente acadêmico<br />Estrutura baseada no protótipo Figma</p></>}
        </>}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">{(canReview ? [['lots', Grid2X2, 'Lotes'], ['validation', ClipboardCheck, 'Validação'], ['device', UserRound, 'Dispositivo']] : [['lots', Grid2X2, 'Lotes'], ['queue', RefreshCw, 'Pendências'], ['device', UserRound, 'Dispositivo']]).map(([key, Icon, label]) => <button key={key} className={(key === 'lots' && !['queue','synced','validation','device'].includes(screen)) || screen === key || (key === 'queue' && screen === 'synced') ? 'active' : ''} onClick={() => navigate(key)} disabled={!!busy}><span className="nav-icon"><Icon size={19} />{key === 'queue' && pending.length > 0 && <b>{pending.length}</b>}{key === 'validation' && remoteCollections.some(item => item.remoteStatus === 'Finalizada') && <b>{remoteCollections.filter(item => item.remoteStatus === 'Finalizada').length}</b>}</span>{label}</button>)}</nav>
    </div>
    {toast && <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.kind === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Fechar mensagem"><X size={17} /></button></div>}
    {confirmReset && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><RotateCcw size={27} /><h2 id="reset-title">Começar de novo?</h2><p>Isso remove somente os dados locais desta conta neste navegador, incluindo rascunhos e pendências.</p><button className="button primary" onClick={resetDemo}>Reiniciar dados locais</button><button autoFocus className="button secondary" onClick={() => setConfirmReset(false)}>Continuar de onde parei</button></div></div>}
    {confirmLogout && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="logout-title"><AlertCircle size={27} /><h2 id="logout-title">Existem dados não sincronizados</h2><p>Ao sair, eles permanecerão protegidos neste dispositivo e voltarão a aparecer no próximo acesso desta conta.</p><button className="button primary" onClick={signOut}>Sair sem apagar os dados</button><button autoFocus className="button secondary" onClick={() => setConfirmLogout(false)}>Continuar conectado</button></div></div>}
    {confirmClearSpouse && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="spouse-title"><AlertCircle size={27} /><h2 id="spouse-title">Remover dados do cônjuge?</h2><p>O novo estado civil não utiliza essa seção. Confirme para apagar os dados já preenchidos.</p><button className="button primary" onClick={confirmCivilChange}>Alterar e remover dados</button><button autoFocus className="button secondary" onClick={() => { setPendingCivil(''); setConfirmClearSpouse(false); }}>Manter estado civil anterior</button></div></div>}
    {confirmReturn && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="return-title"><RotateCcw size={27} /><h2 id="return-title">{reviewCollection?.remoteStatus === 'Validada' ? 'Reabrir coleta validada?' : 'Devolver para correção?'}</h2><p>{reviewCollection?.remoteStatus === 'Validada' ? 'A validação será retirada. Informe o motivo para liberar a correção pelo coletor.' : 'Explique ao coletor o que precisa ser revisado.'} O registro voltará editável no próximo acesso conectado.</p><label className="field"><span>MOTIVO DA CORREÇÃO</span><textarea autoFocus rows="4" maxLength="500" value={returnReason} onChange={event => setReturnReason(event.target.value)} placeholder="Descreva a correção necessária" /></label><button className="button primary" onClick={() => reviewCurrent('return')} disabled={!online || !!busy || returnReason.trim().length < 5}>{reviewCollection?.remoteStatus === 'Validada' ? 'Confirmar reabertura' : 'Confirmar devolução'}</button><button className="button secondary" onClick={() => { setConfirmReturn(false); setReturnReason(''); }} disabled={!!busy}>Cancelar</button></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Cache offline indisponível:', error.message));
