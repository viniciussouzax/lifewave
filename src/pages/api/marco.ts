/**
 * api/marco.ts: um marco da pessoa no funil, pelo código dela (`pid`): entrou na apresentação (a sala de
 * espera abriu a sala do EverWebinar) ou chegou ao próximo passo. A régua de lembretes do postmaster usa.
 *
 * POST /api/marco (JSON)  { pid, marco: "entrou_sala" | "chegou_proximo_passo" }  →  { ok }
 */
import type { APIRoute } from 'astro';
import { marcarNoPostmaster, PID, type Marco } from '../../lib/postmaster';

export const prerender = false;

const MARCOS: Marco[] = ['entrou_sala', 'chegou_proximo_passo'];
const LIMITE = 30;
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

export const POST: APIRoute = async ({ request, clientAddress }) => {
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || clientAddress || '').trim() || 'sem-ip';
    if (!dentroDoLimite(ip)) return json({ ok: false }, 429);
    let b: any;
    try {
        const txt = await request.text();
        if (txt.length > 512) return json({ ok: false }, 413);
        b = JSON.parse(txt);
    } catch {
        return json({ ok: false }, 400);
    }
    const pid = String(b?.pid ?? '');
    const marco = MARCOS.find((m) => m === b?.marco);
    if (!PID.test(pid) || !marco) return json({ ok: false }, 400);
    return json({ ok: await marcarNoPostmaster(pid, marco) });
};
