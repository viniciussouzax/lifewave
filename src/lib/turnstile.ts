/**
 * turnstile.ts — confere o comprovante do Turnstile (Cloudflare) que o formulário manda junto com a
 * inscrição: a prova de que quem envia é um navegador de verdade, e não um script criando inscrições
 * falsas (que viram lead no postmaster e, com consentimento de SMS, mensagens pagas no EverWebinar).
 *
 * Env: TURNSTILE_SECRET (o segredo do widget "brandpartner-formularios"). Sem ele, não confere nada:
 * é assim que a proteção é ligada depois de os formulários já mandarem o comprovante.
 *
 * Política: sem comprovante, ou comprovante recusado, a inscrição é recusada. Se a própria Cloudflare
 * não responder (rede, 5xx, demora de 4 s), a inscrição passa: uma falha deles não barra gente de verdade.
 */

const VERIFICAR = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type ResultadoTurnstile = { ok: true; conferido: boolean } | { ok: false; motivo: string };

export async function conferirTurnstile(token: unknown, ip: string | null): Promise<ResultadoTurnstile> {
    const segredo = (process.env.TURNSTILE_SECRET ?? import.meta.env.TURNSTILE_SECRET ?? '').trim();
    if (!segredo) return { ok: true, conferido: false };
    const t = typeof token === 'string' ? token.trim() : '';
    if (!t || t.length > 2048) return { ok: false, motivo: 'sem comprovante' };
    const corpo = new URLSearchParams({ secret: segredo, response: t });
    if (ip) corpo.set('remoteip', ip);
    try {
        const res = await fetch(VERIFICAR, { method: 'POST', body: corpo, signal: AbortSignal.timeout(4000) });
        if (!res.ok) {
            console.error(`[turnstile] a Cloudflare respondeu ${res.status}: inscrição liberada sem conferir`);
            return { ok: true, conferido: false };
        }
        const r = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
        return r.success ? { ok: true, conferido: true } : { ok: false, motivo: (r['error-codes'] ?? []).join(',') || 'recusado' };
    } catch (e) {
        console.error('[turnstile] a Cloudflare não respondeu: inscrição liberada sem conferir:', (e as Error).message);
        return { ok: true, conferido: false };
    }
}
