// editor.js — Note Editor Panel
const Editor = (() => {
  let panel, currentId = null;
  let saveTimeout = null;
  let isEditing = false;

  function init() {
    panel = document.getElementById('note-panel');
    // Close button
    panel.querySelector('.panel-close').addEventListener('click', close);
    // Edit/Preview toggle
    panel.querySelector('#btn-edit').addEventListener('click', toggleEdit);
    // Save
    panel.querySelector('#btn-save').addEventListener('click', saveNow);
    // Delete
    panel.querySelector('#btn-delete').addEventListener('click', () => {
      if (currentId && confirm('Remove this note from the garden?')) {
        Notes.remove(currentId);
        close();
      }
    });
    // Stage buttons
    panel.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentId) return;
        const stage = btn.dataset.stage;
        Notes.update(currentId, { stage });
        renderStage(stage);
        App.refresh();
      });
    });
    // Content editing
    panel.querySelector('#note-content-edit').addEventListener('input', debounce(() => {
      if (!currentId) return;
      const content = panel.querySelector('#note-content-edit').value;
      Notes.update(currentId, { content });
      renderPreview(content);
    }, 800));
    // Title editing
    panel.querySelector('#note-title-input').addEventListener('input', debounce(() => {
      if (!currentId) return;
      Notes.update(currentId, { title: panel.querySelector('#note-title-input').value });
      App.refresh();
    }, 800));
    // Tag input
    panel.querySelector('#tag-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim().toLowerCase();
        if (val && currentId) {
          const note = Notes.get(currentId);
          if (!note.tags.includes(val)) {
            Notes.update(currentId, { tags: [...note.tags, val] });
            renderTags(Notes.get(currentId));
            App.refresh();
          }
          e.target.value = '';
        }
      }
    });
    // Connection search
    panel.querySelector('#connection-search').addEventListener('input', e => {
      renderConnectionSuggestions(e.target.value);
    });
  }

  function open(noteId) {
    currentId = noteId;
    const note = Notes.get(noteId);
    if (!note) return;
    isEditing = false;
    render(note);
    panel.classList.add('open');
    Graph.selectNode(noteId);
  }

  function close() {
    panel.classList.remove('open');
    currentId = null;
    isEditing = false;
    Graph.selectNode(null);
  }

  function isOpen() { return panel.classList.contains('open'); }
  function getCurrentId() { return currentId; }

  function render(note) {
    panel.querySelector('#note-title-input').value = note.title;
    panel.querySelector('#note-content-edit').value = note.content;
    renderPreview(note.content);
    renderStage(note.stage);
    renderTags(note);
    renderConnections(note);
    renderAI(note);
    renderMeta(note);
    setEditMode(false);
    // AI suggestion for stage
    const suggested = AI.suggestStage(note);
    const promoEl = panel.querySelector('#stage-suggestion');
    if (suggested !== note.stage) {
      const icons = { seedling: '🌱', budding: '🌿', evergreen: '🌳' };
      promoEl.innerHTML = `AI suggests: <button class="stage-promote-btn" data-stage="${suggested}">${icons[suggested]} ${suggested}</button>`;
      promoEl.querySelector('.stage-promote-btn').addEventListener('click', () => {
        Notes.update(currentId, { stage: suggested });
        renderStage(suggested);
        promoEl.innerHTML = '';
        App.refresh();
      });
      promoEl.style.display = 'block';
    } else {
      promoEl.style.display = 'none';
    }
  }

  function renderPreview(md) {
    const html = markdownToHtml(md);
    panel.querySelector('#note-content-preview').innerHTML = html;
  }

  function renderStage(stage) {
    panel.querySelectorAll('.stage-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stage === stage);
    });
  }

  function renderTags(note) {
    const container = panel.querySelector('#tags-container');
    container.innerHTML = '';
    note.tags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${tag} <button class="tag-remove" data-tag="${tag}">&times;</button>`;
      pill.querySelector('.tag-remove').addEventListener('click', () => {
        Notes.update(note.id, { tags: note.tags.filter(t => t !== tag) });
        renderTags(Notes.get(note.id));
        App.refresh();
      });
      container.appendChild(pill);
    });
  }

  function renderConnections(note) {
    const container = panel.querySelector('#connections-list');
    container.innerHTML = '';
    note.connections.forEach(cid => {
      const cn = Notes.get(cid);
      if (!cn) return;
      const icons = { seedling: '🌱', budding: '🌿', evergreen: '🌳' };
      const el = document.createElement('div');
      el.className = 'connection-item';
      el.innerHTML = `<span class="connection-link" data-id="${cid}">${icons[cn.stage]||''} ${cn.title}</span>
        <button class="connection-remove" data-id="${cid}">&times;</button>`;
      el.querySelector('.connection-link').addEventListener('click', () => open(cid));
      el.querySelector('.connection-remove').addEventListener('click', () => {
        Notes.removeConnection(note.id, cid);
        renderConnections(Notes.get(note.id));
        App.refresh();
      });
      container.appendChild(el);
    });
  }

  function renderConnectionSuggestions(query) {
    const container = panel.querySelector('#connection-suggestions');
    container.innerHTML = '';
    if (!query || !currentId) return;
    const q = query.toLowerCase();
    const note = Notes.get(currentId);
    Notes.getAll()
      .filter(n => n.id !== currentId && !note.connections.includes(n.id) && n.title.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(n => {
        const el = document.createElement('div');
        el.className = 'suggestion-item';
        el.textContent = n.title;
        el.addEventListener('click', () => {
          Notes.addConnection(currentId, n.id);
          renderConnections(Notes.get(currentId));
          panel.querySelector('#connection-search').value = '';
          container.innerHTML = '';
          App.refresh();
        });
        container.appendChild(el);
      });
  }

  function renderAI(note) {
    const allNotes = Notes.getAll();
    // Suggested tags
    const sugTags = AI.suggestTags(note, allNotes, 4);
    const sugContainer = panel.querySelector('#ai-suggested-tags');
    sugContainer.innerHTML = '';
    sugTags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill suggested';
      pill.innerHTML = `+ ${tag}`;
      pill.addEventListener('click', () => {
        Notes.update(note.id, { tags: [...note.tags, tag] });
        renderTags(Notes.get(note.id));
        renderAI(Notes.get(note.id));
        App.refresh();
      });
      sugContainer.appendChild(pill);
    });
    // Suggested connections
    const sugConns = AI.suggestConnections(note.id, allNotes, 3);
    const sugConnsContainer = panel.querySelector('#ai-suggested-connections');
    sugConnsContainer.innerHTML = '';
    sugConns.forEach(s => {
      const el = document.createElement('div');
      el.className = 'suggestion-item ai';
      el.innerHTML = `<span>🤖 ${s.title}</span><span class="sim-score">${Math.round(s.score * 100)}%</span>`;
      el.addEventListener('click', () => {
        Notes.addConnection(currentId, s.id);
        renderConnections(Notes.get(currentId));
        renderAI(Notes.get(currentId));
        App.refresh();
      });
      sugConnsContainer.appendChild(el);
    });
    // Summary
    const summary = AI.summarize(note);
    panel.querySelector('#ai-summary').textContent = summary || 'Not enough content for a summary.';
  }

  function renderMeta(note) {
    const d = new Date(note.updatedAt);
    panel.querySelector('#note-meta').textContent =
      `${note.wordCount} words · ${note.connections.length} connections · Updated ${d.toLocaleDateString()}`;
  }

  function toggleEdit() {
    setEditMode(!isEditing);
  }

  function setEditMode(editing) {
    isEditing = editing;
    panel.querySelector('#note-content-edit').style.display = editing ? 'block' : 'none';
    panel.querySelector('#note-content-preview').style.display = editing ? 'none' : 'block';
    panel.querySelector('#btn-edit').textContent = editing ? '👁 Preview' : '✏️ Edit';
    panel.querySelector('#note-title-input').readOnly = !editing;
    if (editing) panel.querySelector('#note-content-edit').focus();
  }

  function saveNow() {
    if (!currentId) return;
    const note = Notes.get(currentId);
    if (note) {
      Notes.update(currentId, {
        title: panel.querySelector('#note-title-input').value,
        content: panel.querySelector('#note-content-edit').value
      });
      App.refresh();
    }
  }

  // Simple markdown to HTML
  function markdownToHtml(md) {
    if (!md) return '<p class="empty">Start writing...</p>';
    let html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\| *(.+?) *\|/g, (m) => {
        const cells = m.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    // Wrap adjacent <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>(\s*<br>)?)+/g, m => '<ul>' + m.replace(/<br>/g, '') + '</ul>');
    // Wrap adjacent <tr> in <table>
    html = html.replace(/(<tr>.*?<\/tr>\s*)+/g, m => '<table>' + m + '</table>');
    return '<p>' + html + '</p>';
  }

  function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { init, open, close, isOpen, getCurrentId };
})();
