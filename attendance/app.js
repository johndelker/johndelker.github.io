// Guard: ensure config.js loaded first
if (typeof WEB_APP_URL === 'undefined' || !WEB_APP_URL) {
  document.addEventListener('DOMContentLoaded', () => {
    const columnsEl = document.getElementById('columns');
    if (columnsEl) {
      columnsEl.innerHTML = '<div class="card muted">Configuration error: WEB_APP_URL is not set. Check config.js.</div>';
    }
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    /* ======== DOM HOOKS ======== */
    const columnsEl   = document.getElementById('columns');
    const loadingCard = document.getElementById('loadingCard');
    const statusEl    = document.getElementById('status');
    const dateEl      = document.getElementById('date');
    const submitEl    = document.getElementById('submit');
    const themeToggle = document.getElementById('themeToggle');

    // Updated controls
    const byGroupBtn  = document.getElementById('byGroup');
    const byAlphaBtn  = document.getElementById('byAlpha');
    const sortByLastBtn  = document.getElementById('sortByLast');
    const sortByFirstBtn = document.getElementById('sortByFirst');

    const groupRowEl  = document.getElementById('groupRow');

    /* ======== SAFE STATE ======== */
    let originalRows = [];    // [{name, group}]
    let selectedSet  = new Set();
    let lastColCount = null;
    let selectedGroup = 'none'; // Group Number picker (default each load)
    let isLoading = true;

    /* ======== UTIL ======== */
    const safeParse = (json, fallback) => { try { return JSON.parse(json); } catch { return fallback; } };
    const debounce  = (fn, ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
    const escapeHtml= (s) => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const normalizeForSort = (s) => (s||'').toLowerCase().replace(/[^a-z0-9]+/gi, ' ').trim();
    const firstAlphaNum = (s) => {
      const ch = (s || '').trim().charAt(0).toUpperCase();
      return /[A-Z0-9]/.test(ch) ? ch : '#';
    };
    const getColumnCount = () => {
      if (window.matchMedia('(min-width: 960px)').matches) return 3;
      if (window.matchMedia('(min-width: 640px)').matches) return 2;
      return 1;
    };
    const fetchJSONWithTimeout = async (url, opts = {}, timeoutMs = 10000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        if (!res.ok) throw new Error(`Server ${res.status} ${res.statusText}`);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error('Server did not return JSON.'); }
        return data;
      } finally { clearTimeout(id); }
    };

    // Robust parser: returns { first, last }
    function parseName(name) {
      const s = (name || '').trim();
      if (!s) return { first: '', last: '' };
      if (s.includes(',')) {
        const [lastPart, ...rest] = s.split(',');
        const last = lastPart.trim();
        const first = rest.join(',').trim(); // preserves middle names, suffixes in "first" slot
        return { first, last };
      }
      const bits = s.split(/\s+/);
      if (bits.length === 1) return { first: bits[0], last: '' };
      const last = bits.pop();
      const first = bits.join(' ');
      return { first, last };
    }

    /* ======== DATE + THEME ======== */
    try { dateEl.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch {}
    const saved = safeParse(localStorage.getItem('attendanceOptions') || '', {});
    if (saved.darkMode === false) { document.body.classList.remove('dark'); themeToggle.textContent = '☀️'; }
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      themeToggle.textContent = isDark ? '🌙' : '☀️';
      saveOptions();
    });

    /* ======== GROUP BY + SORT BY ======== */
    // New model:
    // - groupByMode: 'group' | 'alpha'
    // - sortMode:    'last'  | 'first'
    let groupByMode = saved.groupByMode || 'group';
    let sortMode    = saved.sortMode    || 'last';   // default = Last Name

    function saveOptions() {
      const opts = {
        darkMode: document.body.classList.contains('dark'),
        groupByMode,
        sortMode
      };
      try { localStorage.setItem('attendanceOptions', JSON.stringify(opts)); } catch {}
    }

    function setGroupByButtons(mode) {
      groupByMode = mode;
      byGroupBtn.classList.toggle('active', mode === 'group');
      byGroupBtn.setAttribute('aria-selected', mode === 'group');
      byAlphaBtn.classList.toggle('active', mode === 'alpha');
      byAlphaBtn.setAttribute('aria-selected', mode === 'alpha');
      saveOptions();
      render();
    }

    function setSortByButtons(mode) {
      sortMode = mode; // 'last' | 'first'
      const lastActive  = mode === 'last';
      const firstActive = mode === 'first';
      sortByLastBtn.classList.toggle('active', lastActive);
      sortByLastBtn.setAttribute('aria-selected', lastActive);
      sortByFirstBtn.classList.toggle('active', firstActive);
      sortByFirstBtn.setAttribute('aria-selected', firstActive);
      saveOptions();
      render();
    }

    byGroupBtn.addEventListener('click', () => setGroupByButtons('group'));
    byAlphaBtn.addEventListener('click', () => setGroupByButtons('alpha'));
    sortByLastBtn.addEventListener('click',  () => setSortByButtons('last'));
    sortByFirstBtn.addEventListener('click', () => setSortByButtons('first'));

    // Initialize button states
    setGroupByButtons(groupByMode);
    setSortByButtons(sortMode);

    /* ======== GROUP NUMBER BUTTONS ======== */
    function buildGroupButtons() {
      groupRowEl.innerHTML = '';
      // Left cell: Do Not Change
      const noneBtn = document.createElement('button');
      noneBtn.type = 'button';
      noneBtn.className = 'group-btn';
      noneBtn.dataset.value = 'none';
      noneBtn.textContent = 'Do Not Change';
      noneBtn.addEventListener('click', () => { selectedGroup = 'none'; markGroupButtons(); }, { passive: true });
      groupRowEl.appendChild(noneBtn);

      // Right cell: numeric strip (1..10)
      const strip = document.createElement('div');
      strip.className = 'num-strip';
      for (let i = 1; i <= 10; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'group-btn num-btn';
        b.dataset.value = String(i);
        b.textContent = String(i);
        b.addEventListener('click', () => { selectedGroup = String(i); markGroupButtons(); }, { passive: true });
        strip.appendChild(b);
      }
      groupRowEl.appendChild(strip);

      markGroupButtons();
    }
    function markGroupButtons() {
      groupRowEl.querySelectorAll('.group-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === selectedGroup);
      });
    }
    buildGroupButtons();

    /* ======== LOAD DATA ======== */
    async function loadRows() {
      try {
        const data = await fetchJSONWithTimeout(WEB_APP_URL, { method: 'GET' }, 10000);
        if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Failed to load');
        if (Array.isArray(data.rows)) {
          originalRows = data.rows.map(r => ({
            name: r.name,
            group: (r.group == null ? '' : String(r.group)).trim()
          }));
        } else if (Array.isArray(data.names)) {
          originalRows = data.names.map(n => ({ name: n, group: '' })); // fallback
        } else {
          originalRows = [];
        }
        isLoading = false;
        render();
      } catch (err) {
        isLoading = false;
        columnsEl.innerHTML = `<div class="card muted">Error loading students: ${escapeHtml(String(err.message || err))}</div>`;
      }
    }
    loadRows();

    /* ======== RESIZE ======== */
    window.addEventListener('resize', debounce(() => {
      const cc = getColumnCount();
      if (!isLoading && cc !== lastColCount) render();
    }, 100), { passive: true });

    /* ======== RENDERING ======== */
    function captureSelection() {
      document.querySelectorAll('input.student-box').forEach(cb => {
        const name = cb.getAttribute('data-name');
        if (!name) return;
        if (cb.checked) selectedSet.add(name); else selectedSet.delete(name);
      });
    }

    function render() {
      if (isLoading) return;

      captureSelection();

      const colCount = getColumnCount();

      const items = originalRows.map(r => {
        const { first, last } = parseName(r.name);
        // Display & sort depend on sortMode
        const display = (sortMode === 'first')
          ? `${first}, ${last}`.replace(/,\s*$/, '').trim()
          : `${last}, ${first}`.replace(/,\s*$/, '').trim();

        const sortKey = (sortMode === 'first')
          ? normalizeForSort(`${first} ${last}`)
          : normalizeForSort(`${last} ${first}`);

        const letterKey = firstAlphaNum(display);

        const raw = (r.group || '').trim();
        const numMatch = raw.match(/^\d+$/);
        const groupNorm = raw === '' ? '' : (numMatch ? String(parseInt(raw, 10)) : raw);

        return {
          orig: r.name,
          first, last,
          display,
          sortKey,
          letterKey,
          groupNorm
        };
      });

      // Stable ordering by the selected sort key
      items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      if (!items.length) {
        columnsEl.innerHTML = `<div class="card muted">No student names found in the sheet.</div>`;
        lastColCount = colCount;
        return;
      }

      const groups = (groupByMode === 'group') ? makeGroupsByGroup(items)
                                               : makeGroupsByLetter(items);

      renderSequentialGroups(groups, colCount);

      lastColCount = colCount;
    }

    function makeGroupsByLetter(items) {
      const map = new Map();
      for (const it of items) {
        const key = it.letterKey;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(it);
      }
      const keys = Array.from(map.keys()).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
      });
      return keys.map(k => ({ label: k, size: map.get(k).length, items: map.get(k) }));
    }

    function makeGroupsByGroup(items) {
      const map = new Map();
      for (const it of items) {
        const key = it.groupNorm; // '' => unknown
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(it);
      }
      const keys = Array.from(map.keys());
      const numeric = keys.filter(k => k !== '' && /^\d+$/.test(k))
                          .map(k => parseInt(k, 10))
                          .sort((a,b)=>a-b)
                          .map(n => String(n));
      const alphas  = keys.filter(k => k !== '' && !/^\d+$/.test(k))
                          .sort((a,b)=>a.localeCompare(b));
      const unknown = keys.includes('') ? [''] : [];
      const ordered = [...numeric, ...alphas, ...unknown];
      return ordered.map(k => ({
        label: k === '' ? 'Group Unknown' : `Group ${k}`,
        size: map.get(k).length,
        items: map.get(k)
      }));
    }

    /* ==== ORDER-PRESERVING COLUMN DISTRIBUTION ==== */
    function renderSequentialGroups(groups, colCount) {
      const totalItems = groups.reduce((s,g)=>s+g.items.length,0);
      const targetPerCol = Math.ceil(totalItems / colCount);

      const cols = Array.from({ length: colCount }, () => []);
      let colIdx = 0, countInCol = 0;

      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const remainingGroups = groups.length - i;
        const remainingCols = colCount - colIdx;

        const wouldOverflow = (countInCol > 0) && ((countInCol + g.items.length) > targetPerCol);
        const mustMove = wouldOverflow && (remainingGroups >= remainingCols);

        if (mustMove && colIdx < colCount - 1) {
          colIdx++;
          countInCol = 0;
        }
        cols[colIdx].push(g);
        countInCol += g.items.length;
      }

      columnsEl.innerHTML = '';
      for (let c = 0; c < colCount; c++) {
        const col = document.createElement('div');
        col.className = 'column';
        for (const g of cols[c]) {
          const header = document.createElement('div');
          header.className = 'group-header';
          header.textContent = g.label;
          col.appendChild(header);
          for (const item of g.items) col.appendChild(studentRow(item));
        }
        columnsEl.appendChild(col);
      }
    }

    function studentRow(item) {
      const row = document.createElement('label');
      row.className = 'student';
      const checkedAttr = selectedSet.has(item.orig) ? 'checked' : '';
      row.innerHTML = `
        <input class="student-box" type="checkbox" data-name="${escapeHtml(item.orig)}" ${checkedAttr} />
        <span>${escapeHtml(item.display)}</span>
      `;
      const cb = row.querySelector('input.student-box');
      cb.addEventListener('change', () => {
        const name = cb.getAttribute('data-name');
        if (cb.checked) selectedSet.add(name); else selectedSet.delete(name);
      }, { passive: true });
      return row;
    }

    /* ======== SUBMIT ======== */
    submitEl.addEventListener('click', async () => {
      const names = Array.from(selectedSet);
      if (!names.length) return setStatus('Please check at least one student.', true);

      submitEl.disabled = true;
      setStatus('Submitting…');

      const body = new URLSearchParams({
        names: JSON.stringify(names),
        group: String(selectedGroup) // 'none' or '1'..'10'
      }).toString();

      try {
        const res = await fetch(WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        const data = await res.json().catch(() => ({}));
        if (!data.ok) throw new Error(data.error || 'Unknown error');

        selectedSet.clear();
        document.querySelectorAll('input.student-box').forEach(cb => cb.checked = false);

        const updated = (data.updated || []).join(', ');
        const grouped = (data.grouped || []).join(', ');
        const missing = (data.missing || []);
        let msg = `Saved. Updated attendance: ${updated || '—'}.`;
        if (data.groupApplied) msg += ` Set Group=${data.groupApplied} for: ${grouped || '—'}.`;
        if (missing.length) msg += ` Not found: ${missing.join(', ')}.`;
        setStatus(msg);
      } catch (err) {
        setStatus('Error: ' + String(err.message || err), true);
      } finally {
        submitEl.disabled = false;
      }
    });

    function setStatus(msg, isError = false) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('error', isError);
      statusEl.classList.toggle('muted', !isError);
    }
  });
}
