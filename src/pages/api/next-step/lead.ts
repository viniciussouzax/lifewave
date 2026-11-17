/**
 * api/next-step/lead.ts: recebe o contato do formulário da CTA final (/next-step) e o entrega ao postmaster.
 *
 * POST /api/next-step/lead
 * Body: { nome, email, telefone, consentimento: true, origem?: { utm_source }, regiao, pais, objetivo, sub?,
 *         endereco?, quantidade?, site?: "" }   (endereço e quantidade só na encomenda, objetivo "once")
 * → { ok: true }
 *
 * - Nada fica guardado aqui: o contato vai direto ao webhook do postmaster (lib/postmaster.ts), que grava o
 *   lead com quem indicou (o `utm_source` é o código do link casca) e o leva ao atendimento. Depois, a escolha
 *   (continente, país, objetivo) e a encomenda vão ao `/proximo-passo` do postmaster, que avisa quem trouxe.
 * - Sem POSTMASTER_WEBHOOK_URL/SECRET o aviso não acontece; a rota então recusa (503), para o formulário
 *   nunca dizer "recebemos" sem ter entregue.
 * - Contra robô: limite por IP (como /api/webinar/inscricao) e o campo isca `site`, que gente de verdade
 *   não preenche. shortcut: sem Turnstile (a página não tem o widget); acrescentar se aparecer spam.
 */
import type { APIRoute } from 'astro';
import { avisarInscricaoNoPostmaster, avisarProximoPasso, postmasterConfigurado } from '../../../lib/postmaster';

export const prerender = false;

/** O slug da campanha no postmaster. shortcut: cadastrar `next-step` lá; sem ela o lead entra fora das campanhas. */
const CAMPANHA = 'next-step';
const LIMITE = 8;
const JANELA_MS = 10 * 60 * 1000;
const tentativas = new Map<string, { n: number; ate: number }>();
function dentroDoLimite(ip: string): boolean {
    const agora = Date.now();
    const t = tentativas.get(ip);
    if (!t || agora > t.ate) { tentativas.set(ip, { n: 1, ate: agora + JANELA_MS }); return true; }
    t.n++;
    return t.n <= LIMITE;
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

const curto = (v: unknown, max: number) => String(v ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, max);

export const POST: APIRoute = async ({ request, clientAddress }) => {
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || clientAddress || '').trim() || 'sem-ip';
    if (!dentroDoLimite(ip)) return json({ ok: false, error: 'limite' }, 429);

    let b: any;
    try {
        const txt = await request.text();
        if (txt.length > 8 * 1024) return json({ ok: false, error: 'grande' }, 413);
        b = JSON.parse(txt);
    } catch {
        return json({ ok: false, error: 'invalido' }, 400);
    }

    // Isca: robô que preenche tudo preenche isto também. Responde "ok" para ele não tentar de novo.
    if (String(b?.site ?? '').trim()) return json({ ok: true });

    const nome = String(b?.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const email = String(b?.email ?? '').trim().toLowerCase().slice(0, 200);
    const telefone = String(b?.telefone ?? '').replace(/\D/g, '').slice(0, 15);
    const erros: Record<string, string> = {};
    if (nome.length < 2) erros.nome = 'nome';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.email = 'email';
    if (telefone.length < 8) erros.telefone = 'telefone';
    const objetivo = ({ bp: 'bp', sub: 'preferencial', once: 'avulsa' } as const)[String(b?.objetivo ?? '') as 'bp' | 'sub' | 'once'];
    const pais = curto(b?.pais, 2).toUpperCase();
    const endereco = String(b?.endereco ?? '').trim().replace(/\s+/g, ' ').slice(0, 500);
    const quantidade = Number(b?.quantidade);
    if (!objetivo) erros.objetivo = 'objetivo';
    if (!/^[A-Z]{2}$/.test(pais)) erros.pais = 'pais';
    if (objetivo === 'avulsa' && endereco.length < 8) erros.endereco = 'endereco';
    if (objetivo === 'avulsa' && !(Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 99)) erros.quantidade = 'quantidade';
    if (b?.consentimento !== true) erros.consentimento = 'consentimento';
    if (Object.keys(erros).length) return json({ ok: false, erros }, 422);

    if (!postmasterConfigurado()) return json({ ok: false, error: 'indisponivel' }, 503);

    // O que a pessoa escolheu no formulário vai em utm_content, para o Brand Partner saber o que ela quer.
    // shortcut: o webhook só guarda campos conhecidos; trocar por campo próprio quando o postmaster tiver um.
    const escolha = [curto(b?.regiao, 12), curto(b?.objetivo, 12), curto(b?.sub, 12)].filter(Boolean).join('-');
    const origem: Record<string, string> = {};
    const fonte = curto(b?.origem?.utm_source, 40);
    if (fonte) origem.utm_source = fonte;
    if (escolha) origem.utm_content = escolha;

    const entregue = await avisarInscricaoNoPostmaster({ nome, email, ddi: '', telefone, origem, campanha: CAMPANHA })
        && await avisarProximoPasso({
            acao: 'formulario', objetivo: objetivo!, sub: curto(b?.sub, 4) || undefined, continente: curto(b?.regiao, 20), pais,
            comEntrega: false, codigo: fonte || undefined, nome, email, telefone,
            ...(objetivo === 'avulsa' ? { endereco, quantidade } : {}),
        });
    return entregue ? json({ ok: true }) : json({ ok: false, error: 'indisponivel' }, 502);
};
