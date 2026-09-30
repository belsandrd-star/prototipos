/* Carrinho — abrir/fechar, estado vazio, adicionar item (toast + highlight).
   Atalho: ?cart=open abre a página já com o carrinho aberto. */
(function () {
  const cart = document.getElementById('cart');
  const overlay = document.querySelector('.cart-overlay');
  const list = cart.querySelector('.cart__items');
  const scroller = cart.querySelector('.cart__scroll');
  const toast = cart.querySelector('.toast');
  const emptyState = cart.querySelector('[data-cart-empty]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TOAST_DURATION = 2500;   // tempo visível do toast (ms)
  const TOAST_EXIT = 200;        // duração da saída (ms)
  let lastFocus = null;
  let toastTimer = null;

  /* ---------- abrir / fechar ---------- */
  function openCart(trigger) {
    lastFocus = trigger || document.activeElement;
    cart.hidden = false;
    overlay.hidden = false;
    document.body.classList.add('is-locked');
    cart.querySelector('[data-cart-close]').focus({ preventScroll: true });
  }

  function closeCart() {
    cart.hidden = true;
    overlay.hidden = true;
    document.body.classList.remove('is-locked');
    hideToast(true);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- toast ---------- */
  // variant: 'success' (verde, check) | 'removed' (vermelho, X)
  function showToast(message, variant = 'success') {
    clearTimeout(toastTimer);
    toast.querySelector('.toast__text').textContent = message;
    toast.classList.toggle('toast--removed', variant === 'removed');
    toast.querySelector('.toast__icon').setAttribute('href', variant === 'removed' ? '#i-close' : '#i-check-circle');
    toast.hidden = false;
    toast.classList.remove('is-visible', 'is-leaving');
    void toast.offsetWidth;                 // reinicia a transição se já estiver na tela
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => hideToast(), TOAST_DURATION);
  }

  function hideToast(immediate) {
    clearTimeout(toastTimer);
    if (immediate) { toast.classList.remove('is-visible', 'is-leaving'); toast.hidden = true; return; }
    toast.classList.add('is-leaving');
    toast.classList.remove('is-visible');
    toastTimer = setTimeout(() => { toast.hidden = true; toast.classList.remove('is-leaving'); }, TOAST_EXIT);
  }

  /* ---------- highlight ---------- */
  function highlight(item) {
    item.classList.remove('is-highlighted');
    void item.offsetWidth;
    item.classList.add('is-highlighted');
    item.addEventListener('animationend', function done(e) {
      if (e.pseudoElement === '::before' || e.animationName.startsWith('cart-item-highlight')) {
        item.classList.remove('is-highlighted', 'is-new');
        item.removeEventListener('animationend', done);
      }
    });
  }

  /* ---------- adicionar item ---------- */
  function buildItem(plan) {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.dataset.planId = plan.id;
    li.innerHTML = `
      <div class="cart-item__head">
        <span class="icon-tile"><svg class="icon icon--24"><use href="#${plan.icon}"/></svg></span>
        <h3></h3>
        <button class="btn-remove" type="button"><svg class="icon icon--16"><use href="#i-trash"/></svg></button>
      </div>
      ${plan.benefits ? `<div class="cart-item__benefits">
        <span class="cart-item__label">Benefícios gratuitos inclusos</span>
        <span class="partner-stack"><span class="partner partner--a">A</span><span class="partner partner--b">B</span><span class="partner partner--c">C</span><span class="partner partner--more"><svg class="icon icon--16"><use href="#i-plus"/></svg></span></span>
      </div>` : ''}
      <p class="cart-item__price"><b></b><span>/mês</span></p>`;
    li.querySelector('h3').textContent = plan.name;
    li.querySelector('.cart-item__price b').textContent = plan.price;
    li.querySelector('.btn-remove').setAttribute('aria-label', 'Remover ' + plan.name);
    return li;
  }

  /* ---------- vazio ⇄ com itens ---------- */
  const isEmpty = () => cart.classList.contains('is-empty');

  // Troca instantânea (carrinho fechado) ou animada (carrinho aberto).
  function leaveEmptyState(animated) {
    if (!isEmpty()) return Promise.resolve();
    if (!animated || reduceMotion.matches) { cart.classList.remove('is-empty'); return Promise.resolve(); }
    const from = emptyState.offsetHeight + parseFloat(getComputedStyle(emptyState).marginTop);
    emptyState.classList.add('is-leaving');
    return new Promise(resolve => {
      emptyState.addEventListener('animationend', () => {
        emptyState.classList.remove('is-leaving');
        cart.classList.remove('is-empty');
        const to = list.offsetHeight;
        list.animate([{ height: from + 'px', overflow: 'hidden' }, { height: to + 'px', overflow: 'hidden' }],
                     { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
        resolve();
      }, { once: true });
    });
  }

  /* ---------- adicionar item ---------- */
  function addToCart(source, trigger) {
    const plan = {
      id: source.dataset.planId, name: source.dataset.planName,
      price: source.dataset.planPrice, icon: source.dataset.planIcon || 'i-wifi',
      benefits: source.dataset.planBenefits !== 'false'
    };
    let item = list.querySelector(`[data-plan-id="${plan.id}"]`);
    const alreadyIn = !!item;
    const wasOpen = !cart.hidden;

    if (!wasOpen) openCart(trigger);
    scroller.scrollTo({ top: 0, behavior: wasOpen && !reduceMotion.matches ? 'smooth' : 'auto' });

    const insert = alreadyIn ? Promise.resolve() : (() => {
      item = buildItem(plan);
      const wasEmpty = isEmpty();
      return leaveEmptyState(wasOpen).then(() => {
        list.prepend(item);
        item.classList.add('is-new');
        if (wasEmpty && wasOpen && !reduceMotion.matches) item.style.animationDelay = '60ms';
      });
    })();

    insert.then(() => {
      highlight(item);
      showToast(alreadyIn ? 'Já está no seu carrinho' : 'Adicionado ao carrinho!');
    });
  }

  /* ---------- remover item ----------
     1. item sai: fade + desliza 16px p/ direita · 160ms ease-in
     2. espaço fecha: altura → 0 · 220ms ease-out
     3. toast vermelho "Removido do carrinho"
     Se era o último item, o bloco vazio volta (fade + escala .96→1 · 280ms). */
  function removeFromCart(item) {
    const siblings = [...list.children];
    const next = siblings[siblings.indexOf(item) + 1] || siblings[siblings.indexOf(item) - 1];
    const isLast = siblings.length === 1;
    const name = item.querySelector('h3').textContent;
    item.querySelector('.btn-remove').disabled = true;

    const finish = () => {
      item.remove();
      if (isLast) {
        cart.classList.add('is-empty');
        if (!reduceMotion.matches) {
          emptyState.classList.add('is-entering');
          emptyState.addEventListener('animationend', () => emptyState.classList.remove('is-entering'), { once: true });
        }
      }
      // foco vai para o próximo item (ou para o fechar, se o carrinho ficou vazio)
      const focusTarget = next && next.isConnected ? next.querySelector('.btn-remove') : cart.querySelector('[data-cart-close]');
      focusTarget.focus({ preventScroll: true });
      showToast('Removido do carrinho', 'removed');
    };

    if (reduceMotion.matches) { finish(); return; }

    const h = item.offsetHeight;
    const cs = getComputedStyle(item);
    item.style.overflow = 'hidden';
    item.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(16px)' }],
                 { duration: 160, easing: 'cubic-bezier(0.3, 0, 1, 1)', fill: 'forwards' })
      .finished.then(() => item.animate([
          { height: h + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth },
          { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px' }
        ], { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' }).finished)
      .then(finish);
  }

  list.addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove');
    if (btn) removeFromCart(btn.closest('.cart-item'));
  });

  /* ---------- eventos ---------- */
  document.querySelectorAll('[data-cart-open]').forEach(el => el.addEventListener('click', () => openCart(el)));
  document.querySelectorAll('[data-add-to-cart]').forEach(el =>
    el.addEventListener('click', () => addToCart(el.closest('[data-plan-id]'), el)));
  document.querySelectorAll('[data-cart-close]').forEach(el => el.addEventListener('click', closeCart));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !cart.hidden) closeCart(); });

  /* ---------- header da vitrine: sombra ao rolar ---------- */
  const siteHeader = document.querySelector('.site-header');
  const onScroll = () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 0);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (new URLSearchParams(location.search).get('cart') === 'open') openCart();
})();
