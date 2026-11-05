/* =========================================================
   Análise de crédito — protótipo navegável
   Fluxo espelha o Figma (EUNCP-10886). Respostas da API são
   simuladas pelo painel "Cenários".
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const overlay = $('#overlay');
  const sheet = $('#sheet');
  const checkout = $('#checkout');
  const result = $('#result');
  const resultCard = $('#result-card');
  const loading = $('#global-loading');

  const BUYER_CPF = '11144477735'; // CPF fictício do comprador
  const DELAY = 1200;
  let lastFocus = null;

  /* ---------- Cenários ---------- */
  const scenario = () => ({
    credito: $('input[name="credito"]:checked').value,
    base: $('input[name="base"]:checked').value,
    bvc: $('input[name="bvc"]:checked').value,
    novo: $('input[name="novo"]:checked').value,
  });
  // Permite abrir já configurado: ?credito=aprovado&base=sim&bvc=falha&novo=sim
  const params = new URLSearchParams(location.search);
  ['credito', 'base', 'bvc', 'novo'].forEach((k) => {
    const v = params.get(k);
    const el = v && $(`input[name="${k}"][value="${v}"]`);
    if (el) el.checked = true;
  });

  /* ---------- Utilidades ---------- */
  const digits = (v) => v.replace(/\D/g, '');
  const maskCpf = (v) => {
    const d = digits(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };
  const maskPhone = (v) => {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const maskDate = (v) => {
    const d = digits(v).slice(0, 8);
    return d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2');
  };
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const field = ({ id, label, type = 'text', mode, value = '', readonly = false, autocomplete = 'off' }) => `
    <label class="field ${value ? 'is-filled' : ''} ${readonly ? 'is-readonly' : ''}" for="${id}">
      <span class="field__label">${label}</span>
      <input id="${id}" type="${type}" ${mode ? `inputmode="${mode}"` : ''} value="${value}" ${readonly ? 'readonly' : ''} autocomplete="${autocomplete}" aria-describedby="${id}-err">
    </label>
    <p class="field-error" id="${id}-err" role="alert" hidden></p>`;

  const header = (title, sub) => `
    <div class="sheet__header">
      <h2 class="sheet__title" id="sheet-title">${title}</h2>
      <hr class="sheet__divider">
      <p class="sheet__subtitle">${sub}</p>
    </div>`;

  const footer = (primaryLabel, { disabled = true, secondary = 'Prefiro não continuar', secondaryAction = 'desistir' } = {}) => `
    <div class="sheet__footer">
      <button class="btn btn--primary btn--block" type="button" data-action="primary" ${disabled ? 'disabled' : ''}>${primaryLabel}</button>
      <button class="link-btn" type="button" data-action="${secondaryAction}">${secondary}</button>
    </div>`;

  /* ---------- Telas (bottom sheet / modal) ---------- */
  const screens = {
    // 1 · 2 · 2.1 — informar CPF do novo titular
    cpf: () => `
      <div class="sheet__content">
        ${header('Não foi possível aprovar o pedido neste CPF', 'Você pode seguir com o pedido no nome de outra pessoa. O contrato e as faturas ficam no nome dela, então ela precisa estar de acordo.')}
        <div class="sheet__body">${field({ id: 'cpf', label: 'CPF de quem será o titular', mode: 'numeric' })}</div>
      </div>
      ${footer('Continuar')}`,

    // 4 — segunda solicitação
    segunda: () => `
      <div class="sheet__content">
        ${header('Não foi possível seguir com este CPF', 'Você pode tentar com o CPF de outra pessoa. Esta é a última tentativa.')}
        <div class="sheet__body">
          <div class="alert" role="alert"><svg class="ico" aria-hidden="true"><use href="#i-error"/></svg> Este CPF também não foi aprovado.</div>
          ${field({ id: 'cpf', label: 'CPF de quem será o titular', mode: 'numeric' })}
        </div>
      </div>
      ${footer('Continuar', { secondaryAction: 'flex' })}`,

    // 2.2 — CPF já na base
    endereco: () => `
      <div class="sheet__content">
        ${header('Encontramos o cadastro do novo titular', 'Escolha onde deseja contratar e fechamos o seu pedido.')}
        <div class="sheet__body">
          <div class="options" role="radiogroup" aria-label="Onde deseja contratar">
            <button type="button" class="option" role="radio" aria-checked="true" data-value="manter">
              <svg class="option__check" aria-hidden="true"><use href="#i-check-circle"/></svg>
              <svg class="ico" aria-hidden="true"><use href="#i-home"/></svg>
              <span class="option__name">Endereço atual</span><span class="option__desc">Manter meu endereço</span>
            </button>
            <button type="button" class="option" role="radio" aria-checked="false" data-value="novo" tabindex="-1">
              <svg class="option__check" aria-hidden="true"><use href="#i-check-circle"/></svg>
              <svg class="ico" aria-hidden="true"><use href="#i-location"/></svg>
              <span class="option__name">Novo endereço</span><span class="option__desc">Informar um novo endereço</span>
            </button>
          </div>
        </div>
      </div>
      ${footer('Continuar', { disabled: false })}`,

    // 3 — CPF aceito: e-mail e celular
    dados: () => `
      <div class="sheet__content">
        ${header('O CPF do novo titular foi aceito', 'Informe o e-mail e o celular do novo titular para fecharmos o seu pedido.')}
        <div class="sheet__body">
          ${field({ id: 'cpf-ro', label: 'CPF de quem será o titular', value: maskCpf(state.cpf), readonly: true })}
          <div class="masked"><span class="masked__label">Nome completo</span><span class="masked__value">Fic***** Tes****** da Sil***</span></div>
          ${field({ id: 'email', label: 'E-mail do novo titular', type: 'email', mode: 'email' })}
          ${field({ id: 'cel', label: 'Celular do novo titular', type: 'tel', mode: 'tel' })}
        </div>
      </div>
      ${footer('Fechar pedido com estes dados')}`,

    // 3.1 — falha da API BVC: dados completos
    'dados-bvc': () => `
      <div class="sheet__content">
        ${header('O CPF do novo titular foi aceito', 'Informe os dados do novo titular para fecharmos o seu pedido.')}
        <div class="sheet__body">
          ${field({ id: 'cpf-ro', label: 'CPF de quem será o titular', value: maskCpf(state.cpf), readonly: true })}
          ${field({ id: 'nome', label: 'Nome completo' })}
          ${field({ id: 'email', label: 'E-mail', type: 'email', mode: 'email' })}
          ${field({ id: 'cel', label: 'Celular', type: 'tel', mode: 'tel' })}
          ${field({ id: 'rg', label: 'RG' })}
          ${field({ id: 'nasc', label: 'Nascimento', mode: 'numeric' })}
          ${field({ id: 'mae', label: 'Nome da mãe completo' })}
        </div>
      </div>
      ${footer('Fechar pedido com estes dados')}`,

    // 5 — Oferta Flex
    flex: () => `
      <div class="sheet__content">
        ${header('Houve um problema ao concluir seu pedido.', 'Não conseguimos continuar com o plano selecionado. Mas encontramos uma alternativa disponível para você.')}
        <div class="offer">
          <div class="offer__head"><span class="plan-icon"><svg class="ico" aria-hidden="true"><use href="#i-wifi"/></svg></span>
            <div><div class="offer__name">500 Mega · Plano Flex</div><div class="offer__sub">Internet para sua casa</div></div></div>
          <hr>
          <ul><li>✓ 6 parcelas no cartão de crédito</li><li>✓ 100% digital pelo app</li><li>✓ Sem burocracia e sem faturas mensais</li></ul>
          <hr>
          <div class="offer__price"><span class="offer__price-label">Valor total</span>
            <span class="offer__price-value"><strong>R$ 95,90</strong>/mês<small>Contratação de 6 meses</small></span></div>
        </div>
      </div>
      ${footer('Contratar Plano Flex', { disabled: false, secondaryAction: 'sem-bl' })}`,

    // Oferta de celular (crédito aprovado)
    celular: () => `
      <div class="upsell__art" aria-hidden="true"><svg class="ico"><use href="#i-phone"/></svg></div>
      <div class="upsell">
        <button class="icon-btn upsell__close" type="button" data-action="sucesso" aria-label="Fechar e seguir só com a internet"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button>
        <div class="sheet__header" style="padding-right:40px">
          <h2 class="sheet__title" id="sheet-title">Leve um plano de celular por + R$ 59,90/mês</h2>
          <p class="sheet__subtitle" style="font-weight:400">Internet e celular na mesma fatura, com mais praticidade e benefícios para você.</p>
        </div>
        <div class="upsell__card">
          <p class="upsell__caption">Seu pedido atual</p>
          <div class="upsell__row"><span class="plan-icon"><svg class="ico" aria-hidden="true"><use href="#i-wifi"/></svg></span><span>600 Mega</span><b>R$ 99,90<small>/mês</small></b></div>
          <div class="upsell__banner"><svg class="ico" aria-hidden="true"><use href="#i-tag"/></svg> Por apenas R$ 59,90 a mais, leve:</div>
          <p class="upsell__caption">Leve junto</p>
          <div class="upsell__row"><span class="plan-icon"><svg class="ico" aria-hidden="true"><use href="#i-wifi"/></svg></span><span>600 Mega</span><b>R$ 99,90<small>/mês</small></b></div>
          <div class="upsell__row"><span class="plan-icon"><svg class="ico" aria-hidden="true"><use href="#i-phone"/></svg></span><span>Pós 60GB Multi</span><span><span class="upsell__strike">R$ 79,90</span><b>R$ 59,90<small>/mês</small></b></span></div>
          <div class="upsell__total"><span class="upsell__save">Economize R$ 240 por ano</span><span>Valor total <strong>R$ 159,90</strong>/mês</span></div>
        </div>
        <div class="sheet__footer">
          <button class="btn btn--sale btn--block" type="button" data-action="sucesso">Adicionar e fechar pedido</button>
          <button class="btn btn--outline btn--block" type="button" data-action="sucesso">Não tenho interesse</button>
        </div>
      </div>`,
  };

  /* ---------- Páginas de resultado ---------- */
  const results = {
    sucesso: `<div class="result__card result__card--placeholder"><span class="result__tag">Frame pendente no Figma</span><h1>Conclusão · pedido concluído</h1></div>`,
    desistiu: `<div class="result__card"><h1>Agradecemos seu interesse</h1><p>Entendemos que esta opção não atende à sua necessidade no momento. Caso queira, poderá iniciar uma nova consulta futuramente.</p></div>`,
    'sem-bl': `<div class="result__card"><h1>No momento, não conseguimos seguir com este pedido</h1><p>Em breve, nosso time entrará em contato com você para ajudar da melhor forma.</p></div>`,
    redirect: `<div class="result__card result__card--placeholder"><span class="result__tag">Outra jornada</span><h1>Redireciona o cliente para a base</h1><p>Próxima tela: autenticação, em outra jornada.</p></div>`,
  };

  /* ---------- Estado ---------- */
  const state = { screen: null, cpf: '' };

  /* ---------- Render ---------- */
  function openSheet(name) {
    state.screen = name;
    if (overlay.hidden) { lastFocus = document.activeElement; overlay.hidden = false; checkout.inert = true; }
    sheet.className = 'sheet' + (name === 'celular' ? ' sheet--upsell' : '');
    sheet.innerHTML = screens[name]();
    sheet.classList.add('is-swapping');
    sheet.scrollTop = 0;
    bind(name);
    const first = sheet.querySelector('input:not([readonly])') || sheet;
    first.focus({ preventScroll: true });
  }

  function closeSheet() {
    overlay.hidden = true; checkout.inert = false; sheet.innerHTML = '';
  }

  function showResult(name) {
    closeSheet();
    checkout.hidden = true;
    resultCard.innerHTML = results[name];
    result.hidden = false;
    window.scrollTo(0, 0);
    result.querySelector('h1').setAttribute('tabindex', '-1');
    result.querySelector('h1').focus();
  }

  function restart() {
    closeSheet();
    result.hidden = true; checkout.hidden = false;
    state.cpf = '';
    window.scrollTo(0, 0);
    $('#btn-confirmar').focus();
  }

  async function globalLoading(text, ms = DELAY) {
    $('#global-loading-text').textContent = text;
    loading.hidden = false;
    await wait(ms);
    loading.hidden = true;
  }

  function setBtnLoading(btn, on, label) {
    if (on) { btn.dataset.label = btn.textContent; btn.innerHTML = `<span class="spinner spinner--sm" aria-hidden="true"></span> ${label}`; btn.classList.add('is-loading'); btn.disabled = true; }
    else { btn.textContent = btn.dataset.label; btn.classList.remove('is-loading'); }
  }

  /* ---------- Comportamento por tela ---------- */
  function wireField(input, mask) {
    const wrap = input.closest('.field');
    input.addEventListener('input', () => {
      if (mask) { input.value = mask(input.value); }
      wrap.classList.toggle('is-filled', input.value.length > 0);
      wrap.classList.remove('is-error');
      const err = $(`#${input.id}-err`); if (err) err.hidden = true;
    });
  }
  function showError(input, msg) {
    input.closest('.field').classList.add('is-error');
    const err = $(`#${input.id}-err`); err.textContent = msg; err.hidden = false;
  }

  function bind(name) {
    const primary = sheet.querySelector('[data-action="primary"]');

    if (name === 'cpf' || name === 'segunda') {
      const cpf = $('#cpf', sheet);
      wireField(cpf, maskCpf);
      cpf.addEventListener('input', () => { primary.disabled = digits(cpf.value).length !== 11; });
      cpf.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !primary.disabled) primary.click(); });
      primary.addEventListener('click', async () => {
        const d = digits(cpf.value);
        if (d === BUYER_CPF) return showError(cpf, 'Informe o CPF de outra pessoa.');
        if (/^(\d)\1{10}$/.test(d)) return showError(cpf, 'CPF inválido. Confira os números.');
        state.cpf = d;
        // loading dentro do campo + no botão
        const wrap = cpf.closest('.field');
        wrap.insertAdjacentHTML('beforeend', '<span class="spinner field__spinner" aria-hidden="true"></span>');
        cpf.readOnly = true;
        setBtnLoading(primary, true, 'Consultando CPF');
        await wait(DELAY);
        const s = scenario();
        if (s.base === 'sim') return openSheet('endereco');
        openSheet(s.bvc === 'falha' ? 'dados-bvc' : 'dados');
      });
    }

    if (name === 'endereco') {
      const opts = [...sheet.querySelectorAll('.option')];
      const select = (o) => opts.forEach((x) => { const on = x === o; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
      opts.forEach((o) => {
        o.addEventListener('click', () => select(o));
        o.addEventListener('keydown', (e) => {
          if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault(); const n = opts[(opts.indexOf(o) + 1) % opts.length]; select(n); n.focus();
          }
        });
      });
      primary.addEventListener('click', () => {
        const v = sheet.querySelector('.option[aria-checked="true"]').dataset.value;
        showResult(v === 'manter' ? 'sucesso' : 'redirect');
      });
    }

    if (name === 'dados' || name === 'dados-bvc') {
      const inputs = [...sheet.querySelectorAll('input:not([readonly])')];
      const masks = { cel: maskPhone, nasc: maskDate };
      inputs.forEach((i) => wireField(i, masks[i.id]));
      const valid = () => inputs.every((i) => {
        if (i.id === 'email') return validEmail(i.value);
        if (i.id === 'cel') return digits(i.value).length === 11;
        if (i.id === 'nasc') return digits(i.value).length === 8;
        return i.value.trim().length >= 3;
      });
      inputs.forEach((i) => i.addEventListener('input', () => { primary.disabled = !valid(); }));
      inputs.find((i) => i.id === 'email').addEventListener('blur', (e) => {
        if (e.target.value && !validEmail(e.target.value)) showError(e.target, 'Confira o e-mail informado.');
      });
      primary.addEventListener('click', async () => {
        setBtnLoading(primary, true, 'Fechando pedido');
        await wait(DELAY);
        if (scenario().novo === 'sim') return showResult('sucesso');
        openSheet('segunda');
      });
    }

    if (name === 'flex') {
      primary.addEventListener('click', () => showResult('sucesso'));
    }
  }

  /* ---------- Ações globais ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'desistir') showResult('desistiu');
    if (act === 'flex') openSheet('flex');
    if (act === 'sem-bl') showResult('sem-bl');
    if (act === 'sucesso') showResult('sucesso');
    if (act === 'restart') { togglePanel(false); restart(); }
  });

  $('#btn-confirmar').addEventListener('click', async () => {
    await globalLoading('Analisando seu pedido…');
    openSheet(scenario().credito === 'aprovado' ? 'celular' : 'cpf');
  });

  // Fatura: seleção visual
  document.querySelectorAll('.bill input').forEach((r) => r.addEventListener('change', () => {
    document.querySelectorAll('.bill').forEach((b) => b.classList.toggle('is-selected', b.contains(r) && r.checked));
  }));

  // Foco preso dentro do modal
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...sheet.querySelectorAll('button:not([disabled]), input:not([readonly]), [tabindex="0"]')].filter((x) => x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Painel de cenários
  const toggle = $('#scenario-toggle'), panel = $('#scenario-panel');
  function togglePanel(force) {
    const open = force ?? panel.hidden;
    panel.hidden = !open; toggle.setAttribute('aria-expanded', open);
  }
  toggle.addEventListener('click', () => togglePanel());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { togglePanel(false); toggle.focus(); } });
})();
