/**
 * api/proximo-passo/registro.ts: a pessoa de um país com entrega abriu o link da LifeWave pela passagem
 * /proximo-passo/cadastro/. Sem dado pessoal: só objetivo, país e o código de quem trouxe, para o postmaster contar.
 *
 * POST /api/proximo-passo/registro (JSON; text/plain é barrado pela checagem de origem do Astro)
 * Body: { objetivo: "bp" | "preferencial", sub?, continente, pais, codigo? }  →  { ok }
 */
import type { APIRoute } from 'astro';
import { avisarProximoPasso, PID } from '../../../lib/postmaster';

export const prerender = false;

const LIMITE = 20;
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

const OBJETIVOS = ['bp', 'preferencial'] as const;
const curto = (v: unknown, max: number) => String(v ?? '').trim().replace(/[^A-Za-z0-9_.-]/g, '').slice(0, max);

export const POST: APIRoute = async ({ request, clientAddress }) => {
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || clientAddress || '').trim() || 'sem-ip';
    if (!dentroDoLimite(ip)) return json({ ok: false }, 429);
    let b: any;
    try {
        const txt = await request.text();
        if (txt.length > 2048) return json({ ok: false }, 413);
        b = JSON.parse(txt);
    } catch {
        return json({ ok: false }, 400);
    }
    const objetivo = OBJETIVOS.find((o) => o === b?.objetivo);
    // O valor inteiro tem de ser o código: "Brasil" não vira "BR" por corte.
    const pais = String(b?.pais ?? '').trim().toUpperCase();
    const continente = String(b?.continente ?? '').trim();
    if (!objetivo || !/^[A-Z]{2}$/.test(pais) || !/^[a-z]{2}$/.test(continente)) return json({ ok: false }, 400);
    const ok = !!await avisarProximoPasso({
        acao: 'link', objetivo, sub: curto(b?.sub, 4) || undefined, continente, pais, comEntrega: true,
        codigo: curto(b?.codigo, 40) || undefined,
        ...(PID.test(String(b?.pid ?? '')) ? { pid: String(b.pid) } : {}),
    });
    return json({ ok }, ok ? 200 : 502);
};
