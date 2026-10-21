/* ==========================================================
   main.js — Portfolio interactions (vanilla JavaScript)
   1. Scroll-spy navbar          5. Settings sidebar (colors + fonts)
   2. Dark / Light mode switch   6. Scroll to top
   3. Portfolio Navs & Tabs      7. Mobile menu
   4. Testimonials carousel
   ========================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- tiny helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function store(key, val) {
    try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (e) {}
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /* ==========================================================
     1) SCROLL SPY — active link follows the visible section
     ========================================================== */
  (function scrollSpy() {
    var links = $$('#header .nav-links a[href^="#"]');
    var items = links
      .map(function (a) { return { link: a, section: $(a.getAttribute("href")) }; })
      .filter(function (i) { return i.section; });
    if (!items.length) return;

    var ticking = false;

    function setActive(current) {
      items.forEach(function (i) {
        var on = i === current;
        i.link.classList.toggle("active", on);
        if (on) i.link.setAttribute("aria-current", "page");
        else i.link.removeAttribute("aria-current");
      });
    }

    function update() {
      ticking = false;
      var navH = $("#header") ? $("#header").offsetHeight : 80;
      var probe = window.scrollY + navH + 40; // a line just below the navbar
      var current = items[0];

      items.forEach(function (i) {
        if (i.section.offsetTop <= probe) current = i;
      });

      // Reached the bottom of the page → last section
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = items[items.length - 1];

      setActive(current);
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  })();

  /* ==========================================================
     2) DARK / LIGHT MODE — add / remove the "dark" class on <html>
     ========================================================== */
  (function themeSwitch() {
    var btn = $("#theme-toggle-button");
    if (!btn) return;

    function render() {
      var isDark = root.classList.contains("dark");
      btn.setAttribute("aria-pressed", String(isDark));
      btn.setAttribute("aria-label", isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن");
    }

    btn.addEventListener("click", function () {
      var isDark = root.classList.toggle("dark"); // add → dark | remove → light
      store("theme", isDark ? "dark" : "light");
      render();
    });

    render();
  })();

  /* ==========================================================
     3) PORTFOLIO — Navs & Tabs (no Bootstrap)
     ========================================================== */
  (function portfolioTabs() {
    var tabs = $$("#portfolio-filters .portfolio-filter");
    var cards = $$("#portfolio-grid .portfolio-item");
    if (!tabs.length || !cards.length) return;

    // Reuse the exact class sets already written in the HTML
    var ACTIVE = tabs[0].className;
    var INACTIVE = tabs[1] ? tabs[1].className : tabs[0].className;

    function show(filter) {
      cards.forEach(function (card) {
        var match = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("hidden", !match);
        card.classList.remove("is-entering");
        if (match && !reduceMotion) {
          void card.offsetWidth; // restart the animation
          card.classList.add("is-entering");
        }
      });
    }

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.className = on ? ACTIVE : INACTIVE;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      show(tab.dataset.filter);
    }

    tabs.forEach(function (tab, idx) {
      tab.addEventListener("click", function () { select(tab); });

      // Keyboard support: arrows / Home / End (RTL aware)
      tab.addEventListener("keydown", function (e) {
        var rtl = getComputedStyle(root).direction === "rtl";
        var next = null;
        if (e.key === "ArrowRight") next = rtl ? idx - 1 : idx + 1;
        else if (e.key === "ArrowLeft") next = rtl ? idx + 1 : idx - 1;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next === null) return;
        e.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], true);
      });
    });

    var initial = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0];
    select(initial);
  })();

  /* ==========================================================
     4) TESTIMONIALS — carousel / slider
        • 1 / 2 / 3 cards per view (mobile / tablet / desktop)
        • prev & next buttons, dots, autoplay, swipe, loop
     ========================================================== */
  (function testimonials() {
    var track = $("#testimonials-carousel");
    var cards = $$(".testimonial-card", track || document);
    var nextBtn = $("#next-testimonial");
    var prevBtn = $("#prev-testimonial");
    var firstDot = $(".carousel-indicator");
    if (!track || !cards.length || !firstDot) return;

    var dotsWrap = firstDot.parentNode;
    var DOT_ON = "carousel-indicator w-3 h-3 rounded-full bg-accent transition-all duration-300 hover:scale-125 cursor-pointer";
    var DOT_OFF = "carousel-indicator w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-600 transition-all duration-300 hover:scale-125 cursor-pointer";

    var index = 0;
    var perView = 1;
    var maxIndex = 0;
    var timer = null;
    var AUTOPLAY_MS = 5000;

    function getPerView() {
      var w = window.innerWidth;
      if (w >= 1024) return 3; // lg:w-1/3
      if (w >= 640) return 2;  // sm:w-1/2
      return 1;
    }

    // RTL: the first card sits on the right, so moving forward = +X
    function dir() { return getComputedStyle(root).direction === "rtl" ? 1 : -1; }
    function cardWidth() { return cards[0].getBoundingClientRect().width; }

    function buildDots() {
      dotsWrap.innerHTML = "";
      for (var i = 0; i <= maxIndex; i++) {
        var d = document.createElement("button");
        d.type = "button";
        d.className = DOT_OFF;
        d.dataset.index = i;
        d.setAttribute("role", "tab");
        d.setAttribute("aria-label", "التوصية " + (i + 1));
        d.addEventListener("click", function () {
          goTo(Number(this.dataset.index));
          restart();
        });
        dotsWrap.appendChild(d);
      }
    }

    function paintDots() {
      $$(".carousel-indicator", dotsWrap).forEach(function (d, i) {
        var on = i === index;
        d.className = on ? DOT_ON : DOT_OFF;
        d.setAttribute("aria-selected", String(on));
      });
    }

    function render(animate) {
      track.classList.toggle("is-dragging", animate === false);
      track.style.transform = "translateX(" + dir() * index * cardWidth() + "px)";
      paintDots();
    }

    function goTo(i) {
      if (i > maxIndex) i = 0;           // loop forward
      else if (i < 0) i = maxIndex;      // loop backward
      index = i;
      render();
    }

    function layout() {
      perView = getPerView();
      maxIndex = Math.max(0, cards.length - perView);
      if (index > maxIndex) index = maxIndex;
      buildDots();
      render(false);
    }

    /* autoplay */
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      if (reduceMotion || timer || maxIndex === 0) return;
      timer = setInterval(function () { goTo(index + 1); }, AUTOPLAY_MS);
    }
    function restart() { stop(); start(); }

    /* buttons — "next" is on the left side in RTL */
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(index + 1); restart(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(index - 1); restart(); });

    /* pause on hover / focus / hidden tab */
    var viewport = track.parentNode;
    viewport.addEventListener("mouseenter", stop);
    viewport.addEventListener("mouseleave", start);
    viewport.addEventListener("focusin", stop);
    viewport.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });

    /* keyboard */
    viewport.addEventListener("keydown", function (e) {
      var d = dir();
      if (e.key === "ArrowRight") { goTo(index + (d === 1 ? -1 : 1)); restart(); }
      if (e.key === "ArrowLeft") { goTo(index + (d === 1 ? 1 : -1)); restart(); }
    });

    /* swipe / drag */
    var startX = 0, dx = 0, dragging = false;
    viewport.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true; startX = e.clientX; dx = 0;
      track.classList.add("is-dragging");
      stop();
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      track.style.transform = "translateX(" + (dir() * index * cardWidth() + dx) + "px)";
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-dragging");
      var moved = dx * dir(); // positive = same direction as "next"
      if (moved > 50) goTo(index + 1);
      else if (moved < -50) goTo(index - 1);
      else render();
      start();
    }
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("pointerleave", endDrag);

    var resizeT;
    window.addEventListener("resize", function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(layout, 120);
    });

    viewport.tabIndex = 0;
    viewport.setAttribute("aria-roledescription", "carousel");
    layout();
    start();
  })();

  /* ==========================================================
     5) SETTINGS SIDEBAR — theme colors + fonts
     ========================================================== */
  (function settings() {
    var toggle = $("#settings-toggle");
    var sidebar = $("#settings-sidebar");
    var closeBtn = $("#close-settings");
    var resetBtn = $("#reset-settings");
    var grid = $("#theme-colors-grid");
    var fontBtns = $$(".font-option");
    if (!toggle || !sidebar) return;

    /* ---- palettes ---- */
    var COLORS = [
      { id: "indigo",  name: "نيلي",     primary: "#6366f1", secondary: "#8b5cf6", accent: "#a855f7" },
      { id: "emerald", name: "زمردي",    primary: "#10b981", secondary: "#14b8a6", accent: "#06b6d4" },
      { id: "rose",    name: "وردي",     primary: "#f43f5e", secondary: "#ec4899", accent: "#fb7185" },
      { id: "amber",   name: "كهرماني",  primary: "#f59e0b", secondary: "#f97316", accent: "#facc15" },
      { id: "sky",     name: "سماوي",    primary: "#0ea5e9", secondary: "#3b82f6", accent: "#22d3ee" },
      { id: "fuchsia", name: "فوشيا",    primary: "#d946ef", secondary: "#a855f7", accent: "#ec4899" },
      { id: "teal",    name: "فيروزي",   primary: "#14b8a6", secondary: "#0ea5e9", accent: "#2dd4bf" },
      { id: "orange",  name: "برتقالي",  primary: "#f97316", secondary: "#ef4444", accent: "#fb923c" }
    ];
    var FONTS = ["alexandria", "tajawal", "cairo"];
    var DEFAULT_COLOR = "indigo";
    var DEFAULT_FONT = "tajawal";

    /* ---- build swatches ---- */
    grid.setAttribute("role", "radiogroup");
    COLORS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "color-swatch";
      b.dataset.color = c.id;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", c.name);
      b.title = c.name;
      b.style.background = "linear-gradient(135deg," + c.primary + "," + c.accent + ")";
      b.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
      b.addEventListener("click", function () { applyColor(c.id, true); });
      grid.appendChild(b);
    });

    function applyColor(id, save) {
      var c = COLORS.filter(function (x) { return x.id === id; })[0] || COLORS[0];
      root.style.setProperty("--color-primary", c.primary);
      root.style.setProperty("--color-secondary", c.secondary);
      root.style.setProperty("--color-accent", c.accent);
      var meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", c.primary);
      $$(".color-swatch", grid).forEach(function (s) {
        var on = s.dataset.color === c.id;
        s.classList.toggle("active", on);
        s.setAttribute("aria-checked", String(on));
      });
      if (save) store("themeColor", c.id);
    }

    function applyFont(id, save) {
      if (FONTS.indexOf(id) === -1) id = DEFAULT_FONT;
      FONTS.forEach(function (f) { body.classList.remove("font-" + f); });
      body.classList.add("font-" + id);
      fontBtns.forEach(function (b) {
        var on = b.dataset.font === id;
        b.classList.toggle("active", on);
        b.setAttribute("aria-checked", String(on));
      });
      if (save) store("themeFont", id);
    }

    fontBtns.forEach(function (b) {
      b.addEventListener("click", function () { applyFont(b.dataset.font, true); });
    });

    /* ---- open / close ---- */
    var backdrop = document.createElement("div");
    backdrop.id = "settings-backdrop";
    body.appendChild(backdrop);

    function open() {
      sidebar.classList.remove("translate-x-full");
      sidebar.classList.add("is-open");
      backdrop.classList.add("is-open");
      body.classList.add("settings-open");
      sidebar.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      sidebar.classList.add("translate-x-full");
      sidebar.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      body.classList.remove("settings-open");
      sidebar.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }

    toggle.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("is-open")) close();
    });

    /* ---- reset ---- */
    if (resetBtn) resetBtn.addEventListener("click", function () {
      store("themeColor", null);
      store("themeFont", null);
      applyColor(DEFAULT_COLOR, false);
      applyFont(DEFAULT_FONT, false);
    });

    /* ---- restore saved choices ---- */
    applyColor(read("themeColor") || DEFAULT_COLOR, false);
    applyFont(read("themeFont") || DEFAULT_FONT, false);
  })();

  /* ==========================================================
     6) SCROLL TO TOP
     ========================================================== */
  (function scrollTop() {
    var btn = $("#scroll-to-top");
    if (!btn) return;
    var SHOW_AFTER = 300;
    var ticking = false;

    function update() {
      ticking = false;
      var show = window.scrollY > SHOW_AFTER;
      btn.classList.toggle("opacity-0", !show);
      btn.classList.toggle("invisible", !show);
      btn.classList.toggle("opacity-100", show);
      btn.classList.toggle("visible", show);
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });

    update();
  })();

  /* ==========================================================
     7) MOBILE MENU (the nav collapses under 1024px)
     ========================================================== */
  (function mobileMenu() {
    var btn = $("#mobile-menu-btn");
    var menu = $("#nav-links");
    if (!btn || !menu) return;
    var icon = $("i", btn);

    function set(openIt) {
      menu.classList.toggle("active", openIt);
      btn.setAttribute("aria-expanded", String(openIt));
      btn.setAttribute("aria-label", openIt ? "إغلاق القائمة" : "فتح القائمة");
      if (icon) {
        icon.classList.toggle("fa-bars", !openIt);
        icon.classList.toggle("fa-xmark", openIt);
      }
    }

    btn.addEventListener("click", function () { set(!menu.classList.contains("active")); });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { set(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 1024) set(false); });
  })();
})();
