# Análise de crédito: protótipo navegável

Protótipo em HTML, CSS e JS puro do fluxo de análise de crédito no checkout (EUNCP-10886): troca de titularidade, CPF já cadastrado na base, Oferta Flex e oferta de celular.

> **Dados e marcas fictícios.** Nomes, CPFs, preços e a marca "operadora" são placeholders. Textos, hierarquia e comportamento seguem o Figma.

## Como abrir

Não precisa de build. Abra `index.html` no navegador ou publique a pasta no GitHub Pages.

- Mobile (até 767 px): as etapas aparecem em bottom sheet.
- Desktop (768 px ou mais): as etapas aparecem em modal centralizado de 640 px.

## Cenários

O botão **Cenários**, no canto superior direito, simula as respostas das APIs. Escolha antes de clicar em "Confirmar e fechar pedido".

| Pergunta | Opções |
|---|---|
| Análise de crédito | Reprovado (padrão) · Aprovado |
| CPF do novo titular já está na base? | Não (padrão) · Sim |
| API BVC | Responde (padrão) · Falha |
| Novo CPF aprovado? | Não (padrão) · Sim |

Também dá para abrir já configurado pela URL, por exemplo:

- `index.html?credito=aprovado` → oferta de celular
- `index.html?base=sim` → "Encontramos o cadastro do novo titular"
- `index.html?bvc=falha` → formulário completo (3.1)
- `index.html?novo=sim` → pedido concluído após o novo CPF

Qualquer CPF com 11 dígitos funciona. O CPF `111.444.777-35` simula o CPF do próprio comprador e mostra o erro "Informe o CPF de outra pessoa".

## Fluxo

```
Checkout → Análise de crédito
├─ Aprovado → Oferta celular → Conclusão
└─ Reprovado → 1/2 CPF do novo titular → consulta na base
   ├─ Já na base → 2.2 Endereço
   │   ├─ Manter meu endereço → Conclusão
   │   └─ Novo endereço → Redireciona para autenticação (outra jornada)
   └─ Não está na base → 3 E-mail e celular (3.1 se a API BVC falhar)
       ├─ Novo CPF aprovado → Conclusão
       └─ Não aprovado → 4 Última tentativa
           ├─ Continuar → nova consulta na base
           └─ Prefiro não continuar → 5 Oferta Flex
               ├─ Contratar → Conclusão
               └─ Prefiro não continuar → Sem banda larga

"Prefiro não continuar" nas telas 1, 2.2, 3 e 3.1 → Agradecemos seu interesse
```

## Estrutura

```
index.html        checkout de fundo, páginas de resultado, painel de cenários
css/tokens.css    tokens (mesmos do protótipo do carrinho)
css/styles.css    layout, bottom sheet / modal e componentes
js/app.js         telas, máscaras, validações e navegação
assets/fonts/     Roboto + fonte substituta dos títulos
```

## Acessibilidade prevista

- Modal com `role="dialog"`, `aria-modal`, foco preso dentro e checkout atrás com `inert`
- Erros de campo e alerta da tela 4 anunciados com `role="alert"`
- Teclado numérico (`inputmode`) e máscaras em CPF, celular e data
- Opções de endereço como `radiogroup`, com setas do teclado e check visível além da borda
- Respeita `prefers-reduced-motion`

## Pendências

- Tela de pedido concluído (ainda placeholder no Figma)
- Tela de autenticação (outra jornada)
