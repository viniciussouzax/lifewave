/**
 * api/proximo-passo/indicacao.ts: o nome do canal de quem trouxe na LifeWave, para o /proximo-passo montar o link certo.
 *
 * GET /api/proximo-passo/indicacao?codigo=<utm_source>  →  { nome: "maria" | null }
 *
 * O postmaster resolve o código (lib/postmaster.ts `nomeDeQuemTrouxe`) e devolve só o nome do link do canal; nada
 * mais sai daqui. Sem resposta, `nome: null` e o /proximo-passo usa o link do administrador. Limite por IP.
 */
import type { APIRoute } from 'astro';
import { nomeDeQuemTrouxe } from '../../../lib/postmaster';

export const prerender = false;

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

export const GET: APIRoute = async ({ request, url, clientAddress }) => {
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || clientAddress || '').trim() || 'sem-ip';
    if (!dentroDoLimite(ip)) return json({ nome: null }, 429);
    const codigo = String(url.searchParams.get('codigo') ?? '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(codigo)) return json({ nome: null });
    return json({ nome: await nomeDeQuemTrouxe(codigo) });
};
