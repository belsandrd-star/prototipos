# Vitrine + Carrinho: protótipo de micro interações

Protótipo em HTML/CSS/JS puro para demonstrar micro interações da vitrine de planos e do carrinho lateral (desktop).

> **Dados e marcas fictícios.** Preços, nomes de apps, logos e banners são placeholders. A estrutura, os espaçamentos, os tokens e os ícones seguem o design do Figma.

## Como abrir

Não precisa de build. Abra `index.html` no navegador ou publique a pasta no GitHub Pages.

- `index.html`: vitrine
- `index.html?cart=open`: vitrine com o carrinho aberto

## Estrutura

```
index.html          markup + sprite de ícones SVG (fill = currentColor)
css/tokens.css      tokens (cores, raios, espaçamentos, sombras, fontes)
css/styles.css      layout e componentes
js/app.js           carrinho: abrir/fechar, vazio, adicionar, remover, toasts
assets/fonts/       Roboto + fonte substituta dos títulos (self-hosted)
```

## Tokens

Os nomes em `css/tokens.css` espelham as variáveis do Figma (`color/brand/primary/medium` → `--color-brand-primary-medium`). A fonte de títulos proprietária (AMX) está declarada primeiro em `--font-display`. Se ela estiver instalada, é usada; se não, entra a substituta.

## Status

| Fase | Escopo | Status |
|---|---|---|
| 1 | Layout desktop: vitrine + carrinho (estático) | ✅ |
| 2 | Micro interações desktop | ✅ (ver abaixo) |
| 3 | Mobile (layout + interações) | 🔜 |

## Acessibilidade já prevista

- Carrinho como `role="dialog"` + `aria-modal`, fecha com Esc e devolve o foco ao botão que o abriu
- Botões de ícone com `aria-label`
- Accordions com `<details>/<summary>` nativos
- `:focus-visible` em todos os controles
- As animações da fase 2 vão respeitar `prefers-reduced-motion`

## Micro interações

| Interação | Detalhe | Timing |
|---|---|---|
| Fechar pelo fundo | Cursor vira "fechar" (círculo branco com X) sobre o overlay; clique fecha | — |
| Header da vitrine fixo | Ganha sombra ao rolar | 200ms ease-out |
| Header do carrinho fixo | Título e X ficam no topo; itens rolam por baixo | — |
| Carrinho vazio | Bloco cinza com ilustração; some ao entrar o 1º item | saída 160ms ease-in · altura 240ms ease-out |
| Adicionar item | Item entra no topo (fade + 8px) com destaque verde | 280ms ease-out · destaque 1600ms |
| Toast "Adicionado ao carrinho!" | Verde (success), sobre o header do carrinho | entra 280ms (+150ms delay) · fica 2,5s · sai 200ms |
| Item repetido | Não duplica; destaca o existente + "Já está no seu carrinho" | idem |
| Remover item | Desliza 16px p/ direita e fecha o espaço; foco vai p/ o próximo item | 160ms ease-in + 220ms ease-out |
| Toast "Removido do carrinho" | Vermelho Mondrian (brand/primary), ícone X | idem ao de sucesso |

Curvas: entrada `cubic-bezier(0.2, 0, 0, 1)` · saída `cubic-bezier(0.3, 0, 1, 1)` (tokens `--motion-*` em `css/tokens.css`).
Todas respeitam `prefers-reduced-motion`.
