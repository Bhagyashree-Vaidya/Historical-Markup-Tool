/* Historical Markup Tool — React app
   Screens: Transcribe (home) · Library · Editor · Search
   Real API: /api/ocr  /api/analyze  /api/tei
*/
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Constants ──────────────────────────────────────────────────────────────
const TEI_TO_ETYPE = {
  persName:'person', placeName:'place', orgName:'org',
  date:'date', time:'date', title:'org', name:'org',
};
const ETYPE_LABEL = { person:'Person', place:'Place', date:'Date', org:'Organisation' };
const TAG_OPTIONS = [
  ['persName','persName — Person'],['placeName','placeName — Place'],
  ['orgName','orgName — Organisation'],['date','date'],
  ['time','time'],['title','title — Work'],['name','name — Other'],
];
const DOC_TYPES = ['Diary','Letter','Notebook','Other'];

// ── Active models (Claude + spaCy) ─────────────────────────────────────────
const ACTIVE_MODELS = [
  { id:'claude-sonnet', name:'Claude claude-sonnet-4-5', base:'Anthropic API', status:'active', note:'State-of-the-art vision model for historical handwriting transcription.' },
  { id:'spacy-ner',     name:'spaCy en_core_web_sm',    base:'NER pipeline',  status:'active', note:'Named entity recognition for people, places, dates, organisations.' },
];

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = {
  search:   p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>,
  upload:   p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  library:  p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h4v16H4z"/><path d="M10 4h4v16h-4z"/><path d="M16 4.5l3.5 1-3 14.5-3.5-1z"/></svg>,
  grid:     p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list:     p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  download: p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  image:    p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>,
  zoomIn:   p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  zoomOut:  p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  close:    p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:    p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>,
  sparkle:  p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
  plus:     p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  book:     p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  arrow:    p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  file:     p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  save:     p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  trash:    p=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
};

function cx(...xs) { return xs.filter(Boolean).join(' '); }

// ── Persist library to localStorage ────────────────────────────────────────
function loadLibrary() {
  try {
    const raw = localStorage.getItem('hmt_library');
    if (!raw) return [];
    // Strip imageSrc blob URLs (they don't survive page reload)
    return JSON.parse(raw).map(d => ({ ...d, imageSrc: null, thumb: null }));
  } catch { return []; }
}
function saveLibrary(docs) {
  try {
    // Don't persist blob URLs
    const clean = docs.map(d => ({ ...d, imageSrc: null, thumb: null }));
    localStorage.setItem('hmt_library', JSON.stringify(clean));
  } catch {}
}

// ── Atoms ──────────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const map = {
    'verified':     { cls:'chip-ok',   label:'Verified' },
    'in-review':    { cls:'chip-blue', label:'In review' },
    'transcribing': { cls:'chip',      label:'Transcribing…' },
    'needs-review': { cls:'chip-warn', label:'Needs review' },
  };
  const it = map[status] || { cls:'chip', label:status };
  return <span className={`chip ${it.cls}`}>{it.label}</span>;
}

function ConfMeter({ value }) {
  const pct = Math.round((value||0)*100);
  const cls = value >= 0.9 ? 'good' : value >= 0.8 ? '' : 'warn';
  return (
    <div style={{width:64}}>
      <div className={`meter ${cls}`}><div className="bar" style={{width:`${pct}%`}}/></div>
      <div className="sans small muted" style={{textAlign:'right',marginTop:2}}>{pct}%</div>
    </div>
  );
}

