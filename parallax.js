/**
 * AROOSADAA — Parallax & Motion Engine
 * ──────────────────────────────────────────────────────────────
 * Drop this <script> tag just before </body> in index.html:
 *   <script src="parallax.js" defer></script>
 *
 * No dependencies. Vanilla JS only.
 * All scroll work runs inside one requestAnimationFrame loop
 * to avoid layout thrashing and keep the main thread free.
 * ──────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── CONFIG ──────────────────────────────────────────────── */
  /* Tweak these multipliers to taste.
     Lower = more subtle. Higher = more dramatic.            */
  const CFG = {
    heroBg:       0.35,   /* hero background shift factor     */
    heroBlob:     0.25,   /* floating blob shift factor       */
    portfolioImg: 0.15,   /* per-image shift (subtle)         */
    statsBg:      0.30,   /* stats section bg shift           */
    contactBg:    0.20,   /* contact section bg shift         */
    cardParallax: 0.08,   /* light card vertical shift scroll */
    mousePower:   18,     /* hero mouse parallax strength (px)*/
    isMobile:     window.innerWidth <= 768,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  /* ── CACHED DOM REFS ─────────────────────────────────────── */
  /* Queried once at init — avoids repeated DOM lookups on
     every scroll tick.                                       */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  let heroBg, blobA, blobB;
  let heroContent, heroMouseLayer;
  let portfolioImgs = [];
  let statsBg;
  let contactBg;
  let serviceCards = [];

  /* Tracks current scroll position — updated in rAF loop     */
  let scrollY = 0;
  let ticking = false;

  /* ── 1. HERO SECTION SETUP ───────────────────────────────── */
  function setupHero() {
    /* Find the hero section — common selectors for most sites */
    const heroSection = $('#hero') || $('.hero') || $$('section')[0];
    if (!heroSection) return;

    /* Inject background layer if there isn't one already */
    if (!heroSection.querySelector('.parallax-hero-bg')) {
      heroBg = document.createElement('div');
      heroBg.className = 'parallax-hero-bg';

      /* Copy the existing hero background onto the parallax div */
      const heroStyle = window.getComputedStyle(heroSection);
      const bg = heroStyle.backgroundImage;
      const bgColor = heroStyle.backgroundColor;
      heroBg.style.background = bg !== 'none' ? `${bg}, ${bgColor}` : bgColor;
      heroBg.style.backgroundSize = 'cover';
      heroBg.style.backgroundPosition = 'center';

      heroSection.prepend(heroBg);

      /* Remove the background from the section itself to avoid
         double-rendering — the layer handles it now           */
      heroSection.style.backgroundImage = 'none';
    } else {
      heroBg = heroSection.querySelector('.parallax-hero-bg');
    }

    /* Wrap existing hero content in a z-indexed div           */
    heroContent = heroSection.querySelector('.parallax-hero-content');
    if (!heroContent) {
      /* Grab all direct children that aren't the bg layer     */
      const children = [...heroSection.children].filter(
        el => !el.classList.contains('parallax-hero-bg') &&
              !el.classList.contains('parallax-blob')
      );
      heroContent = document.createElement('div');
      heroContent.className = 'parallax-hero-content';
      children.forEach(c => heroContent.appendChild(c));
      heroSection.appendChild(heroContent);
    }

    /* Inject floating blob shapes                             */
    if (!heroSection.querySelector('.parallax-blob--a')) {
      blobA = document.createElement('div');
      blobA.className = 'parallax-blob parallax-blob--a';
      blobB = document.createElement('div');
      blobB.className = 'parallax-blob parallax-blob--b';
      heroSection.appendChild(blobA);
      heroSection.appendChild(blobB);
    } else {
      blobA = heroSection.querySelector('.parallax-blob--a');
      blobB = heroSection.querySelector('.parallax-blob--b');
    }

    /* Mouse-parallax: listen on hero section for mouse move   */
    if (!CFG.isMobile && !CFG.reduceMotion) {
      heroSection.addEventListener('mousemove', onHeroMouseMove, { passive: true });
      heroSection.addEventListener('mouseleave', onHeroMouseLeave, { passive: true });
    }
  }

  /* ── 2. PORTFOLIO IMAGES SETUP ───────────────────────────── */
  function setupPortfolio() {
    /* Find gallery images — wrap each in an overflow container */
    const gallery = $('#gallery') || $('.gallery') || $$('[class*="gallery"]')[0];
    if (!gallery) return;

    const imgs = $$('img', gallery);
    imgs.forEach(img => {
      if (img.closest('.parallax-img-wrapper')) return; /* already wrapped */

      const wrapper = document.createElement('div');
      wrapper.className = 'parallax-img-wrapper';

      /* Copy the original display/size of the image           */
      const parent = img.parentElement;
      parent.insertBefore(wrapper, img);
      wrapper.appendChild(img);

      img.classList.add('parallax-img');

      /* Give each image a slightly different parallax speed   */
      const speedVariance = 0.05 + Math.random() * 0.1; /* 0.05–0.15 */
      img.dataset.parallaxSpeed = speedVariance;
    });

    portfolioImgs = $$('.parallax-img');

    /* Hover tilt effect using mouse position within the card  */
    $$('.parallax-img-wrapper').forEach(wrapper => {
      wrapper.addEventListener('mousemove', onImgTilt, { passive: true });
      wrapper.addEventListener('mouseleave', onImgTiltEnd, { passive: true });
    });
  }

  /* ── 3. STATS SECTION SETUP ──────────────────────────────── */
  function setupStats() {
    const statsSection = $('#stats') || $$('[class*="stats"]')[0];
    if (!statsSection) return;

    /* Background parallax layer                               */
    if (!statsSection.querySelector('.parallax-stats-bg')) {
      statsBg = document.createElement('div');
      statsBg.className = 'parallax-stats-bg';
      const bg = window.getComputedStyle(statsSection).backgroundImage;
      const bgColor = window.getComputedStyle(statsSection).backgroundColor;
      statsBg.style.background = bg !== 'none' ? `${bg}, ${bgColor}` : bgColor;
      statsBg.style.backgroundSize = 'cover';
      statsSection.prepend(statsBg);
      statsSection.style.backgroundImage = 'none';
    } else {
      statsBg = statsSection.querySelector('.parallax-stats-bg');
    }

    /* Wrap content above bg layer                             */
    if (!statsSection.querySelector('.stats-content')) {
      const content = document.createElement('div');
      content.className = 'stats-content';
      [...statsSection.children]
        .filter(c => !c.classList.contains('parallax-stats-bg'))
        .forEach(c => content.appendChild(c));
      statsSection.appendChild(content);
    }

    /* Number counter animation via IntersectionObserver       */
    $$('[class*="stat"] [class*="number"], [class*="counter"], [class*="count"]',
       statsSection
    ).forEach(el => {
      const raw = el.textContent.replace(/[^0-9.]/g, '');
      if (!raw) return;
      el.dataset.target = raw;
      el.dataset.suffix = el.textContent.replace(raw, '');
      el.textContent = '0' + el.dataset.suffix;
      el.classList.add('stat-number');
    });
  }

  /* ── 4. CONTACT SECTION SETUP ───────────────────────────── */
  function setupContact() {
    const contactSection = $('#contact') || $$('[class*="contact"]')[0];
    if (!contactSection) return;

    if (!contactSection.querySelector('.parallax-contact-bg')) {
      contactBg = document.createElement('div');
      contactBg.className = 'parallax-contact-bg';
      contactSection.prepend(contactBg);
    } else {
      contactBg = contactSection.querySelector('.parallax-contact-bg');
    }

    if (!contactSection.querySelector('.contact-content')) {
      const content = document.createElement('div');
      content.className = 'contact-content';
      [...contactSection.children]
        .filter(c => !c.classList.contains('parallax-contact-bg'))
        .forEach(c => content.appendChild(c));
      contactSection.appendChild(content);
    }
  }

  /* ── 5. SERVICE CARDS SETUP ──────────────────────────────── */
  function setupServiceCards() {
    const servicesSection = $('#services') || $$('[class*="services"]')[0];
    if (!servicesSection) return;

    /* Target card-like children — common class patterns       */
    serviceCards = $$(
      '[class*="card"], [class*="service-item"], [class*="service_item"]',
      servicesSection
    );
    serviceCards.forEach((card, i) => {
      card.classList.add('parallax-card', 'scroll-reveal');
      /* Stagger each card by 0.1s                             */
      card.style.setProperty('--delay', `${i * 0.1}s`);
    });
  }

  /* ── 6. SCROLL-REVEAL SETUP ──────────────────────────────── */
  function setupScrollReveal() {
    /* Apply scroll-reveal to sections and key elements        */
    const revealTargets = $$(
      'section > *, [class*="section"] > *, ' +
      'h1, h2, h3, p, [class*="card"], img, ' +
      '[class*="about"] *, [class*="gallery"] > *'
    );

    revealTargets.forEach(el => {
      /* Don't double-add or touch the bg/blob helpers         */
      if (
        el.classList.contains('parallax-hero-bg') ||
        el.classList.contains('parallax-blob') ||
        el.classList.contains('parallax-stats-bg') ||
        el.classList.contains('parallax-contact-bg') ||
        el.classList.contains('scroll-reveal')
      ) return;
      el.classList.add('scroll-reveal');
    });
  }

  /* ── 7. INTERSECTION OBSERVER ───────────────────────────── */
  /* Watches all .scroll-reveal elements and adds .is-visible
     when they enter the viewport.                            */
  function setupObserver() {
    if (!('IntersectionObserver' in window)) {
      /* Fallback: just show everything                        */
      $$('.scroll-reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            /* Once revealed, unobserve — no need to track further */
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,    /* trigger when 12% of element is visible */
        rootMargin: '0px 0px -40px 0px', /* slightly below viewport edge */
      }
    );

    $$('.scroll-reveal').forEach(el => observer.observe(el));

    /* Separate observer for stat counters                     */
    const counterObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    $$('.stat-number').forEach(el => counterObserver.observe(el));
  }

  /* ── 8. COUNTER ANIMATION ────────────────────────────────── */
  /* Counts from 0 to the target number over ~1.5s             */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const duration = 1500; /* ms */
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      /* Ease-out: fast start, slow finish                     */
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      /* Format: integer if target is integer, else 1 decimal  */
      el.textContent = (Number.isInteger(target)
        ? Math.round(current)
        : current.toFixed(1)
      ) + suffix;

      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  /* ── 9. SCROLL HANDLER (rAF-throttled) ──────────────────── */
  function onScroll() {
    scrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  /* ── 10. MAIN PARALLAX UPDATE ────────────────────────────── */
  /* This runs every animation frame while the user is
     scrolling. All transforms are applied here in one batch
     to minimise layout recalculations.                       */
  function updateParallax() {
    ticking = false;

    if (CFG.isMobile || CFG.reduceMotion) return;

    /* Hero background — shifts up slower than scroll           */
    if (heroBg) {
      const shift = scrollY * CFG.heroBg;
      heroBg.style.transform = `translateY(${shift}px)`;
    }

    /* Blobs — drift at different rates                         */
    if (blobA) {
      const shift = scrollY * CFG.heroBlob;
      blobA.style.transform = `translateY(${shift}px)`;
    }
    if (blobB) {
      const shift = scrollY * (CFG.heroBlob * 0.7);
      blobB.style.transform = `translateY(${-shift}px)`; /* opposite direction */
    }

    /* Portfolio images — each moves at its own speed          */
    portfolioImgs.forEach(img => {
      const speed = parseFloat(img.dataset.parallaxSpeed) || CFG.portfolioImg;
      const rect = img.closest('.parallax-img-wrapper').getBoundingClientRect();
      /* Only apply when image is near the viewport            */
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const offset = (elementCenter - viewportCenter) * speed;
      img.style.transform = `translateY(${offset}px)`;
    });

    /* Stats background                                         */
    if (statsBg) {
      const rect = statsBg.closest('section, [class*="stats"]')
                         ?.getBoundingClientRect();
      if (rect) {
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2)
                       * CFG.statsBg;
        statsBg.style.transform = `translateY(${offset * 0.5}px)`;
      }
    }

    /* Contact background                                       */
    if (contactBg) {
      const rect = contactBg.closest('section, [class*="contact"]')
                            ?.getBoundingClientRect();
      if (rect) {
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2)
                       * CFG.contactBg;
        contactBg.style.transform = `translateY(${offset * 0.4}px)`;
      }
    }

    /* Service cards — subtle scroll-based vertical offset      */
    serviceCards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
      /* Alternate even/odd cards in opposite directions        */
      const dir = i % 2 === 0 ? 1 : -1;
      const offset = (rect.top - window.innerHeight / 2) * CFG.cardParallax * dir;
      /* Only apply when NOT hovered (hover has its own transform) */
      if (!card.matches(':hover')) {
        card.style.transform = `translateY(${offset}px)`;
      }
    });
  }

  /* ── 11. MOUSE PARALLAX (Hero) ───────────────────────────── */
  let mouseX = 0, mouseY = 0;
  let heroRect = null;

  function onHeroMouseMove(e) {
    const heroSection = e.currentTarget;
    if (!heroRect) heroRect = heroSection.getBoundingClientRect();

    /* Normalise to –1 → +1 relative to hero center           */
    const nx = (e.clientX - heroRect.left - heroRect.width / 2) / (heroRect.width / 2);
    const ny = (e.clientY - heroRect.top - heroRect.height / 2) / (heroRect.height / 2);

    mouseX = nx * CFG.mousePower;
    mouseY = ny * CFG.mousePower;

    requestAnimationFrame(() => {
      if (heroContent) {
        heroContent.style.transform =
          `translate(${mouseX * 0.4}px, ${mouseY * 0.4}px)`;
      }
      if (blobA) {
        blobA.style.transform =
          `translate(${mouseX * 0.8}px, ${mouseY * 0.8}px)`;
      }
      if (blobB) {
        blobB.style.transform =
          `translate(${-mouseX * 0.6}px, ${-mouseY * 0.6}px)`;
      }
    });
  }

  function onHeroMouseLeave() {
    mouseX = 0;
    mouseY = 0;
    if (heroContent) {
      heroContent.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      heroContent.style.transform = 'translate(0, 0)';
      setTimeout(() => { heroContent.style.transition = ''; }, 600);
    }
    if (blobA) {
      blobA.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
      blobA.style.transform = 'translateY(0)';
      setTimeout(() => { blobA.style.transition = ''; }, 800);
    }
    if (blobB) {
      blobB.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
      blobB.style.transform = 'translateY(0)';
      setTimeout(() => { blobB.style.transition = ''; }, 800);
    }
    heroRect = null; /* invalidate cache — section may have reflowed */
  }

  /* ── 12. IMAGE TILT (Portfolio hover) ───────────────────── */
  function onImgTilt(e) {
    if (CFG.isMobile) return;
    const wrapper = e.currentTarget;
    const rect = wrapper.getBoundingClientRect();
    const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const img = wrapper.querySelector('.parallax-img');
    if (img) {
      img.style.transition = 'transform 0.15s ease-out';
      img.style.transform = `scale(1.06) translate(${nx * 8}px, ${ny * 8}px)`;
    }
  }

  function onImgTiltEnd(e) {
    const img = e.currentTarget.querySelector('.parallax-img');
    if (img) {
      img.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      img.style.transform = '';
    }
  }

  /* ── 13. RESIZE HANDLER ──────────────────────────────────── */
  function onResize() {
    CFG.isMobile = window.innerWidth <= 768;
    heroRect = null; /* invalidate cached rect */
  }

  /* ── 14. INIT ────────────────────────────────────────────── */
  function init() {
    if (CFG.reduceMotion) {
      /* Still run scroll-reveal (it's just opacity + tiny Y) — but
         skip all motion-heavy parallax setup.               */
      setupScrollReveal();
      setupObserver();
      return;
    }

    setupHero();
    setupPortfolio();
    setupStats();
    setupContact();
    setupServiceCards();
    setupScrollReveal();
    setupObserver();

    /* Event listeners                                         */
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    /* Run once on load to set initial positions               */
    updateParallax();
  }

  /* Wait for DOM to be ready                                  */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
