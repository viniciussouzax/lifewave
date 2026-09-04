# PERSONALIZAÇÕES — Lifewave (sobre o scaffold MSIA/CNX)

> Catálogo de tudo que foi customizado a partir do template base, com **arquivos**,
> **decisões de design** e **como reaplicar**. Serve como spec para outra IA/dev
> reproduzir a mesma personalização num template limpo.
> Fonte da verdade sempre é o código; este doc é o mapa. Última atualização: 2026-08-17.

---

## 0. Visão geral

Site de um **Brand Partner LifeWave**: funil de captação para apresentação online
(WebinarJam) + blog/artigos de apoio + catálogo de produtos. Stack inalterada
(Astro 5 static + Vercel, React só no admin, Tailwind 3, Bun). Nada de estrutura
técnica mudou — só incrementos visuais/funcionais.

---

## 1. Sistema de design (base de tudo) — `src/styles/global.css`

**Tokens de cor** (em `:root`, tripla RGB usada via `rgb(var(--c-x) / <alpha>)`):

| Token | Hex | Uso |
|---|---|---|
| `--c-bg` | `#FAF8F4` | fundo geral (off-white quente) |
| `--c-primary` / `--c-ink` | `#194F90` | **azul da marca** — títulos, botões |
| `--c-ink-muted` | `#373F41` | corpo / texto secundário |
| `--c-ink-faint` | `#7E8D96` | labels / helper / meta |
| `--c-border` / `--c-rule` / `--c-link` | `#5EB3E4` | bordas, divisores, links |
| `--c-primary-soft` | `#ECF5FA` | **fundo de cards e CTAs** |

**Tipografia (hierarquia — REGRA IMPORTANTE):** definida por tag em `global.css`,
NÃO por classe. O combo é escolhido em `siteConfig.theme.font = "montserrat"`
(ver `FONT_MAP` em `BaseLayout.astro`):
- `h1`, `h2` → **Montserrat** (`--font-display`), tamanhos `--fs-hero` / `--fs-section`.
- `h3`, `h4` → **Geist** (`--font-body`) — títulos pequenos / UI.
- corpo → Geist.
- **Gotcha:** essas regras de `h1/h2/h3` são *unlayered* e vencem as classes
  `text-*` do Tailwind (que ficam em `@layer`). Para mudar tamanho de título use a
  **tag semântica certa** (h1/h2/h3) — não force com `text-xl` etc.; se precisar
  mesmo, use `!important` (`!text-white` em fundo escuro, p.ex.).

**Botões:** `.btn` = pílula (`border-radius: 9999px`), sem underline, `font-weight:600`.
Cores de link (`#5EB3E4`) ≠ cor de botão (`#194F90` sólido + texto branco).

Onde a marca é aplicada em runtime: `siteConfig.theme.primary` sobrescreve
`--c-primary` no `BaseLayout` (mudar cor da marca = mudar 1 valor no admin).

---

## 2. Home / Landing da apresentação
Arquivos: `src/pages/index.astro` → `src/components/local/ApresentacaoLanding.astro`

- Home **deixou de ser** o `LocalHome` e virou uma **landing** (hero em 2 colunas).
- **Hero:** fundo `#194F90` (azul), texto branco. Coluna esquerda = eyebrow com
  data da próxima sessão (preenchida por JS) + `h1` (Montserrat) + subtítulo +
  5 bullets com check branco em círculo. Coluna direita (`grid-cols-[1fr_440px]`,
  `items-start`) = card `#ECF5FA` com título (h3), vídeo YouTube (facade lite) e o
  **formulário do WebinarJam** (embed-form, hash `ykzwy0b7`).
- `BaseLayout` recebe `hideTopBars` e `flushFooter` (só a home usa) → sem barras de
  topo e footer colado (margin 0).
- **WebinarJam embed-form** centralizado (`.wj-embed-wrapper { margin: auto }`),
  porque ele renderiza ~500px fixos.
- SEO: title/description específicos da landing em `index.astro`.

## 3. Página do artigo — `src/pages/[slug].astro`
(Muitas mudanças; é o arquivo mais customizado.)

- **Sem hero**; header limpo: `h1` → descrição → linha meta (`categoria · data ·
  leitura · por Lifewave Team`). Autor sempre "Lifewave Team".
- Conteúdo (intro→FAQ) preservado; imagens `[[video:URL]]` via shortcodes.
- **FAQ vira accordion** via script `is:inline` (JS puro) que converte
  `<p><strong>Pergunta</strong> resposta</p>` (e `<hN>`) em `<details>`. Robusto:
  reconhece "Perguntas/Dúvidas frequentes/comuns/FAQ" e tem fallback. CSS em
  `<style is:global>` (elementos criados em runtime).