// ── Hash router ────────────────────────────────────────────────────────────
function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const h = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return [route, r => { window.location.hash = r; }];
}
function parseHash(h) {
  // Default home is /upload (Transcribe)
  const s = (h||'#/upload').replace(/^#/,'');
  const parts = s.split('/');
  return { screen: parts[1]||'upload', id: parts[2]||null };
}

// ── Save to Library modal ──────────────────────────────────────────────────
function SaveModal({ doc, onSave, onClose }) {
  const [type, setType]   = useState('Diary');
  const [title, setTitle] = useState(doc.title || '');
  const [author, setAuthor] = useState(doc.author || 'Emma B. Andrews');
  const [collection, setCollection] = useState(doc.collection || '');

  function handleSave() {
    onSave({ ...doc, type: type.toLowerCase(), title, author, collection, status: 'in-review' });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h3>Save to Library</h3>
          <button className="btn-icon" onClick={onClose}><Icon.close/></button>
        </div>
        <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label className="label">Document type</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
              {DOC_TYPES.map(t=>(
                <button key={t}
                  onClick={()=>setType(t)}
                  style={{padding:'6px 16px',borderRadius:20,border:'1px solid var(--rule)',background:type===t?'var(--brown-700)':'var(--bg-paper)',color:type===t?'#fff':'var(--ink)',fontFamily:'var(--sans)',fontSize:13,cursor:'pointer',fontWeight:type===t?600:400}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Diary, 15 January 1895"/>
          </div>
          <div>
            <label className="label">Author / Hand</label>
            <input className="input" value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Emma B. Andrews"/>
          </div>
          <div>
            <label className="label">Collection / Volume</label>
            <input className="input" value={collection} onChange={e=>setCollection(e.target.value)} placeholder="Andrews Diary, Vol. IV"/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}><Icon.save/>Save to Library</button>
        </div>
      </div>
    </div>
  );
}

// ── Library screen ─────────────────────────────────────────────────────────
function Library({ docs, onOpen, onGoUpload, onDelete }) {
  const [view, setView]     = useState('grid');
  const [q, setQ]           = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = docs.filter(d => {
    const matchQ = !q || d.title.toLowerCase().includes(q.toLowerCase()) || (d.author||'').toLowerCase().includes(q.toLowerCase());
    const matchF = filter==='all' || d.type===filter.toLowerCase() || d.status===filter;
    return matchQ && matchF;
  });

  if (docs.length === 0) {
    return (
      <div className="page">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <h1 className="page-title" style={{margin:0}}>Library</h1>
          <button className="btn btn-sm" onClick={onGoUpload}><Icon.upload/>Transcribe new</button>
        </div>
        <div style={{textAlign:'center',padding:'80px 24px',color:'var(--ink-mute)'}}>
          <Icon.library style={{width:48,height:48,marginBottom:16,opacity:0.4}}/>
          <div style={{fontFamily:'var(--serif-display)',fontSize:20,marginBottom:8,color:'var(--brown-800)'}}>Your library is empty</div>
          <div style={{fontFamily:'var(--serif)',fontSize:15,marginBottom:24}}>Transcribe a document and save it here to build your collection.</div>
          <button className="btn" onClick={onGoUpload}><Icon.upload/>Transcribe your first document</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="lib-toolbar">
        <div className="search">
          <Icon.search/>
          <input placeholder="Search documents…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        {['all','diary','letter','notebook'].map(f=>(
          <button key={f} className={cx('filter-chip', filter===f&&'active')} onClick={()=>setFilter(f)}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <div className="view-toggle">
          <button className={cx(view==='grid'&&'active')} onClick={()=>setView('grid')}><Icon.grid/>Grid</button>
          <button className={cx(view==='list'&&'active')} onClick={()=>setView('list')}><Icon.list/>List</button>
        </div>
        <button className="btn btn-sm" onClick={onGoUpload}><Icon.upload/>Transcribe new</button>
      </div>

      {filtered.length === 0 && (
        <div className="muted italic" style={{padding:'40px 0',textAlign:'center'}}>No documents match your filter.</div>
      )}

      {view==='grid' ? (
        <div className="doc-grid">
          {filtered.map(d=>(
            <div key={d.id} className="doc-card" onClick={()=>onOpen(d.id)}>
              <div className="doc-thumb">
                {d.thumb
                  ? <img src={d.thumb} alt={d.title}/>
                  : <div style={{background:'var(--rule-soft)',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <Icon.file style={{width:32,height:32,color:'var(--brown-600)'}}/>
                    </div>}
                <span className="stamp">{d.type||'doc'}</span>
              </div>
              <div className="doc-body">
                <div className="doc-title">{d.title}</div>
                <div className="doc-meta"><span>{d.author}</span><span>·</span><span>{d.date}</span></div>
                <div className="doc-tags">
                  <StatusChip status={d.status}/>
                  {d.confidence && <ConfMeter value={d.confidence}/>}
                </div>
              </div>
              <button
                style={{position:'absolute',top:8,right:8,background:'rgba(255,255,255,0.85)',border:'none',borderRadius:4,padding:4,cursor:'pointer',opacity:0,transition:'opacity 0.15s'}}
                className="card-delete-btn"
                onClick={e=>{e.stopPropagation();onDelete(d.id);}}
                title="Remove from library">
                <Icon.trash style={{width:14,height:14,color:'var(--ink-mute)'}}/>
              </button>
            </div>
          ))}
          <div className="doc-card" style={{border:'2px dashed var(--rule)',cursor:'pointer',alignItems:'center',justifyContent:'center',minHeight:220,background:'transparent'}} onClick={onGoUpload}>
            <div style={{textAlign:'center',padding:24,color:'var(--ink-mute)'}}>
              <Icon.plus style={{width:28,height:28,marginBottom:8}}/>
              <div style={{fontFamily:'var(--serif-display)',fontSize:15}}>Transcribe new document</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="doc-list">
          <table>
            <thead><tr><th>Title</th><th>Author</th><th>Date</th><th>Type</th><th>Status</th><th>Confidence</th><th></th></tr></thead>
            <tbody>
              {filtered.map(d=>(
                <tr key={d.id} onClick={()=>onOpen(d.id)}>
                  <td className="title">{d.title}</td>
                  <td>{d.author}</td>
                  <td className="mono small">{d.date}</td>
                  <td className="small muted">{d.type||'—'}</td>
                  <td><StatusChip status={d.status}/></td>
                  <td>{d.confidence&&<ConfMeter value={d.confidence}/>}</td>
                  <td><button style={{background:'none',border:'none',cursor:'pointer',padding:4}} onClick={e=>{e.stopPropagation();onDelete(d.id);}} title="Remove"><Icon.trash style={{width:14,height:14,color:'var(--ink-mute)'}}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Upload / Transcribe screen ──────────────────────────────────────────────
function Upload({ onComplete, onGoLibrary }) {
  const [step, setStep]         = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [mode, setMode]         = useState('upload');
  const [filename, setFilename] = useState('');
  const [drag, setDrag]         = useState(false);
  const [meta, setMeta]         = useState({ title:'', author:'', source:'' });
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);
  const [saveModal, setSaveModal] = useState(false);
  const fileRef  = useRef(null);
  const pasteRef = useRef(null);

  const stepLabels = ['Source', 'AI transcription', 'Review'];

  async function transcribe(file) {
    setStep(1); setProgress(5); setError('');
    setStatusMsg('Sending to Claude claude-sonnet-4-5…');

    const fd = new FormData();
    fd.append('file', file);
    let text;
    try {
      setProgress(20);
      const r = await fetch('/api/ocr', { method:'POST', body:fd });
      const d = await r.json();
      if (d.error) { setError('OCR error: '+d.error); setStep(0); return; }
      text = d.text;
      setProgress(55); setStatusMsg('Recognising entities…');
    } catch(e) { setError('Network error: '+e.message); setStep(0); return; }

    const fd2 = new FormData();
    fd2.append('text', text);
    let entities = [];
    try {
      const r2 = await fetch('/api/analyze', { method:'POST', body:fd2 });
      const d2 = await r2.json();
      entities = d2.entities || [];
      setProgress(90); setStatusMsg('Finalising…');
    } catch(_) {}

    const imageUrl = URL.createObjectURL(file);
    const doc = buildDoc(text, entities, imageUrl, file.name, meta);
    setProgress(100);
    setTimeout(() => { setResult({ doc }); setStep(2); }, 300);
  }

  async function analyseText(text) {
    setStep(1); setProgress(30); setError('');
    setStatusMsg('Recognising entities…');
    const fd = new FormData(); fd.append('text', text);
    let entities = [];
    try {
      const r = await fetch('/api/analyze', { method:'POST', body:fd });
      const d = await r.json();
      entities = d.entities || [];
    } catch(_) {}
    setProgress(100);
    const doc = buildDoc(text, entities, null, 'pasted-text', meta);
    setTimeout(() => { setResult({ doc }); setStep(2); }, 300);
  }

  function buildDoc(text, entities, imageUrl, fname, m) {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return {
      id: 'doc-'+Date.now(),
      title:      m.title || fname.replace(/\.[^.]+$/,'').replace(/[-_]/g,' '),
      author:     m.author || '',
      source:     m.source || '',
      collection: m.source || '',
      date:       new Date().toISOString().slice(0,10),
      type:       'diary',
      pages:      1,
      words:      wordCount,
      status:     'in-review',
      confidence: entities.length > 0 ? 0.91 : 0.85,
      imageSrc:   imageUrl,
      thumb:      imageUrl,
      text,
      entities,
      model: 'Claude claude-sonnet-4-5',
      language: 'English',
    };
  }

  function reset() {
    setStep(0); setProgress(0); setStatusMsg('');
    setFilename(''); setError(''); setResult(null); setSaveModal(false);
    setMeta({ title:'', author:'', source:'' });
  }

  function handleFileDrop(e) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFilename(f.name); transcribe(f); }
  }
  function handleFileSelect(e) {
    const f = e.target.files?.[0];
    if (f) { setFilename(f.name); transcribe(f); }
  }
  function handlePasteSubmit() {
    const t = pasteRef.current?.value.trim();
    if (!t) return;
    setFilename('pasted-text');
    analyseText(t);
  }

  return (
    <div className="page">
      <h1 className="page-title">Transcribe a document</h1>
      <p className="page-sub">Upload a scanned page or paste a transcription. Claude claude-sonnet-4-5 reads the handwriting; spaCy marks up the entities.</p>

      <div className="stepper">
        {stepLabels.map((s,i)=>(
          <div key={s} className={cx('step', step===i&&'active', step>i&&'done')}>
            <span className="num">{step>i?'✓':i+1}</span><span>{s}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{padding:'10px 16px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:4,color:'#991b1b',fontFamily:'var(--sans)',fontSize:13,marginBottom:16}}>
          {error}
        </div>
      )}

      {step===0 && (
        <div className="upload-shell">
          <div>
            <div style={{display:'flex',gap:2,marginBottom:14,borderBottom:'1px solid var(--rule)'}}>
              {[['upload','Upload Image'],['paste','Paste / Type']].map(([k,l])=>(
                <button key={k} onClick={()=>setMode(k)} style={{padding:'10px 18px',background:'none',border:'none',borderBottom:mode===k?'2px solid var(--brown-700)':'2px solid transparent',marginBottom:-1,color:mode===k?'var(--brown-900)':'var(--ink-soft)',fontFamily:'var(--sans)',fontSize:13,fontWeight:500,cursor:'pointer'}}>{l}</button>
              ))}
            </div>

            {mode==='upload' && (
              <>
                <div className={cx('dropzone', drag&&'drag')}
                  onDragOver={e=>{e.preventDefault();setDrag(true);}}
                  onDragLeave={()=>setDrag(false)}
                  onDrop={handleFileDrop}
                  onClick={()=>fileRef.current?.click()}>
                  <Icon.image style={{width:40,height:40,color:'var(--brown-600)'}}/>
                  <h3>Drop a scan here, or browse</h3>
                  <p className="muted">JPG, PNG, TIF — Claude claude-sonnet-4-5 will read the handwriting</p>
                  <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.tif,.tiff,image/*" hidden onChange={handleFileSelect}/>
                </div>
                {filename && <div className="sans small muted" style={{marginTop:6}}>{filename}</div>}
              </>
            )}

            {mode==='paste' && (
              <>
                <textarea className="textarea" ref={pasteRef} rows={10} placeholder="Paste or type transcribed text here…" style={{marginBottom:10}}/>
                <button className="btn btn-sm" onClick={handlePasteSubmit}><Icon.sparkle/>Analyse entities</button>
              </>
            )}

            <div className="sp-16"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label className="label">Title</label><input className="input" placeholder="Diary, 15 January 1895" value={meta.title} onChange={e=>setMeta({...meta,title:e.target.value})}/></div>
              <div><label className="label">Author / Hand</label><input className="input" placeholder="Emma B. Andrews" value={meta.author} onChange={e=>setMeta({...meta,author:e.target.value})}/></div>
              <div style={{gridColumn:'1 / -1'}}><label className="label">Collection / Volume</label><input className="input" placeholder="Andrews Diary, Vol. IV" value={meta.source} onChange={e=>setMeta({...meta,source:e.target.value})}/></div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="card card-pad">
            <div className="side-h" style={{fontFamily:'var(--sans)',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-mute)',marginBottom:10}}><b>Active model</b></div>
            {ACTIVE_MODELS.filter(m=>m.status==='active').map(m=>(
              <div key={m.id} style={{padding:'10px 12px',border:'1px solid var(--brown-600)',borderRadius:4,marginBottom:8,background:'var(--bg-paper)'}}>
                <div style={{fontFamily:'var(--serif-display)',fontWeight:500,fontSize:14,color:'var(--brown-900)'}}>{m.name}</div>
                <div className="sans small muted" style={{marginTop:3}}>{m.note}</div>
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--rule)',margin:'10px -4px 8px'}}/>
            <div className="sans small muted" style={{fontFamily:'var(--sans)',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}><b>Preprocessing</b></div>
            <label style={{display:'flex',gap:8,alignItems:'center',fontSize:13}}><input type="checkbox" defaultChecked/>Entity recognition</label>
          </aside>
        </div>
      )}

      {step===1 && (
        <div className="card card-pad" style={{maxWidth:720,margin:'0 auto',textAlign:'center',padding:'40px 24px'}}>
          <div style={{fontFamily:'var(--sans)',fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-mute)'}}>Claude claude-sonnet-4-5 · Anthropic</div>
          <h3 style={{fontFamily:'var(--serif-display)',fontSize:22,margin:'6px 0 4px',color:'var(--brown-900)'}}>Reading the hand…</h3>
          <p className="muted italic" style={{margin:'0 0 20px'}}>{filename}</p>
          <div className="progress" style={{maxWidth:420,margin:'0 auto'}}><div className="b" style={{width:`${progress}%`}}/></div>
          <div className="sans small muted" style={{marginTop:10}}>{statusMsg} · {progress}%</div>
        </div>
      )}

      {step===2 && result && (
        <div className="card card-pad" style={{maxWidth:720,margin:'0 auto',textAlign:'center',padding:'40px 24px'}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:'#e3efdb',color:'#4c6a3a',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
            <Icon.check style={{width:24,height:24}}/>
          </div>
          <h3 style={{fontFamily:'var(--serif-display)',fontSize:22,margin:'0 0 4px',color:'var(--brown-900)'}}>Transcription complete</h3>
          <p className="muted" style={{margin:'0 0 24px'}}>
            {result.doc.words} words · {result.doc.entities.length} entities found
          </p>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <button className="btn btn-ghost btn" onClick={reset}><Icon.upload/>Transcribe another</button>
            <button className="btn btn-ghost btn" onClick={()=>setSaveModal(true)}><Icon.save/>Save to Library</button>
            <button className="btn" onClick={()=>onComplete(result.doc)}>Open in Editor <Icon.arrow/></button>
          </div>
        </div>
      )}

      {saveModal && result && (
        <SaveModal
          doc={result.doc}
          onSave={doc => { onComplete(doc, true); setSaveModal(false); }}
          onClose={()=>setSaveModal(false)}
        />
      )}
    </div>
  );
}

// ── Editor screen ───────────────────────────────────────────────────────────
function Editor({ doc, onBack, onSaveToLibrary }) {
  const [activeLine, setActiveLine]   = useState(null);
  const [zoom, setZoom]               = useState(1);
  const [activeEntId, setActiveEntId] = useState(null);
  const [exportOpen, setExportOpen]   = useState(false);
  const [entities, setEntities]       = useState(doc.entities||[]);
  const [editModal, setEditModal]     = useState(null);
  const [addModal, setAddModal]       = useState(null);
  const [saveModal, setSaveModal]     = useState(false);
  const trRef = useRef(null);

  const entityGroups = useMemo(() => {
    const groups = { person:[], place:[], date:[], org:[] };
    const seen = {};
    for (const ent of entities) {
      const etype = TEI_TO_ETYPE[ent.tei_tag]||'org';
      const key = ent.text.toLowerCase();
      if (!seen[key]) {
        seen[key]=true;
        const count = entities.filter(e=>e.text.toLowerCase()===key).length;
        if (!groups[etype]) groups[etype]=[];
        groups[etype].push({ id:key, display:ent.text, count, tei_tag:ent.tei_tag, ref:ent.ref });
      }
    }
    return groups;
  }, [entities]);

  const lines = useMemo(() => {
    let pos = 0;
    return (doc.text||'').split('\n').filter(Boolean).map((t,i) => {
      const start = pos;
      pos += t.length + 1;
      return { text:t, index:i, start };
    });
  }, [doc.text]);

  function renderLineWithEntities(lineText, lineStart) {
    const lineEnts = entities
      .filter(e => e.start >= lineStart && e.end <= lineStart + lineText.length)
      .map(e => ({...e, localStart: e.start-lineStart, localEnd: e.end-lineStart}))
      .sort((a,b)=>a.localStart-b.localStart);
    const parts = []; let cur = 0;
    for (const ent of lineEnts) {
      if (ent.localStart > cur) parts.push({ type:'text', v:lineText.slice(cur, ent.localStart) });
      const etype = TEI_TO_ETYPE[ent.tei_tag]||'org';
      const isActive = activeEntId === ent.text.toLowerCase();
      parts.push({ type:'ent', ent, etype, v:lineText.slice(ent.localStart, ent.localEnd), active:isActive });
      cur = ent.localEnd;
    }
    if (cur < lineText.length) parts.push({ type:'text', v:lineText.slice(cur) });
    return parts;
  }

  function removeEntity(idx) { setEntities(prev => prev.filter((_,i)=>i!==idx)); }
  function saveEdit({ tei_tag, ref }) {
    setEntities(prev => prev.map((e,i) => i===editModal.idx ? {...e, tei_tag, ref} : e));
    setEditModal(null);
  }
  function handleAddFromSelection() {
    const sel = window.getSelection();
    const selText = sel?.toString().trim();
    if (!selText) { alert('Select text in the transcript first.'); return; }
    const start = doc.text.indexOf(selText);
    if (start===-1) { alert('Could not locate selected text in document.'); return; }
    setAddModal({ text:selText, start, end:start+selText.length });
  }
  function saveAdd({ tei_tag, ref }) {
    const ent = { text:addModal.text, start:addModal.start, end:addModal.end,
      label:ETYPE_LABEL[TEI_TO_ETYPE[tei_tag]]||tei_tag, tei_tag, ref:ref||undefined };
    setEntities(prev => [...prev, ent].sort((a,b)=>a.start-b.start));
    setAddModal(null);
  }

  return (
    <div className="page page-wide">
      <div className="ed-toolbar">
        <button className="btn-icon" onClick={onBack} title="Back to library"><Icon.arrow style={{transform:'rotate(180deg)'}}/></button>
        <div className="title">{doc.title}</div>
        <span className="chip chip-blue">{doc.model||'Claude claude-sonnet-4-5'}</span>
        {doc.author && <span className="muted">· {doc.author}</span>}
        <span className="sep"/>
        <div className="zoom">
          <button onClick={()=>setZoom(z=>Math.max(0.4,z-0.1))}><Icon.zoomOut style={{width:13,height:13}}/></button>
          <span className="z">{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.1))}><Icon.zoomIn style={{width:13,height:13}}/></button>
        </div>
        <div className="spacer"/>
        <button className="btn-ghost btn btn-sm" onClick={handleAddFromSelection}><Icon.plus/>Add entity</button>
        <button className="btn-ghost btn btn-sm" onClick={()=>setSaveModal(true)}><Icon.save/>Save to Library</button>
        <button className="btn btn-sm" onClick={()=>setExportOpen(true)}><Icon.download/>Export TEI</button>
      </div>

      <div className="editor">
        {/* Image pane */}
        <div className="ed-pane">
          <div className="ed-head"><span className="t">Source image</span><span className="muted small">{doc.source||'Uploaded document'}</span></div>
          <div className="ed-body">
            <div className="image-stage">
              {doc.imageSrc ? (
                <div className="image-wrap" style={{transform:`scale(${zoom})`,transformOrigin:'top center',maxWidth:'90%'}}>
                  <img src={doc.imageSrc} alt={doc.title} style={{maxWidth:'100%'}}/>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--ink-mute)',gap:12,padding:40}}>
                  <Icon.file style={{width:48,height:48}}/>
                  <div style={{fontFamily:'var(--serif-display)',fontSize:16}}>No image available</div>
                  <div className="sans small muted">Text was pasted or image not retained after save</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transcript pane */}
        <div className="ed-pane">
          <div className="ed-head">
            <span className="t">Transcript</span>
            <span className="legend">
              {[['person','var(--person)'],['place','var(--place)'],['date','var(--date)'],['org','var(--org)']].map(([k,c])=>(
                <span key={k} className="it"><span className="sw" style={{background:c}}/>{ETYPE_LABEL[k]}</span>
              ))}
            </span>
          </div>
          <div className="ed-body" ref={trRef}>
            <div className="transcript">
              {lines.map((l,i)=>(
                <div key={i} data-ln={i}
                  className={cx('tr-line', activeLine===i&&'active')}
                  onClick={()=>setActiveLine(i)}>
                  <span className="ln">{i+1}</span>
                  <span className="tx">
                    {renderLineWithEntities(l.text, l.start).map((part,j)=>{
                      if (part.type==='text') return <span key={j}>{part.v}</span>;
                      const idx = entities.findIndex(e=>e.start===part.ent.start&&e.end===part.ent.end);
                      return (
                        <span key={j}
                          className={cx('ent', part.etype, part.active&&'active')}
                          style={part.active?{background:'rgba(245,217,138,0.5)'}:undefined}
                          onClick={e=>{e.stopPropagation();setActiveEntId(part.v.toLowerCase());setEditModal({ent:part.ent,idx});}}
                          title={`${ETYPE_LABEL[part.etype]||part.etype} — click to edit`}>
                          {part.v}
                          <span style={{fontSize:'0.6em',verticalAlign:'super',marginLeft:1,opacity:0.5,cursor:'pointer'}}
                            onClick={e=>{e.stopPropagation();removeEntity(idx);}}>×</span>
                        </span>
                      );
                    })}
                  </span>
                </div>
              ))}
              <div style={{marginTop:24,padding:'10px 16px',borderTop:'1px dashed var(--rule)',fontFamily:'var(--sans)',fontSize:11,color:'var(--ink-mute)',fontStyle:'italic'}}>
                {lines.length} lines · {doc.words} words · Select text + "Add entity" to mark up new spans
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="ed-pane ed-side" style={{borderRight:'none'}}>
          <div className="side-section">
            <div className="side-h"><b>Document</b></div>
            {doc.author && <div className="metric"><span>Author</span><b>{doc.author}</b></div>}
            <div className="metric"><span>Date</span><b className="mono">{doc.date}</b></div>
            <div className="metric"><span>Words</span><b>{doc.words}</b></div>
            <div className="metric"><span>Status</span><StatusChip status={doc.status}/></div>
          </div>
          <div className="side-section">
            <div className="side-h"><b>Entities</b><span className="muted small">{entities.length}</span></div>
            {Object.entries(entityGroups).map(([k,group])=>(
              group.length > 0 && (
                <div className="ent-group" key={k}>
                  <div className="ent-group-title">
                    <span><span className="dot" style={{background:`var(--${k})`}}/>{ETYPE_LABEL[k]}</span>
                    <span>{group.length}</span>
                  </div>
                  {group.map(e=>(
                    <div key={e.id} className={cx('ent-item', activeEntId===e.id&&'active')} onClick={()=>setActiveEntId(e.id)}>
                      <span>{e.display}</span><span className="n">×{e.count}</span>
                    </div>
                  ))}
                </div>
              )
            ))}
            {entities.length===0 && <div className="muted small" style={{padding:'4px 0'}}>No entities detected. Select text then click "Add entity".</div>}
          </div>
          <div className="side-section">
            <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginBottom:8}} onClick={()=>setSaveModal(true)}>
              <Icon.save/>Save to Library
            </button>
            <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={()=>setExportOpen(true)}>
              <Icon.download/>Export TEI XML
            </button>
          </div>
        </aside>
      </div>

      {editModal && <EntityEditModal ent={editModal.ent} onSave={saveEdit} onClose={()=>setEditModal(null)}/>}
      {addModal  && <EntityAddModal data={addModal} onSave={saveAdd} onClose={()=>setAddModal(null)}/>}
      {saveModal && <SaveModal doc={{...doc, entities}} onSave={d=>{onSaveToLibrary(d);setSaveModal(false);}} onClose={()=>setSaveModal(false)}/>}
      {exportOpen && <ExportModal doc={{...doc, entities}} onClose={()=>setExportOpen(false)}/>}
    </div>
  );
}

// ── Entity modals ───────────────────────────────────────────────────────────
function EntityEditModal({ ent, onSave, onClose }) {
  const [tag, setTag] = useState(ent.tei_tag||'persName');
  const [ref, setRef] = useState(ent.ref||'');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h3>Edit entity</h3><button className="btn-icon" onClick={onClose}><Icon.close/></button></div>
        <div className="modal-body">
          <div style={{marginBottom:14}}><label className="label">Text</label><div style={{fontFamily:'var(--serif-display)',fontSize:17,color:'var(--brown-900)'}}>{ent.text}</div></div>
          <div style={{marginBottom:14}}><label className="label">TEI Tag</label><select className="select" value={tag} onChange={e=>setTag(e.target.value)}>{TAG_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="label">Reference URI (Wikidata, VIAF…)</label><input className="input" value={ref} onChange={e=>setRef(e.target.value)} placeholder="https://www.wikidata.org/wiki/Q…"/></div>
        </div>
        <div className="modal-foot"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={()=>onSave({tei_tag:tag,ref})}>Save</button></div>
      </div>
    </div>
  );
}

function EntityAddModal({ data, onSave, onClose }) {
  const [tag, setTag] = useState('persName');
  const [ref, setRef] = useState('');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h3>Add entity</h3><button className="btn-icon" onClick={onClose}><Icon.close/></button></div>
        <div className="modal-body">
          <div style={{marginBottom:14}}><label className="label">Selected text</label><div style={{fontFamily:'var(--serif-display)',fontSize:17,color:'var(--brown-900)'}}>{data.text}</div></div>
          <div style={{marginBottom:14}}><label className="label">TEI Tag</label><select className="select" value={tag} onChange={e=>setTag(e.target.value)}>{TAG_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="label">Reference URI (optional)</label><input className="input" value={ref} onChange={e=>setRef(e.target.value)} placeholder="https://www.wikidata.org/wiki/Q…"/></div>
        </div>
        <div className="modal-foot"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={()=>onSave({tei_tag:tag,ref})}>Add entity</button></div>
      </div>
    </div>
  );
}

// ── Export modal ────────────────────────────────────────────────────────────
function ExportModal({ doc, onClose }) {
  const [tab, setTab]       = useState('tei');
  const [teiXml, setTeiXml] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (tab==='tei') generateTei(); }, [tab]);

  async function generateTei() {
    setLoading(true);
    const fd = new FormData();
    fd.append('text', doc.text);
    fd.append('entities', JSON.stringify(doc.entities));
    fd.append('title', doc.title||'');
    fd.append('author', doc.author||'');
    fd.append('source', doc.source||'');
    try {
      const r = await fetch('/api/tei', { method:'POST', body:fd });
      setTeiXml(await r.text());
    } catch(e) { setTeiXml('Error generating TEI: '+e.message); }
    finally { setLoading(false); }
  }

  function download() {
    const blob = new Blob([teiXml], {type:'application/xml'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (doc.title||'output').replace(/[^a-z0-9]/gi,'_')+'.xml';
    a.click();
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(teiXml).then(()=>{
      const btn = document.getElementById('copy-btn');
      if(btn){btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1500);}
    });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h3>Export "{doc.title}"</h3><button className="btn-icon" onClick={onClose}><Icon.close/></button></div>
        <div className="modal-body">
          <div className="seg" style={{marginBottom:14}}>
            {[['tei','TEI XML'],['plain','Plain text']].map(([k,l])=>(
              <button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </div>
          {tab==='tei' && (loading ? <div className="codeblock">Generating TEI XML…</div> : <pre className="codeblock">{teiXml}</pre>)}
          {tab==='plain' && <pre className="codeblock">{doc.text}</pre>}
        </div>
        <div className="modal-foot">
          <button id="copy-btn" className="btn btn-ghost" onClick={copyToClipboard}>Copy</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn" onClick={download}><Icon.download/>Download .xml</button>
        </div>
      </div>
    </div>
  );
}

// ── Search screen ───────────────────────────────────────────────────────────
function SearchScreen({ docs, onOpen }) {
  const [q, setQ] = useState('');

  const results = q.length > 1
    ? docs.filter(d =>
        d.title.toLowerCase().includes(q.toLowerCase()) ||
        (d.author||'').toLowerCase().includes(q.toLowerCase()) ||
        (d.text||'').toLowerCase().includes(q.toLowerCase())
      ).map(d => {
        const idx = (d.text||'').toLowerCase().indexOf(q.toLowerCase());
        const excerpt = idx > -1
          ? '…' + d.text.slice(Math.max(0,idx-60), idx+q.length+60).replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>') + '…'
          : '';
        return { ...d, excerpt };
      })
    : [];

  return (
    <div className="page">
      <h1 className="page-title">Search the corpus</h1>
      <p className="page-sub">Full-text search across all saved and transcribed documents.</p>
      <div style={{display:'flex',gap:10,marginBottom:24}}>
        <div className="search" style={{flex:1,maxWidth:600}}>
          <Icon.search/>
          <input placeholder="Search people, places, phrases…" value={q} onChange={e=>setQ(e.target.value)} style={{fontSize:16,padding:'11px 11px 11px 38px'}}/>
        </div>
      </div>
      {q.length > 1 && results.length===0 && <div className="muted italic">No results for "{q}"</div>}
      {results.map(r=>(
        <div key={r.id} className="search-result" onClick={()=>onOpen(r.id)}>
          <h4>{r.title}</h4>
          {r.excerpt && <div className="excerpt" dangerouslySetInnerHTML={{__html:r.excerpt}}/>}
          <div className="meta"><span>{r.author}</span><span>·</span><span className="mono">{r.date}</span><span>·</span><span>{r.type}</span></div>
        </div>
      ))}
      {q.length<=1 && docs.length===0 && (
        <div style={{color:'var(--ink-mute)',fontStyle:'italic',fontFamily:'var(--serif)',fontSize:15}}>
          Save transcribed documents to the Library to search them here.
        </div>
      )}
      {q.length<=1 && docs.length>0 && (
        <div style={{color:'var(--ink-mute)',fontStyle:'italic',fontFamily:'var(--serif)',fontSize:15}}>
          Type at least 2 characters to search across {docs.length} document{docs.length!==1?'s':''}…
        </div>
      )}
    </div>
  );
}

// ── Tweaks panel ─────────────────────────────────────────────────────────────
function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div className="tweaks">
      <h4>Tweaks <button className="btn-icon" onClick={onClose} style={{padding:2}}><Icon.close/></button></h4>
      <div style={{fontFamily:'var(--sans)',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-mute)',margin:'4px 0 6px'}}>Theme</div>
      <div className="tweak-row">
        {[['','Warm archival'],['scholarly','Modern scholarly'],['dark','Dark']].map(([k,l])=>(
          <button key={k} className={tweaks.theme===k?'active':''} onClick={()=>setTweak('theme',k)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ── App root ────────────────────────────────────────────────────────────────
function App() {
  const [route, nav]             = useHashRoute();
  const [library, setLibrary]    = useState(() => loadLibrary());
  const [sessionDocs, setSessionDocs] = useState([]); // docs with live blob URLs
  const [openDoc, setOpenDoc]    = useState(null);
  const [tweaks, setTweaks]      = useState({ theme:'' });
  const [tweaksVisible, setTweaksVisible] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = tweaks.theme; }, [tweaks.theme]);

  useEffect(() => {
    const h = e => {
      if (e.data?.type==='__activate_edit_mode')   setTweaksVisible(true);
      if (e.data?.type==='__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', h);
    window.parent.postMessage({type:'__edit_mode_available'},'*');
    return () => window.removeEventListener('message', h);
  }, []);

  function setTweak(k, v) {
    setTweaks(t=>({...t,[k]:v}));
    window.parent.postMessage({type:'__edit_mode_set_keys', edits:{[k]:v}},'*');
  }

  // Save a doc to persistent library
  function addToLibrary(doc) {
    const updated = [doc, ...library.filter(d=>d.id!==doc.id)];
    setLibrary(updated);
    saveLibrary(updated);
    // Also keep in sessionDocs so image blob URL survives this session
    setSessionDocs(prev => [doc, ...prev.filter(d=>d.id!==doc.id)]);
  }

  function deleteFromLibrary(id) {
    const updated = library.filter(d=>d.id!==id);
    setLibrary(updated);
    saveLibrary(updated);
  }

  function openDocById(id) {
    // sessionDocs has live blob URLs; library has metadata only
    const doc = sessionDocs.find(d=>d.id===id) || library.find(d=>d.id===id);
    if (doc) { setOpenDoc(doc); nav('/doc/'+id); }
  }

  // Called when transcription completes
  // saveToLibrary=true means also persist immediately
  function onTranscribeComplete(doc, saveToLibrary=false) {
    setSessionDocs(prev => [doc, ...prev.filter(d=>d.id!==doc.id)]);
    if (saveToLibrary) addToLibrary(doc);
    setOpenDoc(doc);
    nav('/doc/'+doc.id);
  }

  // All docs for search = library + session (deduped)
  const allDocs = [...sessionDocs, ...library.filter(d=>!sessionDocs.find(s=>s.id===d.id))];

  let screen;
  switch(route.screen) {
    case 'library':
      screen = <Library docs={allDocs} onOpen={openDocById} onGoUpload={()=>nav('/upload')} onDelete={deleteFromLibrary}/>;
      break;
    case 'doc':
      const doc = openDoc?.id===route.id ? openDoc : sessionDocs.find(d=>d.id===route.id) || library.find(d=>d.id===route.id) || null;
      screen = doc
        ? <Editor doc={doc} onBack={()=>nav('/library')} onSaveToLibrary={addToLibrary}/>
        : (
          <div className="page" style={{textAlign:'center',paddingTop:80}}>
            <Icon.file style={{width:48,height:48,color:'var(--ink-mute)',marginBottom:16}}/>
            <div style={{fontFamily:'var(--serif-display)',fontSize:18,marginBottom:8}}>Document not found</div>
            <div className="muted" style={{marginBottom:24}}>This document may have been from a previous session. Please re-transcribe it.</div>
            <button className="btn" onClick={()=>nav('/upload')}><Icon.upload/>Transcribe new</button>
          </div>
        );
      break;
    case 'search':
      screen = <SearchScreen docs={allDocs} onOpen={openDocById}/>;
      break;
    default: // 'upload' is the home
      screen = <Upload onComplete={onTranscribeComplete} onGoLibrary={()=>nav('/library')}/>;
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <div>
            <h1 className="mast-title">Historical Markup Tool</h1>
            <div className="mast-sub"><b>Emma B. Andrews Diary Project</b> · Newbook Digital Texts · University of Washington</div>
          </div>
          <div className="mast-right">
            <span className="mast-badge"><span className="dot"/>Claude claude-sonnet-4-5 active</span>
            <span className="mast-badge">Anthropic API</span>
          </div>
        </div>
      </header>

      <nav className="nav">
        <div className="nav-inner">
          <a className={route.screen==='upload'?'active':''} onClick={()=>nav('/upload')} style={{cursor:'pointer'}}><Icon.upload/>Transcribe</a>
          <a className={route.screen==='library'?'active':''} onClick={()=>nav('/library')} style={{cursor:'pointer'}}><Icon.library/>Library {library.length>0&&<span className="chip" style={{marginLeft:4,padding:'1px 6px',fontSize:10}}>{library.length}</span>}</a>
          <a className={route.screen==='doc'?'active':''} style={{cursor:'pointer',opacity:openDoc?1:0.4}} onClick={()=>openDoc&&nav('/doc/'+openDoc.id)}><Icon.book/>Editor</a>
          <a className={route.screen==='search'?'active':''} onClick={()=>nav('/search')} style={{cursor:'pointer'}}><Icon.search/>Search</a>
          <div className="nav-spacer"/>
          <div className="nav-tools"><span className="italic">Emma B. Andrews Diary Project</span></div>
        </div>
      </nav>

      {screen}

      <footer className="footer">
        Historical Markup Tool · <b>Emma B. Andrews Diary Project</b> · University of Washington
      </footer>

      {tweaksVisible && <TweaksPanel tweaks={tweaks} setTweak={setTweak} onClose={()=>setTweaksVisible(false)}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
