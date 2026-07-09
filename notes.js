// notes.js — Note Data Model, CRUD & Seed Data
const Notes = (() => {
  const STORAGE_KEY = 'digital-garden-notes';
  let notes = {};
  let listeners = [];

  function uuid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  }
  function now() { return new Date().toISOString(); }
  function wc(text) { return text ? text.trim().split(/\s+/).filter(Boolean).length : 0; }

  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch(e) {} }
  function load() {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) { notes = JSON.parse(r); return true; } } catch(e) {}
    return false;
  }

  function onChange(fn) { listeners.push(fn); }
  function emit(type, note) { listeners.forEach(fn => fn(type, note)); }

  function create({ title, content='', tags=[], stage='seedling', connections=[] }) {
    const id = uuid();
    const n = { id, title: title||'Untitled', content, tags, stage, connections:[...connections],
      createdAt: now(), updatedAt: now(), wordCount: wc(content), aiSummary:'', aiSuggestedTags:[] };
    notes[id] = n;
    connections.forEach(cid => { if(notes[cid]&&!notes[cid].connections.includes(id)) notes[cid].connections.push(id); });
    save(); emit('create', n); return n;
  }

  function update(id, changes) {
    if(!notes[id]) return null;
    const n = notes[id];
    if(changes.title!==undefined) n.title=changes.title;
    if(changes.content!==undefined){ n.content=changes.content; n.wordCount=wc(changes.content); }
    if(changes.tags!==undefined) n.tags=[...changes.tags];
    if(changes.stage!==undefined) n.stage=changes.stage;
    if(changes.aiSummary!==undefined) n.aiSummary=changes.aiSummary;
    if(changes.aiSuggestedTags!==undefined) n.aiSuggestedTags=[...changes.aiSuggestedTags];
    n.updatedAt=now(); save(); emit('update',n); return n;
  }

  function addConnection(a,b) {
    if(!notes[a]||!notes[b]||a===b) return;
    if(!notes[a].connections.includes(b)) notes[a].connections.push(b);
    if(!notes[b].connections.includes(a)) notes[b].connections.push(a);
    save(); emit('connect',notes[a]);
  }
  function removeConnection(a,b) {
    if(!notes[a]||!notes[b]) return;
    notes[a].connections=notes[a].connections.filter(c=>c!==b);
    notes[b].connections=notes[b].connections.filter(c=>c!==a);
    save(); emit('disconnect',notes[a]);
  }

  function remove(id) {
    if(!notes[id]) return;
    const n=notes[id];
    n.connections.forEach(cid=>{ if(notes[cid]) notes[cid].connections=notes[cid].connections.filter(c=>c!==id); });
    delete notes[id]; save(); emit('delete',n);
  }

  function get(id) { return notes[id]||null; }
  function getAll() { return Object.values(notes); }
  function getAllEdges() {
    const seen=new Set(), edges=[];
    Object.values(notes).forEach(n=>{
      n.connections.forEach(cid=>{
        const key=[n.id,cid].sort().join('|');
        if(!seen.has(key)&&notes[cid]){ seen.add(key); edges.push({source:n.id,target:cid}); }
      });
    });
    return edges;
  }
  function getAllTags() {
    const s=new Set(); Object.values(notes).forEach(n=>n.tags.forEach(t=>s.add(t))); return [...s].sort();
  }
  function getStats() {
    const all=Object.values(notes);
    return { total:all.length, connections:getAllEdges().length,
      seedling:all.filter(n=>n.stage==='seedling').length,
      budding:all.filter(n=>n.stage==='budding').length,
      evergreen:all.filter(n=>n.stage==='evergreen').length };
  }
  function exportJSON() { return JSON.stringify(notes,null,2); }
  function importJSON(json) { try { notes=JSON.parse(json); save(); emit('import',null); return true; } catch(e){ return false; } }

  function seed() {
    const ids={}, keys=['emergence','rhizome','garden-stream','swarm','hypertext','zettelkasten','mycelium','second-brain','neural-nature','creative-ai','wood-wide-web','serendipity'];
    keys.forEach(k=>ids[k]=uuid());
    const connMap = {
      'emergence':['rhizome','swarm','mycelium'],'rhizome':['emergence','garden-stream','hypertext'],
      'garden-stream':['rhizome','zettelkasten','second-brain'],'swarm':['emergence','neural-nature','creative-ai'],
      'hypertext':['rhizome','garden-stream','zettelkasten'],'zettelkasten':['garden-stream','hypertext','second-brain'],
      'mycelium':['emergence','swarm','wood-wide-web'],'second-brain':['garden-stream','zettelkasten','serendipity'],
      'neural-nature':['swarm','mycelium','creative-ai'],'creative-ai':['swarm','neural-nature','serendipity'],
      'wood-wide-web':['mycelium','emergence'],'serendipity':['second-brain','creative-ai','hypertext']
    };
    const defs = [
      {key:'emergence',title:'Emergence',stage:'evergreen',tags:['systems','complexity'],
        content:"# Emergence\n\nEmergence is the phenomenon where complex systems exhibit properties that their individual components do not possess. A single neuron doesn't think. A single ant doesn't build a colony.\n\n## Key Principles\n- **Non-linearity**: Small changes cascade into massive effects\n- **Self-organization**: Order arises without central control\n- **Feedback loops**: Systems learn from their own outputs\n\n> \"More is different.\" — Philip Anderson"},
      {key:'rhizome',title:'Rhizomatic Thinking',stage:'budding',tags:['philosophy','networks'],
        content:"# Rhizomatic Thinking\n\nDeleuze and Guattari proposed the **rhizome** as a model for knowledge — contrasting the hierarchical \"tree\" model. A rhizome has no beginning or end.\n\n## Principles\n1. **Connection**: Any point can connect to any other\n2. **Heterogeneity**: Connects different domains\n3. **Multiplicity**: No single pivot\n4. **Cartography**: A map, not a tracing\n\nKnowledge doesn't grow in straight lines — it sprawls, connects, and entangles."},
      {key:'garden-stream',title:'The Garden & The Stream',stage:'evergreen',tags:['writing','digital-gardens'],
        content:"# The Garden & The Stream\n\nMike Caulfield's essay contrasts two modes of knowledge:\n\n## The Stream\nChronological, ephemeral, reactive. Twitter feeds, blog posts. Optimized for engagement.\n\n## The Garden\nTopological, evergreen, reflective. Wikis, digital gardens. Optimized for understanding.\n\nThe Stream is how we consume. The Garden is how we cultivate."},
      {key:'swarm',title:'Swarm Intelligence',stage:'budding',tags:['biology','ai'],
        content:"# Swarm Intelligence\n\nCollective behavior emerging from decentralized, self-organized systems. No leader. No blueprint.\n\n## Examples\n- **Ant colonies**: Pheromone trails optimize foraging\n- **Bird flocks**: Simple rules create murmurations\n- **Fish schools**: Collective predator avoidance\n\nThe lesson: intelligence doesn't require a brain — it requires interaction."},
      {key:'hypertext',title:'Hypertext & Nonlinearity',stage:'budding',tags:['technology','writing'],
        content:"# Hypertext & Nonlinearity\n\nTed Nelson coined \"hypertext\" in 1963 — text that branches and allows choice.\n\n## Key Concepts\n- **Links as structure**: Not footnotes — connections\n- **Transclusion**: Content by reference\n- **Bidirectional links**: Both endpoints aware\n\nDigital gardens recover what hypertext promised."},
      {key:'zettelkasten',title:'Zettelkasten Method',stage:'seedling',tags:['productivity','writing'],
        content:"# Zettelkasten Method\n\nLuhmann's slip box — interconnected index cards powering extraordinary output.\n\n## Core Principles\n- **Atomic notes**: One idea per card\n- **Unique IDs**: Every card gets an address\n- **Explicit links**: Cards reference each other\n- **Bottom-up**: Structure emerges from connections\n\nNot a filing system — a thinking partner."},
      {key:'mycelium',title:'Mycelial Networks',stage:'evergreen',tags:['biology','networks'],
        content:"# Mycelial Networks\n\nBeneath every forest is an invisible internet. Mycorrhizal fungi form vast underground networks connecting trees.\n\n## How It Works\n- Fungal hyphae connect tree roots\n- Trees exchange carbon, water, nutrients\n- Mother trees nurture seedlings\n- Dying trees share resources\n\nThe forest isn't competing trees — it's one interconnected organism."},
      {key:'second-brain',title:'Second Brain',stage:'seedling',tags:['productivity','technology'],
        content:"# Building a Second Brain\n\nTiago Forte's methodology — capture, organize, distill, express.\n\n## PARA System\n- **Projects**: Active goals\n- **Areas**: Ongoing responsibilities\n- **Resources**: Topics of interest\n- **Archives**: Completed items\n\nThe goal: forget confidently. Offload to a trusted system."},
      {key:'neural-nature',title:'Neural Networks & Nature',stage:'budding',tags:['ai','biology'],
        content:"# Neural Networks & Nature\n\nArtificial neural networks mirror biology deeper than metaphor.\n\n## Parallels\n- Neurons & synapses → Nodes & weights\n- Hebbian learning → Backpropagation\n- Neuroplasticity → Transfer learning\n\n## Where They Diverge\n- Biology is stochastic; AI is deterministic\n- Brains learn from few examples\n- Biological networks are embodied"},
      {key:'creative-ai',title:'Creative AI',stage:'seedling',tags:['ai','creativity'],
        content:"# Creative AI\n\nCan machines be creative? Creativity is a spectrum.\n\n## Boden's Framework\n1. **Combinational**: Novel combinations of familiar ideas\n2. **Exploratory**: Systematic exploration of conceptual space\n3. **Transformational**: Changing the rules themselves\n\nThe question: Can AI help us be more creative?"},
      {key:'wood-wide-web',title:'Wood Wide Web',stage:'budding',tags:['biology','ecology'],
        content:"# The Wood Wide Web\n\nSuzanne Simard revealed forests as cooperative networks.\n\n## Key Discoveries\n- Mother trees recognize and nurture kin\n- Different species share nutrients via fungi\n- Stressed trees receive more network support\n\nThe connections are as important as the nodes."},
      {key:'serendipity',title:'Serendipity Engine',stage:'seedling',tags:['creativity','technology'],
        content:"# The Serendipity Engine\n\nEngineering lucky accidents. Serendipity = prepared minds + unexpected connections.\n\n## Design Principles\n- **Adjacency**: Place unrelated ideas near each other\n- **Randomness**: Controlled chaos in browsing\n- **Slow discovery**: Optimize for wandering\n\nThe best ideas come from stumbling, not searching."}
    ];
    defs.forEach(d=>{
      const conns=(connMap[d.key]||[]).map(k=>ids[k]);
      notes[ids[d.key]]={id:ids[d.key],title:d.title,content:d.content,tags:d.tags,stage:d.stage,
        connections:conns,createdAt:now(),updatedAt:now(),wordCount:wc(d.content),aiSummary:'',aiSuggestedTags:[]};
    });
    save(); emit('seed',null);
  }

  function init() {
    if(!load()) seed();
    Object.values(notes).forEach(n=>{ n.connections=n.connections.filter(cid=>!!notes[cid]); });
    save();
  }

  return { init,create,update,remove,get,getAll,getAllEdges,getAllTags,getStats,addConnection,removeConnection,onChange,exportJSON,importJSON,seed };
})();
