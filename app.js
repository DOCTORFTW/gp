// app.js — App Controller
const App = (() => {
  let activeFilters = { stages: new Set(['seedling','budding','evergreen']), tags: new Set() };
  let searchQuery = '';

  function init() {
    Notes.init();
    const canvas = document.getElementById('graph-canvas');
    Particles.init(canvas);
    Graph.init(canvas, {
      onNodeClick: id => Editor.open(id),
      onNodeHover: id => {
        const tooltip = document.getElementById('tooltip');
        if (id) {
          const note = Notes.get(id);
          if (note) {
            const icons = { seedling:'🌱', budding:'🌿', evergreen:'🌳' };
            tooltip.innerHTML = `<strong>${icons[note.stage]} ${note.title}</strong><br><span class="tt-meta">${note.wordCount} words · ${note.connections.length} links</span>`;
            if (note.aiSummary) tooltip.innerHTML += `<br><span class="tt-summary">${note.aiSummary}</span>`;
            tooltip.style.display = 'block';
          }
        } else {
          tooltip.style.display = 'none';
        }
      }
    });
    Editor.init();

    // Run AI analysis
    AI.analyzeAll(Notes.getAll());
    Notes.getAll().forEach(n => {
      Notes.update(n.id, { aiSummary: n.aiSummary, aiSuggestedTags: n.aiSuggestedTags });
    });

    refresh();
    Graph.start();
    bindUI();
    updateStats();

    // Track mouse for tooltip
    document.addEventListener('mousemove', e => {
      const tooltip = document.getElementById('tooltip');
      if (tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
      }
    });

    Notes.onChange(() => { refresh(); updateStats(); });
  }

  function refresh() {
    const allNotes = Notes.getAll();
    const edges = Notes.getAllEdges();
    Graph.setData(allNotes, edges);
    Graph.computeStrengths(allNotes);
    applyFilters();
    updateTagBar();
  }

  function bindUI() {
    // New note
    document.getElementById('btn-new-note').addEventListener('click', createNewNote);

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase();
      applyFilters();
    });
    document.getElementById('btn-search-clear').addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      applyFilters();
    });

    // Stage filters
    document.querySelectorAll('.filter-stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stage = btn.dataset.stage;
        if (activeFilters.stages.has(stage)) {
          activeFilters.stages.delete(stage);
          btn.classList.remove('active');
        } else {
          activeFilters.stages.add(stage);
          btn.classList.add('active');
        }
        applyFilters();
      });
    });

    // Reset view
    document.getElementById('btn-reset-view').addEventListener('click', () => {
      Graph.resetView();
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', () => {
      const json = Notes.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'digital-garden.json'; a.click();
      URL.revokeObjectURL(url);
    });

    // Import
    document.getElementById('btn-import').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          if (Notes.importJSON(ev.target.result)) {
            AI.analyzeAll(Notes.getAll());
            refresh();
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });

    // Reset garden
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Reset garden to seed data? All your notes will be lost.')) {
        localStorage.clear();
        Notes.init();
        AI.analyzeAll(Notes.getAll());
        refresh();
        Editor.close();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); createNewNote(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchInput.focus(); }
      if (e.key === 'Escape') { Editor.close(); searchInput.blur(); }
    });
  }

  function createNewNote() {
    const note = Notes.create({ title: 'Untitled Seed', content: '', tags: [], stage: 'seedling' });
    refresh();
    setTimeout(() => Editor.open(note.id), 100);
  }

  function applyFilters() {
    Graph.setFilter(node => {
      if (!activeFilters.stages.has(node.stage)) return false;
      if (activeFilters.tags.size > 0 && !node.tags.some(t => activeFilters.tags.has(t))) return false;
      if (searchQuery && !node.title.toLowerCase().includes(searchQuery)) return false;
      return true;
    });
  }

  function updateTagBar() {
    const tags = Notes.getAllTags();
    const container = document.getElementById('tag-filters');
    container.innerHTML = '';
    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-filter-btn' + (activeFilters.tags.has(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        if (activeFilters.tags.has(tag)) {
          activeFilters.tags.delete(tag);
          btn.classList.remove('active');
        } else {
          activeFilters.tags.add(tag);
          btn.classList.add('active');
        }
        applyFilters();
      });
      container.appendChild(btn);
    });
  }

  function updateStats() {
    const s = Notes.getStats();
    document.getElementById('stats-bar').innerHTML =
      `<span>${s.total} notes</span><span>·</span><span>${s.connections} connections</span><span>·</span>` +
      `<span class="stat-seedling">${s.seedling} 🌱</span><span class="stat-budding">${s.budding} 🌿</span><span class="stat-evergreen">${s.evergreen} 🌳</span>`;
  }

  return { init, refresh };
})();

document.addEventListener('DOMContentLoaded', App.init);