- **3 perguntas fixas de FAQ** (fototerapia LifeWave) sempre no fim de toda matéria.
- **Aviso legal** padrão após a FAQ.
- **CTAs de apresentação** (ligadas ao WebinarJam, botão-modal `wj-embed-button`,
  hash `ykzwy0b7`, `formTemplate=8`):
  - CTA webinar pós-FAQ, banner lateral fixo (sticky, desktop), e **CTA inline**
    distribuída a cada N `<h2>` (via script, como banner de ad controlado).
  - Cada CTA com **contador regressivo** em caixas (dias/horas/min/seg).
- Banner lateral tem vídeo (facade) e, no mobile, o vídeo migra para a CTA pós-FAQ.
- **Removido** o bloco de compartilhar nas redes sociais.

## 4. Blog / listagem — `src/pages/blog/index.astro`, `categoria/[slug].astro`, `search.astro`, `src/components/ui/PostCard.astro`
- Cards viraram **lista** (data + título, sem placeholder colorido). Imagem só se
  houver capa.
- **Removidas as cores de categoria** em todo o site.
- Removido o rótulo "arquivo" e reduzida a headline da `/blog`.

## 5. Footer — `src/components/layout/Footer.astro`
- Redesenho multi-coluna inspirado no LifeWave oficial: fundo de **bolhas**
  (`/assets/footer-background.svg`, responsivo 100%/180%/280%), ícones sociais
  **circulares** com **Simple Icons** (ver `src/lib/brandIcons.ts`), barra inferior
  azul com links legais e copyright em inglês.
- **Descrição** (abaixo da logo) em azul `#194F90`, texto de Brand Partner.
- **Tópicos** = 3 links fixos: Comece aqui / Bem-estar / Tecnologia.
- Logo adicionada; prop `flush` remove o `mt-24` na home.

## 6. Nav / Header — `src/components/layout/Header.astro`
- Estilo oficial: fundo claro/branco, texto azul, **borderline** no topo e base da
  nav; nav + avisos **estáticos** (não sticky).
- Botão **WhatsApp** aponta para o grupo:
  `https://chat.whatsapp.com/CnhqkF4S9fg2H2hqe3G81B` (fixo em `waUrl`).
- **Correção crítica:** o menu mobile e a busca quebravam porque o `<script
  is:inline>` tinha TypeScript (`as HTMLElement`) — `is:inline` vai cru, sem strip
  de TS. Removido o cast. (Ver `astro-isinline-no-typescript` nas memórias.)
- Logo via `siteConfig.logo` (`/logo.png`, `logoHeight` no config).

## 7. Barras de topo (acima da nav) — `src/layouts/BaseLayout.astro`
- Duas faixas: **aviso escuro** (`topNotice`, `#194F90`) e **CTA clara**
  (`announcement`, `#ECF5FA`), editáveis em `articleCta.json`. Aparecem em todas as
  páginas exceto home (`hideTopBars`).
- A barra clara mostra só um texto (removidos countdown/botão).

## 8. Página de produtos — `src/pages/produtos.astro` → `src/components/local/ProdutosPage.astro`
- Catálogo dos **25 produtos LifeWave** em 7 categorias. Cards com **foto oficial**,
  nome/descrição/preço (USD referência) + CTA "Falar com um Brand Partner"
  (WhatsApp de `localBusiness.json`).
- Cada card é um `<a>` que **linka para o artigo do produto** (campo `slug`), com a
  foto em `public/assets/produtos/<img>` (campo `img`). O array `categorias` é
  hardcoded no componente — para adicionar produto, incluir `nome/desc/preco/img/slug`.

## 8b. Os 25 artigos de produto — `src/content/blog/<slug>.md`
- Um artigo por produto, com o **conteúdo oficial traduzido** da loja LifeWave
  (`lifewave.com/wellnesspatchesoficial/store/product/<SKU>`), a pedido do Brand
  Partner (uso de material aprovado pela marca).
- Estrutura: intro → `## Benefícios` → seções extras → `## Como usar` →
  `## Cuidados e advertências` → `## Perguntas frequentes (FAQ)`. O template do
  artigo injeta sozinho o accordion, as 3 perguntas fixas, as CTAs e o aviso legal.
- **Só entram as FAQs específicas do produto** — as 3 genéricas de fototerapia já
  vêm do template (`[slug].astro`), então repeti-las duplicaria.
- **Gotcha:** nunca começar parágrafo do fim da matéria com `**Negrito:**` — o script
  do template converte `<p><strong>` final em item de FAQ (foi o que fez "Cuidados:"
  virar pergunta). Por isso "Cuidados" é uma seção `##` com texto simples.
- **Compliance:** nunca descrever onde aplicar o adesivo — sempre "conforme a
  orientação oficial da LifeWave". Frequência de uso (5-7x/semana etc.) pode.
  Regras dos EUA (restrição por estado, política de reembolso, financiamento) foram
  omitidas por não valerem no Brasil.

