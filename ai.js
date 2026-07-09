// ai.js — Client-side AI Curation Engine
const AI = (() => {
  const STOPWORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','shall','should','may','might','must','can','could',
    'i','me','my','we','our','you','your','he','him','his','she','her','it','its','they','them','their',
    'this','that','these','those','what','which','who','whom','when','where','how','why',
    'and','but','or','nor','not','no','so','if','then','than','too','very','just','also',
    'in','on','at','to','for','of','with','by','from','about','into','through','during',
    'before','after','above','below','between','under','again','further','once',
    'all','each','every','both','few','more','most','other','some','such','only','own',
    'same','as','until','while','because','although','since','unless','however','therefore']);

  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  function termFrequency(tokens) {
    const tf = {};
    tokens.forEach(t => { tf[t] = (tf[t]||0) + 1; });
    const max = Math.max(...Object.values(tf), 1);
    Object.keys(tf).forEach(t => { tf[t] /= max; });
    return tf;
  }

  function computeIDF(allNotes) {
    const df = {}, N = allNotes.length;
    allNotes.forEach(note => {
      const unique = new Set(tokenize(note.title + ' ' + note.content));
      unique.forEach(t => { df[t] = (df[t]||0) + 1; });
    });
    const idf = {};
    Object.keys(df).forEach(t => { idf[t] = Math.log(N / df[t]); });
    return idf;
  }

  // Auto-tag a note using TF-IDF
  function suggestTags(note, allNotes, count = 5) {
    const tokens = tokenize(note.title + ' ' + note.title + ' ' + note.content);
    if (tokens.length === 0) return [];
    const tf = termFrequency(tokens);
    const idf = computeIDF(allNotes);
    const scores = {};
    Object.keys(tf).forEach(t => {
      scores[t] = tf[t] * (idf[t] || 0);
    });
    return Object.entries(scores)
      .sort((a,b) => b[1] - a[1])
      .slice(0, count)
      .map(e => e[0])
      .filter(t => !note.tags.includes(t));
  }

  // Build bag-of-words vector for a note
  function noteVector(note, allNotes) {
    const idf = computeIDF(allNotes);
    const tokens = tokenize(note.title + ' ' + note.content);
    const tf = termFrequency(tokens);
    const vec = {};
    Object.keys(tf).forEach(t => { vec[t] = tf[t] * (idf[t]||0); });
    return vec;
  }

  function cosineSim(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let dot = 0, magA = 0, magB = 0;
    keys.forEach(k => {
      const va = a[k]||0, vb = b[k]||0;
      dot += va * vb; magA += va*va; magB += vb*vb;
    });
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  // Suggest connections for a note
  function suggestConnections(noteId, allNotes, maxSuggestions = 5) {
    const note = allNotes.find(n => n.id === noteId);
    if (!note) return [];
    const vectors = {};
    allNotes.forEach(n => { vectors[n.id] = noteVector(n, allNotes); });
    const scored = allNotes
      .filter(n => n.id !== noteId && !note.connections.includes(n.id))
      .map(n => ({ id: n.id, title: n.title, score: cosineSim(vectors[noteId], vectors[n.id]) }))
      .filter(s => s.score > 0.05)
      .sort((a,b) => b.score - a.score);
    return scored.slice(0, maxSuggestions);
  }

  // Connection strength between two notes
  function connectionStrength(idA, idB, allNotes) {
    const a = allNotes.find(n => n.id === idA);
    const b = allNotes.find(n => n.id === idB);
    if (!a || !b) return 0.3;
    const vecA = noteVector(a, allNotes), vecB = noteVector(b, allNotes);
    const contentSim = cosineSim(vecA, vecB);
    const tagsA = new Set(a.tags), tagsB = new Set(b.tags);
    const intersection = [...tagsA].filter(t => tagsB.has(t)).length;
    const union = new Set([...a.tags, ...b.tags]).size;
    const tagSim = union > 0 ? intersection / union : 0;
    return Math.min(contentSim * 0.6 + tagSim * 0.4 + 0.15, 1);
  }

  // Suggest growth stage promotion
  function suggestStage(note) {
    const wc = note.wordCount || 0;
    const cc = note.connections ? note.connections.length : 0;
    if (wc >= 200 && cc >= 4) return 'evergreen';
    if (wc >= 80 && cc >= 2) return 'budding';
    return 'seedling';
  }

  // Extractive summary: pick best sentence
  function summarize(note) {
    if (!note.content) return '';
    const sentences = note.content.replace(/#+\s/g,'').split(/[.!?]\s+/).filter(s => s.trim().length > 20);
    if (sentences.length === 0) return note.content.substring(0, 100);
    const tokens = tokenize(note.content);
    const tf = termFrequency(tokens);
    let best = '', bestScore = -1;
    sentences.forEach(s => {
      const st = tokenize(s);
      let score = st.reduce((sum, t) => sum + (tf[t]||0), 0) / Math.max(st.length, 1);
      if (score > bestScore) { bestScore = score; best = s.trim(); }
    });
    return best.length > 150 ? best.substring(0, 147) + '...' : best;
  }

  // Run full AI analysis on all notes
  function analyzeAll(allNotes) {
    allNotes.forEach(note => {
      note.aiSuggestedTags = suggestTags(note, allNotes);
      note.aiSummary = summarize(note);
    });
  }

  return { suggestTags, suggestConnections, connectionStrength, suggestStage, summarize, analyzeAll };
})();
