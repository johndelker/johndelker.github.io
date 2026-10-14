(() => {
  const errorEl = document.getElementById('content-error');
  const navButtons = Array.from(document.querySelectorAll('button[data-view]'));
  const panels = new Map(
    Array.from(document.querySelectorAll('[data-view-panel]'))
      .map(panel => [panel.dataset.viewPanel, panel])
  );

  function appendInline(parent, value) {
    if (typeof value === 'string') {
      parent.appendChild(document.createTextNode(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(part => appendInline(parent, part));
      return;
    }
    if (value && typeof value === 'object' && typeof value.text === 'string' && typeof value.href === 'string') {
      const url = new URL(value.href, document.baseURI);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
        throw new Error(`Unsupported link protocol: ${url.protocol}`);
      }
      const link = document.createElement('a');
      link.href = value.href;
      link.appendChild(document.createTextNode(value.text));
      parent.appendChild(link);
      return;
    }
    throw new Error('Content contains an invalid text or link block.');
  }

  function renderParagraph(parent, content) {
    const paragraph = document.createElement('p');
    appendInline(paragraph, content);
    parent.appendChild(paragraph);
  }

  function renderBlocks(parent, blocks) {
    let cardGrid = null;
    blocks.forEach(block => {
      if (block.type === 'card') {
        if (!cardGrid) {
          cardGrid = document.createElement('div');
          cardGrid.className = 'grid g-2';
          parent.appendChild(cardGrid);
        }
        const card = document.createElement('div');
        card.className = 'card';
        if (block.heading) {
          const heading = document.createElement('h3');
          heading.textContent = block.heading;
          card.appendChild(heading);
        }
        renderBlocks(card, block.blocks);
        cardGrid.appendChild(card);
        return;
      }

      cardGrid = null;
      if (block.type === 'paragraph') {
        renderParagraph(parent, block.content);
      } else if (block.type === 'list') {
        const list = document.createElement('ul');
        block.items.forEach(item => {
          const listItem = document.createElement('li');
          appendInline(listItem, item);
          list.appendChild(listItem);
        });
        parent.appendChild(list);
      } else {
        throw new Error(`Unsupported content block: ${block.type}`);
      }
    });
  }

  function renderHome(home) {
    const portrait = document.getElementById('home-portrait');
    const copy = document.getElementById('home-copy');
    const image = document.createElement('img');
    image.src = home.image;
    image.alt = home.imageAlt;
    image.addEventListener('error', () => {
      image.hidden = true;
      const fallback = document.createElement('p');
      fallback.className = 'muted';
      fallback.textContent = home.imageAlt;
      portrait.replaceChildren(fallback);
    }, { once: true });
    portrait.replaceChildren(image);

    const title = document.createElement('h1');
    title.id = 'home-title';
    title.textContent = home.title;
    const subtitle = document.createElement('p');
    subtitle.className = 'sub';
    subtitle.textContent = home.subtitle;
    const introduction = document.createElement('p');
    introduction.textContent = home.introduction;
    copy.replaceChildren(title, subtitle, introduction);
  }

  function renderView(view) {
    const panel = panels.get(view.id);
    if (!panel) throw new Error(`No page container exists for view "${view.id}".`);
    const title = document.createElement('h2');
    title.id = `${view.id}-title`;
    title.textContent = view.title;
    panel.replaceChildren(title);
    renderBlocks(panel, view.blocks);
  }

  function selectView(viewId) {
    if (!panels.has(viewId)) return;
    panels.forEach((panel, id) => { panel.hidden = id !== viewId; });
    navButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.view === viewId));
    });
  }

  navButtons.forEach(button => {
    button.addEventListener('click', () => selectView(button.dataset.view));
  });

  async function loadContent() {
    try {
      const response = await fetch(new URL('./content.json', document.baseURI));
      if (!response.ok) throw new Error(`Content request failed (${response.status}).`);
      const content = await response.json();

      document.title = content.meta.title;
      document.querySelector('meta[name="description"]').content = content.meta.description;
      document.querySelector('meta[property="og:title"]').content = content.meta.openGraphTitle;
      document.querySelector('meta[property="og:description"]').content = content.meta.openGraphDescription;
      document.querySelector('link[rel="icon"]').href = content.meta.icon;
      renderHome(content.home);
      content.views.forEach(renderView);
      document.getElementById('footer-name').textContent = content.footerName;
      document.getElementById('y').textContent = new Date().getFullYear();
      errorEl.hidden = true;
      selectView('home');
    } catch (error) {
      panels.forEach(panel => { panel.hidden = true; });
      navButtons.forEach(button => {
        button.disabled = true;
        button.setAttribute('aria-pressed', 'false');
      });
      errorEl.textContent = `Unable to load website content. ${error.message || error}`;
      errorEl.hidden = false;
    }
  }

  loadContent();
})();
