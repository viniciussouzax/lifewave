/**
 * api/pessoa.ts: quem é o dono de um código de pessoa (`pid`), para a sala de espera e o próximo passo
 * reconhecerem a pessoa em outro aparelho (o link identifica; o aparelho confirma).
 *
 * GET /api/pessoa?pid=<22 caracteres>
 * → { ok: true, pessoa: null | { primeiroNome, codigo, nomeIndicacao, inicio, salaUrl, emailMascarado, telefoneMascarado } }
 *
 * O postmaster resolve (lib/postmaster.ts, `/pessoa`); e-mail e telefone chegam só mascarados. Limite por IP.
 */
import type { APIRoute } from 'astro';
import { PID, pessoaDoPid } from '../../lib/postmaster';

export const prerender = false;

const LIMITE = 60;
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
    if (!dentroDoLimite(ip)) return json({ ok: false, pessoa: null }, 429);
    const pid = String(url.searchParams.get('pid') ?? '').trim();
    if (!PID.test(pid)) return json({ ok: true, pessoa: null });
    return json({ ok: true, pessoa: await pessoaDoPid(pid) });
};
