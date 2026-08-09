/**
 * localFaq.ts — Extração de FAQ do markdown do tema local.
 *
 * Portado de cnx (themes/local/LocationServicePage.astro). O conteúdo gerado pela
 * IA pode conter uma seção "## Perguntas frequentes" com perguntas em H3/H4.
 * Extraímos pra renderizar num acordeão dedicado + emitir JSON-LD FAQPage,
 * e removemos a seção do corpo principal pra não duplicar.
 */

export interface FaqItem {
  q: string;
  a: string;
}

const FAQ_HEADING = /^#{1,2}\s.*(faq|perguntas\s+frequentes|d[úu]vidas)/i;
const OTHER_HEADING = /^#{1,2}\s/;

/** Remove a seção de FAQ do markdown (será exibida só na área dedicada). */
export function removeFaqFromContent(markdown: string): string {
  const out: string[] = [];
  let inFaq = false;
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (FAQ_HEADING.test(trimmed)) { inFaq = true; continue; }
    if (!inFaq) { out.push(line); continue; }
    // Sai da FAQ ao encontrar outro H1/H2 que não seja FAQ.
    if (OTHER_HEADING.test(trimmed) && !/faq|perguntas|d[úu]vidas/i.test(trimmed)) {
      inFaq = false;
      out.push(line);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Extrai perguntas (H3/H4) e respostas da seção de FAQ. Máx 10. */
export function extractFaq(markdown: string): FaqItem[] {
  const items: FaqItem[] = [];
  let inFaq = false;
  let currentQ = '';
  let currentA: string[] = [];

  const flush = () => {
    if (currentQ && currentA.length) items.push({ q: currentQ, a: currentA.join(' ').trim() });
  };

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (FAQ_HEADING.test(trimmed)) { inFaq = true; continue; }
    if (!inFaq) continue;
    if (OTHER_HEADING.test(trimmed) && !/faq|perguntas|d[úu]vidas/i.test(trimmed)) {
      flush(); currentQ = ''; currentA = []; inFaq = false; continue;
    }
    if (/^#{3,4}\s+.+/.test(trimmed)) {
      flush();
      currentQ = trimmed.replace(/^#{3,4}\s+/, '').replace(/\*\*/g, '');
      currentA = [];
      continue;
    }
    if (currentQ && trimmed && !trimmed.startsWith('#')) {
      currentA.push(trimmed.replace(/\*\*/g, '').replace(/\*/g, ''));
    }
  }
  flush();
  return items.slice(0, 10);
}
