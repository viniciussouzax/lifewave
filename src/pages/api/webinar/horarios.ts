/**
 * api/webinar/horarios.ts — horários do webinar da home, no fuso de quem vê.
 *
 * GET /api/webinar/horarios?fuso=GMT-3
 * → { ok: true, horarios: [{ id, inicio, rotulo }], pais: "BR" | null, cidade: "São Paulo" | null }
 *
 * `pais` e `cidade` são de quem acessa, pelo IP (cabeçalhos x-vercel-ip-country e x-vercel-ip-city
 * da Vercel): o formulário usa o país para o DDI do telefone e mostra "cidade, país" junto da data.
 *
 * Cache em memória de 60 s por fuso (cada fuso é uma chamada ao EverWebinar). A chave da API
 * nunca sai do servidor; o erro do provedor vai só para o log.
 */
import type { APIRoute } from 'astro';
import { readData } from '../../../lib/readData';
import { horariosDoWebinar, normalizarFuso, readEverwebinarEnv, type Horario } from '../../../lib/everwebinar';

export const prerender = false;

const CACHE_MS = 60_000;
const cache = new Map<string, { em: number; horarios: Horario[] }>();

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

/** A Vercel manda a cidade codificada para URL ("S%C3%A3o%20Paulo"). Só texto curto e sem marcação. */
function cidadeDoIp(bruto: string | null): string | null {
    if (!bruto) return null;
    let c = bruto;
    try { c = decodeURIComponent(bruto); } catch { /* fica como veio */ }
    c = c.replace(/[<>"]/g, '').trim();
    return c && c.length <= 60 ? c : null;
}

export const GET: APIRoute = async ({ url, request }) => {
    const ipPais = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
    const pais = /^[A-Z]{2}$/.test(ipPais) ? ipPais : null;
    const cidade = cidadeDoIp(request.headers.get('x-vercel-ip-city'));
    const fuso = normalizarFuso(url.searchParams.get('fuso')) ?? 'GMT+0';
    const cfg = readData('webinar.json', {}) as any;
    const webinarId = String(cfg?.webinarId ?? '').trim();
    const { key, fake } = readEverwebinarEnv();
    if (!webinarId || !key) return json({ ok: false, error: 'indisponivel' }, 503);

    const hit = cache.get(fuso);
    if (hit && Date.now() - hit.em < CACHE_MS) return json({ ok: true, horarios: hit.horarios, pais, cidade }, 200, { 'Cache-Control': 'no-store' });

    try {
        const { horarios } = await horariosDoWebinar(key, webinarId, fuso, fake);
        // Só o que ainda não começou (com margem de 1 min); sem instante calculado, mantém.
        const agora = Date.now() - 60_000;
        const futuros = horarios.filter((h) => !h.inicio || new Date(h.inicio).getTime() > agora);
        cache.set(fuso, { em: Date.now(), horarios: futuros });
        return json({ ok: true, horarios: futuros, pais, cidade }, 200, { 'Cache-Control': 'no-store' });
    } catch (e) {
        console.error('[erro everwebinar] horários:', (e as Error).message);
        return json({ ok: false, error: 'indisponivel' }, 502);
    }
};
