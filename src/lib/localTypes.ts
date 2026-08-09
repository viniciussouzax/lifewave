/**
 * localTypes.ts — Tipos do Tema Local (gerador de páginas de SEO local).
 *
 * O coração do tema: SERVIÇO × LOCALIDADE = página /{cidade}/{servico}.
 * O conteúdo de IA é gerado UMA VEZ por serviço (parametrizado com {cidade},
 * {servico}, {estado}, {empresa}, {telefone}) e a página de cada cidade só faz
 * substituição de variável em build-time. Ver applyTemplateVars em localVars.ts.
 *
 * Persistido como JSON em src/data/ (lido via readData, salvo via commit.ts).
 */

export interface OutlineItem {
  level: 'h2' | 'h3' | 'h4';
  text: string;
}

/** Agrupador de serviços + cor da assinatura visual da página. */
export interface Niche {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  /** Hex (#rrggbb). Injetado inline na página via --niche (não via classe Tailwind). */
  color: string;
  active: boolean;
}

/** Serviço = keyword + outline + 1 conteúdo de IA parametrizado, reusado em N cidades. */
export interface Service {
  title: string;
  slug: string;
  shortDescription?: string;
  icon?: string;
  /** Imagem ilustrativa do serviço (URL/caminho). Trocável pelo usuário no admin (Francis).
   *  Vazio → card cai no bloco de cor do serviço como fallback. */
  image?: string;
  /** Cor do card/página deste serviço (hex). Escolhida direto no serviço.
   *  Leitura: svc.color || niche?.color || default. */
  color?: string;
  /** Legado: slug do antigo Niche. Mantido p/ retrocompat; a cor agora vive no serviço. */
  niche?: string;
  outline?: OutlineItem[];
  /** Markdown com tokens {cidade}/{servico}/{estado}/{empresa}/{telefone}. Vazio → usa localTemplate. */
  generatedContent?: string;
  contentGeneratedAt?: string;
  active: boolean;
}

/** Cidade ou bairro. Regra de 404: !active && type !== 'cidade' → não buildada. */
export interface Location {
  name: string;
  slug: string;
  state: string;
  city?: string;
  citySlug?: string;
  type: 'cidade' | 'bairro' | 'regiao' | 'zona';
  active: boolean;
}

/** Fallback usado quando service.generatedContent está vazio. */
export interface LocalTemplate {
  heroTitle?: string;
  heroSubtitle?: string;
  pageContent?: string;
  benefits?: string[];
  metaTitle?: string;
  metaDescription?: string;
}

/** Dados da empresa que alimentam as variáveis {empresa}/{telefone}, os CTAs e a home. */
export interface LocalBusiness {
  companyName: string;
  phone?: string;
  whatsapp?: string;
  whatsappMessage?: string;
  /** Bloco de contato/mapa da home. */
  address?: string;
  hours?: string;
  /** URL de embed do Google Maps (ou o <iframe> colado — extraímos o src). */
  mapEmbed?: string;
  /** Hero da home. */
  homeTitle?: string;
  homeSubtitle?: string;
  /** Imagem de fundo do hero (URL/caminho). Vazio → hero drenado na cor do nicho.
   *  Upload pelo admin = Francis; a home já renderiza com overlay quando preenchido. */
  heroImage?: string;
  /** Seção "Quem somos" da home (parágrafos separados por linha em branco). */
  aboutTitle?: string;
  aboutText?: string;
}

/** Variáveis disponíveis para substituição no conteúdo/template. */
export interface TemplateVars {
  cidade: string;
  estado: string;
  bairro: string;
  servico: string;
  empresa: string;
  telefone: string;
}

/** Um passo da seção "Como funciona" da home. */
export interface HomeStep {
  title: string;
  description: string;
}

/** Rótulo de seção da home (eyebrow + título), editável no admin. */
export interface SectionLabel {
  eyebrow?: string;
  title?: string;
}

/**
 * Conteúdo editável das SEÇÕES da home (src/data/localHome.json).
 *
 * Hero e "quem somos" continuam em LocalBusiness (homeTitle/aboutText/heroImage) —
 * compartilhados/owned na identidade. Aqui ficam só os blocos próprios da home:
 * provas de confiança, passos, CTA final, rótulos de seção e os toggles show.*.
 * Textos aceitam variáveis {cidade}/{empresa}/{servico}/... resolvidas pra
 * localidade principal em build-time.
 */
export interface LocalHome {
  trust?: string[];
  benefits?: string[];
  /** Slugs dos serviços em destaque na home (máx 9, na ordem). Vazio → os 9 primeiros. */
  featuredServices?: string[];
  steps?: HomeStep[];
  ctaTitle?: string;
  ctaSubtitle?: string;
  /** Texto do botão de WhatsApp em todos os CTAs do site. Ex.: "Falar no WhatsApp", "Agendar consulta", "Pedir orçamento". */
  ctaButton?: string;
  /** Camada escura sobre a imagem do hero (pra título branco ficar legível em foto clara).
   *  enabled: undefined = ativo (default true). opacity: 0-100 (default 77). Sem imagem de hero, é ignorado. */
  heroOverlay?: {
    enabled?: boolean;
    opacity?: number;
  };
  sections?: {
    servicos?: SectionLabel;
    comoFunciona?: SectionLabel;
    ondeAtendemos?: SectionLabel;
    contato?: SectionLabel;
  };
  /** Liga/desliga cada seção. undefined = visível (default true). */
  show?: {
    trust?: boolean;
    benefits?: boolean;
    comoFunciona?: boolean;
    quemSomos?: boolean;
    ondeAtendemos?: boolean;
    contato?: boolean;
    ctaFinal?: boolean;
  };
}
