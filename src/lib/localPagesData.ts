/**
 * localPagesData.ts — Camada de dados das páginas locais standalone (dona: Francis).
 *
 * Espelha o split de territórios do localHomeData.ts: derivação de dados aqui,
 * markup nas pages. Reusa loadHomeData() pra NÃO duplicar a derivação de negócio
 * local (empresa, região, serviceHref, contato, accent). As páginas /servicos,
 * /quem-somos e /contato consomem o MESMO localBusiness.json que a home, então
 * ficam sempre consistentes com as seções resumidas do LocalHome.
 */
import { loadHomeData } from './localHomeData';

/** Dados da página /servicos — lista completa de serviços (não capada como na home). */
export function loadServicesPage() {
  const d = loadHomeData();
  return {
    services: d.services,
    serviceHref: d.serviceHref,
    nicheOf: d.nicheOf,
    accent: d.accent,
    accentInk: d.accentInk,
    company: d.company,
    region: d.region,
    waUrl: d.waUrl,
    labels: d.labels.servicos,
    ctaTitle: d.ctaTitle,
    ctaSubtitle: d.ctaSubtitle,
    ctaButton: d.ctaButton,
    empty: d.services.length === 0,
  };
}

/** Dados da página /quem-somos — about do negócio local + card de atendimento. */
export function loadAboutPage() {
  const d = loadHomeData();
  return {
    aboutTitle: d.biz.aboutTitle || 'Quem somos',
    aboutParas: d.aboutParas,
    biz: d.biz,
    region: d.region,
    phoneHref: d.phoneHref,
    waUrl: d.waUrl,
    accent: d.accent,
    accentInk: d.accentInk,
    company: d.company,
    empty: !d.biz.aboutTitle && d.aboutParas.length === 0,
  };
}

/** Dados da página /contato — contato do negócio local + mapa. */
export function loadContactPage() {
  const d = loadHomeData();
  return {
    biz: d.biz,
    waUrl: d.waUrl,
    phoneHref: d.phoneHref,
    embedSrc: d.embedSrc,
    region: d.region,
    accent: d.accent,
    accentInk: d.accentInk,
    company: d.company,
  };
}