### Base de conhecimento — `knowledge/products/loja-oficial.json`
Coleta dos 25 produtos da loja oficial (descrição, benefícios, instruções, cautions,
preço, SKU, **217 FAQs** e URL da foto original). Serve de fonte para reprocessar os
artigos ou atualizar a `/produtos` sem raspar o site de novo. As páginas oficiais são
**SSR** — dá pra buscar com `curl` simples, sem browser.

## 9. Admin
- **Cores neutras** (preto/branco/cinza, sem enfeites de cor).
- **Logo do painel** = `siteConfig.logo` (`AdminNav.tsx` recebe `logo`/`siteName` do
  `AdminLayout`).
- Nova página **Inscritos** (`src/pages/admin/inscritos.astro` + link no `AdminNav`):
  tabela dos leads de `subscribers.json` (lê do repo → live em prod) + export CSV.

## 10. Integrações / lógica
- **Contador regressivo** (`BaseLayout` script + `src/components/ui/CountdownBoxes.astro`):
  sessões diárias **11h / 15h / 20h**, começando **20/08/2026 11h**; preenche
  `[data-countdown]` (HH:MM:SS, com "Nd" se >1 dia), `[data-cd="d|h|m|s"]` (caixas) e
  `[data-next-session]` (data por extenso). Horário local do visitante.
- **WebinarJam** (hash `ykzwy0b7`): embed-**form** na home; embed-**button** (modal,
  `formTemplate=8`) nos artigos. Scripts carregam do domínio deles → só renderizam
  no domínio publicado.
- **Formulário próprio** (quando usado): POST `/api/subscribe` salva
  `{name, whatsapp, email, interest, source}` em `subscribers.json` + Brevo se
  configurado. (Na home atual foi substituído pelo WebinarJam.)
- **AI generator + OpenRouter** conectado (`src/plugins/ai-generator`).
- **Simple Icons** (`src/lib/brandIcons.ts`): paths oficiais das marcas para footer
  e share.

## 11. Config / infra (dados do usuário — `src/data/`)
- `siteConfig.json`: `theme.primary=#194F90`, `theme.accent=#5EB3E4`,
  `theme.font=montserrat`, `logo=/logo.png`, `logoHeight`, `url=https://brandpartner.team`,
  `footer.description/copyright`.
- `menu.json`: Apresentação · Produtos · Artigos.
- **Domínio principal** `brandpartner.team` (+ www → apex) no projeto Vercel
  `lifewave` (time `empreendedorus`). `lifewave.team` também segue apontado ao
  mesmo projeto (pode virar redirect → brandpartner.team). DNS de ambos na
  Cloudflare (registros A `216.198.79.1` + `64.29.17.1`, CNAME www →
  `cname.vercel-dns.com`, todos DNS-only).

---

## 12. Como reaplicar em outro template limpo (guia p/ outra IA)

1. **Aplicar o design system primeiro** (§1): tokens de cor em `global.css`, combo
   de fonte Montserrat+Geist, hierarquia por tag (h1/h2=display, h3=body). Isso
   sozinho já dá 80% do "refinamento visual".
2. **Componentes reutilizáveis** que carregam a personalização (copiar/adaptar):
   `ApresentacaoLanding.astro`, `ProdutosPage.astro`, `CountdownBoxes.astro`,
   `brandIcons.ts`, e os scripts do `BaseLayout` (contador) e do `[slug].astro`
   (FAQ accordion, distribuição de CTA inline, facade de vídeo).
3. **Regras de ouro** (gotchas que quebram se ignorados):
   - `<script is:inline>` = **JS puro**, nunca TypeScript (`as`, generics).
   - CSS de elementos criados em runtime (FAQ accordion, `.iti`, WebinarJam) precisa
     ser **`is:global`** — scoped não pega.
   - Para mudar tamanho de título, use a tag certa ou `!important` (regras globais de
     `h1/h2/h3` vencem o Tailwind).
   - CTAs/cards usam `#ECF5FA` de fundo, **sem borderline** no site público.
4. **Fontes de verdade complementares:** `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md`,
   `PLUGIN_SYSTEM.md` (docs do scaffold) + o histórico em `git log origin/main`.

---

## 13. Deploy (resumo — ver detalhes no processo do time)
`viniciususouzax/lifewave` → Vercel auto-deploy do `main`. Deploy via **worktree em
cima do `origin/main`** (o main local fica atrás), copiando só o tema e **excluindo**
`src/content`, `src/data` e `public/uploads`. Exceções de `src/data` sobem
explicitamente (`menu.json`, `siteConfig.json` com `social` zerado, `articleCta.json`).
**Nunca** subir `subscribers.json` (inscritos reais gravados pela API em prod).
