// Единое окно разделов поверх живого рабочего стола (прототип, направление A).
//
// Окно одно и не пересоздаётся: при переходе между разделами меняется только содержимое.
// Содержимое берётся из существующих страниц разделов (те же тексты и разметка) и кешируется.
// Состояния окна: closed · open · minimized (+ zoomed). Состояние отражается в адресе,
// поэтому переживает перезагрузку: ?open=раздел, ?min=раздел, &zoom=1.
(() => {
  const body = document.body;
  const win = document.getElementById('window');
  if (!win) return;

  const APP_URL = body.dataset.appUrl;
  const DESKTOP_TITLE = body.dataset.desktopTitle || document.title;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 1024px)');
  const EASE_OUT = 'cubic-bezier(.2, .7, .2, 1)';
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, reduce.matches ? 0 : ms));

  // ---------- Разделы ----------
  const SECTIONS = { projects: 'Проекты', about: 'Обо мне', books: 'Книжная полка', design: 'Дизайн-проекты' };
  const ROUTES = {
    projects: { src: '/prototype/projects-lab/v3/', pick: '.open-folder__content', title: 'Проекты', section: 'projects', note: 'Цифровые продукты: от\u00a0пользовательской помощи до\u00a0контент-систем и\u00a0запуска новых направлений', status: (root) => plural(root.querySelectorAll('.project-file').length, ['документ', 'документа', 'документов']) },
    'projects/widget': { src: '/prototype/projects-lab/widget-final/', pick: 'main', title: 'Widget', section: 'projects' },
    'projects/alphacon': { src: '/prototype/projects-lab/alphacon-a/', pick: 'main', title: 'Alphacon', section: 'projects' },
    'projects/uzum-business': { src: '/prototype/projects-lab/uzum-d/', pick: 'main', title: 'Uzum Business', section: 'projects' },
    about: { src: '/prototype/about-typewriter/', pick: 'main', title: 'Обо мне', section: 'about', note: 'Всё, что не\u00a0поместилось в\u00a0проекты и\u00a0резюме', status: () => 'Сайт собирала вместе с\u00a0Claude' },   // машинка (about-typewriter). Прежние версии: ?about=scenes (листы), ?about=c (машинка и карточки)
    books: { src: '/prototype/books-direction/', pick: 'main', title: 'Книжная полка', section: 'books', note: 'Если не\u00a0знаете, что почитать\u00a0— заглядывайте на\u00a0мою полку', status: (root) => plural(Number(root.querySelector('[data-lib]')?.dataset.total || 0), ['книга', 'книги', 'книг']) },
    design: { src: '/prototype/projects-lab/design-folder/', pick: '.open-folder__content', title: 'Дизайн-проекты', section: 'design', note: 'Структура продукта, сценарии и\u00a0интерфейсы', status: (root) => plural(root.querySelectorAll('.project-file').length, ['проект', 'проекта', 'проектов']) },
    'design/widget': { src: '/prototype/projects-lab/design-widget/', pick: 'main', title: 'Widget', section: 'design' },
    'design/flowup': { src: '/prototype/projects-lab/design-flowup/', pick: 'main', title: 'FlowUp', section: 'design' },
    'design/technonicol': { src: '/prototype/projects-lab/design-technonicol/', pick: 'main', title: 'Технониколь', section: 'design' },
    'design/converteron': { src: '/prototype/projects-lab/design-converteron/', pick: 'main', title: '2+2', section: 'design' }
  };
  // Папки (разделы) открываются с одинаковой шапкой, как строка папки в Finder: название слева, пояснение справа.
  // Прототип: прежние варианты подачи «Проектов» по-прежнему доступны через ?variant=v1|v2|v3
  const VARIANT = /^v([123]|3b|3c)$/.test(new URLSearchParams(location.search).get('variant') || '') ? new URLSearchParams(location.search).get('variant') : null;
  if (VARIANT) ROUTES.projects.src = `/prototype/projects-lab/${VARIANT}/`;
  // Прототип: варианты страницы кейса Widget (?case=a|b|c)
  const CASE = /^([abcde]|final)$/.test(new URLSearchParams(location.search).get('case') || '') ? new URLSearchParams(location.search).get('case') : null;
  if (CASE) ROUTES['projects/widget'].src = `/prototype/projects-lab/widget-${CASE}/`;
  const AC = /^([abc]|a-prev)$/.test(new URLSearchParams(location.search).get('ac') || '') ? new URLSearchParams(location.search).get('ac') : null;
  if (AC) ROUTES['projects/alphacon'].src = `/prototype/projects-lab/alphacon-${AC}/`;
  const AB = /^([abc]|scenes)$/.test(new URLSearchParams(location.search).get('about') || '') ? new URLSearchParams(location.search).get('about') : null;
  if (AB === 'scenes') { ROUTES.about.src = '/prototype/about-scenes/'; delete ROUTES.about.note; }
  else if (AB) { ROUTES.about.src = `/prototype/about-lab/${AB}/`; ROUTES.about.pick = 'main'; delete ROUTES.about.status; if (AB === 'c') delete ROUTES.about.note; }
  const UZ = /^([abcd]|old)$/.test(new URLSearchParams(location.search).get('uz') || '') ? new URLSearchParams(location.search).get('uz') : null;
  if (UZ) ROUTES['projects/uzum-business'].src = UZ === 'old' ? '/prototype/projects/uzum-business.html' : `/prototype/projects-lab/uzum-${UZ}/`;
  // Старые адреса разделов → маршруты окна (ссылки внутри содержимого открываются в этом же окне)
  const PATHS = {
    '/prototype/projects/': 'projects', '/prototype/projects/index.html': 'projects',
    '/prototype/projects/widget.html': 'projects/widget', '/prototype/projects/alphacon.html': 'projects/alphacon', '/prototype/projects/uzum-business.html': 'projects/uzum-business',
    '/prototype/about-direction/': 'about', '/prototype/about/': 'about',
    '/prototype/books-direction/': 'books', '/prototype/books/': 'books',
    '/prototype/design/': 'design', '/prototype/design/widget.html': 'design/widget', '/prototype/design/flowup.html': 'design/flowup', '/prototype/design/technonicol.html': 'design/technonicol', '/prototype/design/converteron.html': 'design/converteron', '/prototype/contact/': 'contact'
  };
  // Публикация: раздел живёт в адресе как путь (/projects/, /design/flowup/), а не как ?open=
  const PRETTY = APP_URL === '/';
  const keyFromPath = (path) => { const k = path.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, ''); return k && ROUTES[k] ? k : null; };
  function plural(n, forms) {
    const m10 = n % 10; const m100 = n % 100;
    const form = m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2];
    return `${n} ${form}`;
  }
  // Порядок для стрелок «назад / вперёд»: как в сайдбаре. Внутри «Проектов» — по порядку файлов.
  // На первом разделе «назад» неактивна; внутри проекта «назад» ведёт наверх, к списку проектов.
  const ORDER = ['projects', 'about', 'books', 'design'];
  const CHILDREN = { projects: ['projects/widget', 'projects/alphacon', 'projects/uzum-business'], design: ['design/flowup', 'design/technonicol', 'design/widget', 'design/converteron'] };
  const DESKTOP = 'desktop';
  const parentOf = (key) => Object.keys(CHILDREN).find((parent) => CHILDREN[parent].includes(key)) || null;
  const neighbors = (key) => {
    const parent = parentOf(key);
    if (parent) { const list = CHILDREN[parent]; return { back: parent, forward: list[list.indexOf(key) + 1] || null }; }
    const i = ORDER.indexOf(key);
    if (i === -1) return { back: DESKTOP, forward: null };
    return { back: ORDER[i - 1] || null, forward: ORDER[i + 1] || null };   // «Проекты» первые: назад некуда
  };
  const nameOf = (key) => (key === DESKTOP ? 'Рабочий стол' : ROUTES[key]?.title || '');

  const routeFromHref = (href) => {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return null;
    if (url.pathname === new URL(APP_URL, location.href).pathname) return url.searchParams.get('open') || url.searchParams.get('min');
    if (PRETTY && keyFromPath(url.pathname)) return keyFromPath(url.pathname);
    return PATHS[url.pathname] || null;
  };

  // ---------- Загрузка содержимого (кеш) ----------
  const cache = new Map();
  const load = (key) => {
    if (!cache.has(key)) {
      const route = ROUTES[key];
      cache.set(key, fetch(route.src, { credentials: 'same-origin', cache: 'no-cache' })
        .then((response) => { if (!response.ok) throw new Error(response.status); return response.text(); })
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const picked = doc.querySelector(route.pick);
          if (!picked) throw new Error('no content');
          const fragment = document.createElement('div');
          fragment.innerHTML = picked.innerHTML;
          fragment.querySelectorAll('[id="main"]').forEach((el) => el.removeAttribute('id'));
          fragment.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
          return fragment.innerHTML;
        })
        .catch(() => `<p class="win__error">Не удалось загрузить раздел. <a href="${route.src}">Открыть отдельной страницей</a></p>`));
    }
    return cache.get(key);
  };
  const prefetchAll = () => Object.keys(ROUTES).forEach((key) => load(key));

  // ---------- Элементы оболочки ----------
  const page = win.querySelector('[data-win-page]');
  const scroller = win.querySelector('[data-win-scroll]');
  const toolbar = win.querySelector('.win__toolbar');
  const title = win.querySelector('.win__title');
  const titleMobile = win.querySelector('[data-win-title-mobile]');
  const status = win.querySelector('[data-win-status]');
  const nav = win.querySelector('[data-win-nav]');
  const indicator = nav.querySelector('[data-indicator]');
  const backButton = win.querySelector('[data-win="back"]');
  const forwardButton = win.querySelector('[data-win="forward"]');
  const zoomButton = win.querySelector('[data-win="zoom"]');
  const menuButton = win.querySelector('[data-win-menu-button]');
  const menu = win.querySelector('[data-win-menu]');

  let state = 'closed';        // closed | open | minimized
  let everOpened = false;      // до первого открытия окна адрес полки (?genre, ?book) не сбрасываем
  let current = null;          // текущий маршрут
  const scrolls = new Map();   // запомненная прокрутка разделов (для возврата из проекта к списку)
  let motion = null;           // текущая анимация окна
  let cleanup = [];            // обработчики, привязанные к текущему содержимому

  // ---------- Dock: тот же элемент открытого окна, что в workspace-a ----------
  const dock = document.querySelector('.workspace-dock');
  // Резюме в доке рядом с контактами (прототип: добавляется здесь, общий portfolio-prototype.js не трогаем)
  const CV_URL = '/prototype/resume/tereshenkova-cv.pdf';
  const dockApps = dock?.querySelector('.workspace-dock__apps');
  if (dockApps && !dockApps.querySelector('.workspace-dock__app--cv')) {
    dockApps.insertAdjacentHTML('beforeend', `<a class="workspace-dock__app workspace-dock__app--cv" href="${CV_URL}" target="_blank" rel="noopener" aria-label="Резюме (CV), PDF"><img src="/prototype/shell-lab/cv-icon.svg?v=5" alt=""><span class="workspace-dock__label">CV</span></a>`);
  }
  const folderSvg = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3.5 9.5A3.5 3.5 0 0 1 7 6h6l3 3h9a3.5 3.5 0 0 1 3.5 3.5v11A3.5 3.5 0 0 1 25 27H7a3.5 3.5 0 0 1-3.5-3.5Z"/></svg>';
  let dockItem = null;
  if (dock) {
    dock.insertAdjacentHTML('beforeend', `
      <span class="workspace-dock__separator" aria-hidden="true"></span>
      <a class="workspace-dock__current" href="${APP_URL}" aria-controls="window">
        <span class="workspace-dock__window" aria-hidden="true"><i></i>${folderSvg}<b data-dock-title></b></span>
        <span class="workspace-dock__label" data-dock-label></span>
      </a>`);
    dockItem = dock.querySelector('.workspace-dock__current');
    dockItem.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      if (state === 'minimized') restore();
      else if (state === 'open') win.focus({ preventScroll: true });
    });
  }
  const dockTarget = () => dockItem?.querySelector('.workspace-dock__window') || dockItem;

  const syncDock = (instant = false) => {
    if (!dock || !dockItem) return;
    if (instant) dock.classList.add('is-instant');
    const label = SECTIONS[ROUTES[current]?.section] || ROUTES[current]?.title || '';
    dock.classList.toggle('is-window-closed', state === 'closed');
    dockItem.classList.toggle('is-minimized', state === 'minimized');
    dockItem.classList.toggle('workspace-dock__current--projects', ROUTES[current]?.section === 'projects');
    dockItem.querySelector('[data-dock-title]').textContent = label;
    dockItem.querySelector('[data-dock-label]').textContent = state === 'minimized' ? `${label} — свёрнуто` : label;
    if (state === 'open') { dockItem.setAttribute('aria-current', 'page'); dockItem.setAttribute('aria-label', `Открыт раздел: ${label}`); }
    else { dockItem.removeAttribute('aria-current'); dockItem.setAttribute('aria-label', state === 'minimized' ? `Вернуть свёрнутое окно: ${label}` : 'Окно закрыто'); }
    dockItem.tabIndex = state === 'closed' ? -1 : 0;
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => dock.classList.remove('is-instant')));
  };

  // ---------- Адрес и заголовок вкладки (без перезагрузки) ----------
  const syncUrl = () => {
    const url = new URL(APP_URL, location.href);
    if (state === 'open') { if (PRETTY) url.pathname = `/${current}/`; else url.searchParams.set('open', current); }
    if (state === 'minimized') url.searchParams.set('min', current);
    if (state !== 'closed' && body.classList.contains('is-zoomed')) url.searchParams.set('zoom', '1');
    if (VARIANT) url.searchParams.set('variant', VARIANT);
    if (CASE) url.searchParams.set('case', CASE);
    if (AC) url.searchParams.set('ac', AC);
    if (UZ) url.searchParams.set('uz', UZ);
    if (AB) url.searchParams.set('about', AB);
    if (current === 'about' && (state === 'open' || !everOpened)) ['scene', 'story'].forEach((k) => { const v = new URLSearchParams(location.search).get(k); if (v) url.searchParams.set(k, v); });
    if (current === 'books' && (state === 'open' || !everOpened)) ['genre', 'book'].forEach((k) => { const v = new URLSearchParams(location.search).get(k); if (v) url.searchParams.set(k, v); });
    history.replaceState({ window: state, route: current }, '', url.pathname + url.search);
    document.title = state === 'open' ? `${ROUTES[current].title} — Маргарита Терешенкова` : DESKTOP_TITLE;
  };

  // ---------- Сайдбар, заголовок, статус ----------
  const moveIndicator = (animated = true) => {
    const link = nav.querySelector('[aria-current="page"]');
    indicator.classList.toggle('is-instant', !animated);
    if (!link) { indicator.style.opacity = '0'; return; }
    indicator.style.transform = `translateY(${link.offsetTop}px)`;
    indicator.style.height = `${link.offsetHeight}px`;
    indicator.style.opacity = '1';
  };
  const syncChrome = async (key, animated) => {
    const route = ROUTES[key];
    [nav, menu].forEach((list) => list?.querySelectorAll('[data-section]').forEach((link) => {
      if (link.dataset.section === route.section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }));
    moveIndicator(animated);
    const { back, forward } = neighbors(key);
    backButton.disabled = !back;
    forwardButton.disabled = !forward;
    backButton.setAttribute('aria-label', back ? `Назад: ${nameOf(back)}` : 'Назад: это первый раздел');
    forwardButton.setAttribute('aria-label', forward ? `Вперёд: ${nameOf(forward)}` : 'Вперёд: дальше разделов нет');
    if (title.textContent !== route.title) {
      if (animated && !reduce.matches) { title.classList.add('is-swapping'); body.classList.add('is-title-swapping'); await wait(140); }
      title.textContent = route.title;
      titleMobile.textContent = route.title;
      title.classList.remove('is-swapping'); body.classList.remove('is-title-swapping');
    }
  };

  // ---------- Поведение внутри содержимого ----------
  const bindContent = () => {
    cleanup.forEach((fn) => fn()); cleanup = [];

    // Печатная машинка в «Обо мне» (те же фразы, что на странице раздела)
    const typewriter = page.querySelector('[data-live-typewriter]');
    const line = typewriter?.querySelector('[data-typed-line]');
    if (typewriter && line && !reduce.matches) {
      const phrases = ['Веду контент-направления', 'Работаю со сложными продуктами', 'Соединяю текст и UX', 'Понимаю дизайн и реализацию'];
      let alive = true; let timer = 0; let index = 0;
      const typePhrase = () => {
        if (!alive) return;
        const phrase = phrases[index]; let letter = 0;
        line.textContent = ''; typewriter.classList.add('is-typing-live');
        const step = () => {
          if (!alive) return;
          letter += 1; line.textContent = phrase.slice(0, letter);
          if (letter < phrase.length) { timer = window.setTimeout(step, 48); return; }
          timer = window.setTimeout(() => { typewriter.classList.remove('is-typing-live'); index = (index + 1) % phrases.length; timer = window.setTimeout(typePhrase, 380); }, 1800);
        };
        step();
      };
      typePhrase();
      cleanup.push(() => { alive = false; window.clearTimeout(timer); });
    }

    // Книжная полка: заметка о книге
    const dialog = page.querySelector('[data-book-dialog]');
    if (dialog) {
      page.querySelectorAll('[data-book]').forEach((book) => book.addEventListener('click', () => {
        dialog.querySelector('[data-book-title]').textContent = book.dataset.bookTitle || 'Книга';
        dialog.querySelector('[data-book-text]').textContent = book.dataset.bookText || '';
        dialog.showModal();
      }));
      dialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      cleanup.push(() => { if (dialog.open) dialog.close(); });
    }

    // «Обо мне»: листы в машинке
    if (window.abInit && page.querySelector('.ab')) cleanup.push(window.abInit(page));
    // «Обо мне», листы: about-scenes/scenes.js
    if (window.scenesInit && page.querySelector('[data-sc]')) cleanup.push(window.scenesInit(page));
    // «Обо мне», машинка: about-typewriter/tw.js
    if (window.twInit && page.querySelector('[data-tw]')) cleanup.push(window.twInit(page));
    // Книжная полка: корешки, жанры и открытая книга (books-direction/shelf.js)
    if (window.shelfInit && page.querySelector('[data-lib]')) cleanup.push(window.shelfInit(page));

    // Переключатель примеров (вкладки) на странице проекта
    page.querySelectorAll('[data-tabs]').forEach((box) => {
      const tabs = [...box.querySelectorAll('[role="tab"]')];
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
          const panel = box.querySelector('#' + t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
        const list = tab.parentElement;
        if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: Math.max(0, tab.offsetLeft - list.offsetLeft - 24), behavior: reduce.matches ? 'auto' : 'smooth' });
        // если страница прокручена и прилипшие вкладки накрыли заголовок примера, возвращаем его под вкладки
        const shown = box.querySelector('#' + tab.getAttribute('aria-controls'));
        if (shown) {
          const under = list.getBoundingClientRect().bottom;
          const top = shown.getBoundingClientRect().top;
          if (top < under + 8) {
            let sc = box.parentElement;
            while (sc && sc !== document.body && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
            (sc && sc !== document.body ? sc : window).scrollBy({ top: top - under - 16 });
          }
        }
      };
      // список вкладок прилипает под меню разделов
      const list = tabs[0] && tabs[0].parentElement;
      const navEl = page.querySelector('[data-case-nav]');
      const navH = () => (navEl ? navEl.offsetHeight : 0);
      if (list) { list.classList.add('is-sticky'); list.style.top = `${navH()}px`; }
      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (e) => {
          const j = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
          if (j !== undefined) { e.preventDefault(); select(tabs[j], true); }
        });
      });
    });

    // Кейс: прогресс чтения и активный пункт меню разделов
    const bar = page.querySelector('[data-case-progress]');
    const caseNav = page.querySelector('[data-case-nav]');
    if (bar && caseNav) {
      const links = [...caseNav.querySelectorAll('a[href^="#"]')];
      const sections = links.map((a) => page.querySelector(a.getAttribute('href')));
      let frame = 0; let shown = null;
      const update = () => {
        frame = 0;
        const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
        bar.style.transform = `scaleX(${Math.min(1, Math.max(0, scroller.scrollTop / max))})`;
        const line = caseNav.getBoundingClientRect().bottom + 24;
        let active = -1;
        sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= line) active = i; });
        if (scroller.scrollTop >= max - 2) active = sections.length - 1;
        links.forEach((a, i) => a.toggleAttribute('aria-current', i === active));
        const box = links[0]?.parentElement; const on = links[active];
        if (box && on && box.scrollWidth > box.clientWidth && on !== shown) {
          shown = on;
          box.scrollTo({ left: Math.max(0, on.offsetLeft - box.offsetLeft - 16), behavior: reduce.matches ? 'auto' : 'smooth' });
        }
      };
      const request = () => { if (!frame) frame = requestAnimationFrame(update); };
      scroller.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', request);
      update();
      cleanup.push(() => { scroller.removeEventListener('scroll', request); window.removeEventListener('resize', request); cancelAnimationFrame(frame); });
    }
  };

  // Ссылки внутри окна: разделы открываются здесь же, якоря прокручивают окно
  page.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (link.hasAttribute('data-reload')) return;   // переключатель вариантов прототипа — обычный переход
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      const target = page.querySelector(href);
      if (target) { event.preventDefault(); target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' }); }
      return;
    }
    const key = routeFromHref(link.href);
    if (key && ROUTES[key]) { event.preventDefault(); go(key); }
  });

  // ---------- Смена содержимого: оболочка остаётся, меняется только лист ----------
  let token = 0;
  let destination = null;      // куда идём прямо сейчас (быстрые повторные клики по стрелкам не теряются)
  const show = async (key, { animated = true, scroll = 0, dir = 'none' } = {}) => {
    const my = ++token;
    destination = key;
    const htmlPromise = load(key);
    const chrome = syncChrome(key, animated);
    if (animated && current && !reduce.matches) { page.dataset.dir = dir; page.classList.add('is-out'); await wait(120); }
    const html = await htmlPromise;
    if (my !== token) return;
    cleanup.forEach((fn) => fn()); cleanup = [];
    page.innerHTML = html;
    page.dataset.route = key.replace('/', '-');
    if (ROUTES[key].note) {
      const head = document.createElement('header');
      head.className = 'win-head';
      head.innerHTML = '<h1></h1><p></p>';
      head.querySelector('h1').textContent = ROUTES[key].title;
      head.querySelector('p').textContent = ROUTES[key].note;
      page.prepend(head);
    }
    current = key;
    const route = ROUTES[key];
    const statusText = route.status ? route.status(page) : '';
    status.textContent = statusText;
    win.classList.toggle('no-status', !statusText);
    scroller.scrollTop = scroll;
    toolbar.classList.toggle('is-scrolled', scroll > 2);
    bindContent();
    page.classList.remove('is-out');
    if (animated && !reduce.matches) { page.classList.add('is-in'); void page.offsetWidth; page.classList.remove('is-in'); }
    await chrome;
    syncDock();
    syncUrl();
  };

  // Переход в раздел. dir подсказывает направление смены листа: 'back' | 'forward' | 'none'.
  // К списку проектов возвращаемся на ту же прокрутку, остальные разделы открываются сверху.
  const go = (key, dir = 'none') => {
    if (key === (destination || current)) return;
    if (current) scrolls.set(current, scroller.scrollTop);
    const up = parentOf(current) === key;
    show(key, { scroll: up ? scrolls.get(key) || 0 : 0, dir });
  };
  const step = (which) => {
    const target = neighbors(destination || current)[which];
    if (!target) return;
    if (target === DESKTOP) { close(); return; }
    go(target, which);
  };
  backButton.addEventListener('click', () => step('back'));
  forwardButton.addEventListener('click', () => step('forward'));

  // ---------- Геометрия для анимаций окна ----------
  const play = (keyframes, options) => {
    if (typeof clearGenie === 'function') clearGenie();
    motion?.cancel();
    motion = win.animate(keyframes, { fill: 'both', ...options, duration: reduce.matches ? 0 : options.duration });
    return motion.finished.then(() => true, () => false);
  };
  const release = () => { motion?.cancel(); motion = null; };
  const lerp = (a, b, t) => a + (b - a) * t;

  // Сворачивание в Dock по принципу Genie (macOS):
  // фаза 1 — нижний край сужается к ширине иконки, бока изгибаются S-кривой (воронка);
  // фаза 2 — окно «стекает» через воронку: верхний край опускается к иконке, ширина следует изгибу.
  // Каждый кадр: силуэт — clip-path по кривой, содержимое сжимается в рамку силуэта.
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // как системный ease-in-out
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const SAMPLES = 14;

  const genieFrame = (W, T, p) => {
    const bend = ease(clamp01(p / .42));                       // насколько изогнуты бока
    const bottom = lerp(W.bottom, T.bottom, ease(clamp01(p / .5)));
    const top = lerp(W.top, T.top, ease(clamp01((p - .22) / .78)));
    const edge = (y, from, to) => {
      const s = smooth(clamp01((y - W.top) / Math.max(1, T.top - W.top)));
      return lerp(from, to, s * bend);
    };
    const pts = [];
    let minX = Infinity; let maxX = -Infinity;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const y = lerp(top, bottom, i / SAMPLES);
      const l = edge(y, W.left, T.left);
      const r = edge(y, W.right, T.right);
      pts.push([y, l, r]);
      minX = Math.min(minX, l); maxX = Math.max(maxX, r);
    }
    const bw = Math.max(1, maxX - minX); const bh = Math.max(1, bottom - top);
    const u = (x) => (((x - minX) / bw) * 100).toFixed(2);
    const v = (y) => (((y - top) / bh) * 100).toFixed(2);
    const left = pts.map(([y, l]) => `${u(l)}% ${v(y)}%`);
    const right = pts.slice().reverse().map(([y, , r]) => `${u(r)}% ${v(y)}%`);
    return {
      transform: `translate(${minX - W.left}px, ${top - W.top}px) scale(${bw / W.width}, ${bh / W.height})`,
      clipPath: `polygon(${left.concat(right).join(', ')})`,
      opacity: p < .82 ? 1 : 1 - ease((p - .82) / .18)
    };
  };

  // Покадровая анимация (requestAnimationFrame): direction 1 — свернуть, -1 — развернуть из Dock
  let genieRun = 0;
  const genie = (direction, duration) => new Promise((resolve) => {
    const run = ++genieRun;
    motion?.cancel(); motion = null;
    const target = dockTarget()?.getBoundingClientRect();
    win.style.transform = ''; win.style.clipPath = '';
    const W = win.getBoundingClientRect();
    if (reduce.matches || !target || !target.width) { resolve(true); return; }
    const T = { left: target.left, right: target.right, top: target.top, bottom: target.bottom, width: target.width, height: target.height };
    win.style.transformOrigin = '0 0';
    win.style.willChange = 'transform, clip-path, opacity';
    const start = performance.now();
    const frame = (now) => {
      if (run !== genieRun) { resolve(false); return; }
      const t = clamp01((now - start) / duration);
      const p = direction > 0 ? t : 1 - t;
      const f = genieFrame(W, T, p);
      win.style.transform = f.transform; win.style.clipPath = f.clipPath; win.style.opacity = f.opacity;
      if (t < 1) requestAnimationFrame(frame);
      else resolve(true);
    };
    frame(start);
    requestAnimationFrame(frame);
  });
  const clearGenie = () => {
    genieRun += 1;
    ['transform', 'clipPath', 'opacity', 'transformOrigin', 'willChange'].forEach((prop) => { win.style[prop] = ''; });
  };

  const fromRect = (el) => {
    const w = win.getBoundingClientRect();
    const t = el?.getBoundingClientRect();
    if (!t || !t.width) return 'translateY(10px) scale(.985)';
    const dx = t.left + t.width / 2 - (w.left + w.width / 2);
    const dy = t.top + t.height / 2 - (w.top + w.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${t.width / w.width}, ${t.height / w.height})`;
  };

  // Для проверки кадров: ?genie-test открывает функцию в консоли — window.__genieFrame(0…1)
  if (new URLSearchParams(location.search).has('genie-test')) {
    window.__genieFrame = (p) => {
      clearGenie(); release();
      const W = win.getBoundingClientRect(); const T = dockTarget().getBoundingClientRect();
      const f = genieFrame(W, T, p);
      win.style.transformOrigin = '0 0'; win.style.transform = f.transform; win.style.clipPath = f.clipPath; win.style.opacity = f.opacity;
    };
  }

  // ---------- Состояния окна ----------
  const reveal = () => { win.classList.remove('is-closed'); body.classList.add('is-window-open'); };
  const conceal = () => { win.classList.add('is-closed'); body.classList.remove('is-window-open', 'is-menu-open'); };

  const open = async (key, { from = null } = {}) => {
    if (state === 'minimized') { await restore(); if (key && key !== current) go(key); return; }
    if (state === 'open') { if (key && key !== current) go(key); return; }
    const sameAsBefore = key === current && page.childElementCount;
    if (!sameAsBefore) await show(key, { animated: false });
    state = 'open'; everOpened = true;
    reveal();
    syncDock();
    syncUrl();
    moveIndicator(false);
    const start = compact.matches ? 'translateY(24px)' : fromRect(from);
    await play([{ transform: start, opacity: compact.matches ? 0 : .2 }, { transform: 'none', opacity: 1 }], { duration: compact.matches ? 240 : 340, easing: EASE_OUT });
    win.focus({ preventScroll: true });
    window.setTimeout(prefetchAll, 400);
  };

  const close = async () => {
    if (state === 'closed') return;
    const wasMinimized = state === 'minimized';
    if (body.classList.contains('is-zoomed')) setZoomed(false, false);
    state = 'closed';
    syncDock();
    syncUrl();
    if (!wasMinimized) {
      const done = await play([{ transform: 'none', opacity: 1 }, { transform: compact.matches ? 'translateY(24px)' : 'scale(.97)', opacity: 0 }], { duration: 190, easing: 'ease-in' });
      if (!done || state !== 'closed') return;
    }
    conceal();
    release();
    cleanup.forEach((fn) => fn()); cleanup = [];
  };

  const minimize = async () => {
    if (state !== 'open') return;
    if (compact.matches) { close(); return; }
    scrolls.set(current, scroller.scrollTop);
    state = 'minimized';
    syncDock();
    syncUrl();
    const done = await genie(1, 560);
    if (!done || state !== 'minimized') return;
    conceal();
    clearGenie();
    dockItem?.classList.remove('is-arriving'); void dockItem?.offsetWidth; dockItem?.classList.add('is-arriving');
  };

  const restore = async () => {
    if (state !== 'minimized') return;
    state = 'open';
    scroller.scrollTop = scrolls.get(current) || 0;
    syncDock();
    syncUrl();
    const unfold = genie(-1, 500);   // первый кадр (окно в точке Dock) ставится сразу, до показа
    reveal();
    await unfold;
    if (state === 'open') clearGenie();
    win.focus({ preventScroll: true });
  };

  const setZoomed = (value, animated = true) => {
    if (value === body.classList.contains('is-zoomed')) return;
    if (animated && !reduce.matches) { win.classList.add('is-resizing'); window.setTimeout(() => { win.classList.remove('is-resizing'); moveIndicator(false); }, 320); }
    body.classList.toggle('is-zoomed', value);
    zoomButton.setAttribute('aria-pressed', String(value));
    zoomButton.setAttribute('aria-label', value ? 'Вернуть обычный размер окна' : 'Развернуть окно');
    if (state !== 'closed') syncUrl();
  };

  // ---------- Кнопки окна ----------
  const plain = (event) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1);
  win.querySelectorAll('[data-win="close"]').forEach((el) => el.addEventListener('click', (event) => {
    if (!plain(event)) return;
    event.preventDefault();
    close();
  }));
  win.querySelector('[data-win="minimize"]').addEventListener('click', () => minimize());
  zoomButton.addEventListener('click', () => setZoomed(!body.classList.contains('is-zoomed')));
  toolbar.addEventListener('dblclick', (event) => { if (!event.target.closest('a, button')) setZoomed(!body.classList.contains('is-zoomed')); });

  [nav, menu].forEach((list) => list?.querySelectorAll('[data-section]').forEach((link) => link.addEventListener('click', (event) => {
    if (!plain(event)) return;
    event.preventDefault();
    setMenu(false);
    go(link.dataset.section);
  })));

  // Папки на рабочем столе открывают окно на месте
  document.querySelectorAll('[data-open-window]').forEach((folder) => folder.addEventListener('click', (event) => {
    if (!plain(event)) return;
    event.preventDefault();
    open(folder.dataset.openWindow, { from: folder.querySelector('.desktop-folder__icon') || folder });
  }));

  // ---------- Mobile: меню разделов в заголовке ----------
  function setMenu(value) {
    body.classList.toggle('is-menu-open', value);
    menuButton.setAttribute('aria-expanded', String(value));
  }
  menuButton.addEventListener('click', () => setMenu(!body.classList.contains('is-menu-open')));
  document.addEventListener('pointerdown', (event) => {
    if (!body.classList.contains('is-menu-open') || menu.contains(event.target) || menuButton.contains(event.target)) return;
    setMenu(false);
  });

  scroller.addEventListener('scroll', () => toolbar.classList.toggle('is-scrolled', scroller.scrollTop > 2), { passive: true });
  window.addEventListener('resize', () => moveIndicator(false));
  compact.addEventListener?.('change', () => { if (current) syncChrome(current, false); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (body.classList.contains('is-menu-open')) { setMenu(false); menuButton.focus(); return; }
    if (state === 'open' && body.classList.contains('is-zoomed') && !page.querySelector('dialog[open]')) setZoomed(false);
  });

  // ---------- Старт: состояние берётся из адреса ----------
  const params = new URLSearchParams(location.search);
  const startKey = [params.get('open'), params.get('min'), PRETTY ? keyFromPath(location.pathname) : null].find((key) => key && ROUTES[key]);
  if (params.get('zoom') === '1') body.classList.add('is-zoomed'), zoomButton.setAttribute('aria-pressed', 'true');
  syncDock(true);
  if (startKey && params.get('min') === startKey) {
    show(startKey, { animated: false }).then(() => { state = 'minimized'; syncDock(true); syncUrl(); });
  } else if (startKey) {
    open(startKey);
  } else {
    syncUrl();
  }
})();
