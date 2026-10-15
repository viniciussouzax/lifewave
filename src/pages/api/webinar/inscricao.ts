/**
 * api/webinar/inscricao.ts — inscreve no webinar da home pela API do EverWebinar.
 *
 * POST /api/webinar/inscricao
 * Body: { horario: "schedule|date", nome, email, ddi: "+55", telefone, consentimento, fuso: "GMT-3", origem?: { utm_* } }
 * → { ok: true, sala: { inicio, rotulo, liveRoomUrl, replayRoomUrl } }
 *
 * - Valida os campos (mensagens em pt-BR, por campo)
 * - Rate limit: 8 por IP a cada 10 min (in-memory, como o /api/subscribe)
 * - Origem: as UTMs listadas em "camposOrigem" (webinar.json) vão como campos personalizados do
 *   webinar — cada uma precisa existir no EverWebinar com esse rótulo exato. Hoje só utm_source,
 *   que leva o código dos links do postmaster (r…) até o webhook dele; o resto fica no tracking-kit.
 * - O rastreamento (Lead) é feito no navegador pelo tracking-kit, com o mesmo event_id no servidor.
 */
import type { APIRoute } from 'astro';
import { readData } from '../../../lib/readData';
import { inscrever, normalizarFuso, readEverwebinarEnv } from '../../../lib/everwebinar';

export const prerender = false;

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

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function conferir(b: any) {
    const erros: Record<string, string> = {};
    const nome = String(b?.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const email = String(b?.email ?? '').trim().toLowerCase().slice(0, 200);
    const horario = String(b?.horario ?? '').trim().slice(0, 200);
    const ddi = String(b?.ddi ?? '').trim();
    const telefone = String(b?.telefone ?? '').replace(/\D/g, '').replace(/^0+/, '');
    if (!/^[^|]{1,80}\|.{0,60}$/.test(horario)) erros.horario = 'Escolha um horário.';
    if (nome.split(' ').length < 2 || nome.length < 4) erros.nome = 'Informe nome e sobrenome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.email = 'Informe um e-mail válido.';
    if (!/^\+\d{1,4}$/.test(ddi)) erros.telefone = 'Escolha o país do telefone.';
    else if (telefone.length < 6 || telefone.length + ddi.length - 1 > 15) erros.telefone = 'Confira o número do WhatsApp.';
    return {
        erros,
        dados: { nome, email, horario, ddi, telefone, consentimento: b?.consentimento === true, fuso: normalizarFuso(b?.fuso) ?? 'GMT+0' },
    };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || clientAddress || '').trim() || null;
    if (!dentroDoLimite(ip ?? 'sem-ip')) return json({ ok: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }, 429);

    let b: any;
    try {
        const txt = await request.text();
        if (txt.length > 8 * 1024) return json({ ok: false, error: 'Pedido grande demais.' }, 413);
        b = JSON.parse(txt);
    } catch {
        return json({ ok: false, error: 'Pedido inválido.' }, 400);
    }

    const { erros, dados } = conferir(b);
    if (Object.keys(erros).length) return json({ ok: false, erros }, 422);

    const cfg = readData('webinar.json', {}) as any;
    const webinarId = String(cfg?.webinarId ?? '').trim();
    const { key, fake } = readEverwebinarEnv();
    if (!webinarId || !key) return json({ ok: false, error: 'As inscrições estão indisponíveis agora. Tente de novo em instantes.' }, 503);

    const extras: Record<string, string> = {};
    const camposOrigem: string[] = Array.isArray(cfg?.camposOrigem) ? cfg.camposOrigem.filter((k: string) => UTM.includes(k)) : [];
    if (camposOrigem.length && b?.origem && typeof b.origem === 'object') {
        for (const k of camposOrigem) {
            const v = String(b.origem[k] ?? '').trim().slice(0, 100);
            if (v) extras[k] = v;
        }
    }

    try {
        const r = await inscrever(key, {
            webinarId, horarioId: dados.horario, nome: dados.nome, email: dados.email,
            ddi: dados.ddi, telefone: dados.telefone, consentimentoSms: dados.consentimento,
            fuso: dados.fuso, ip, extras,
        }, fake);
        if (!r.liveRoomUrl) throw new Error('inscrição sem link da sala');
        return json({ ok: true, sala: r });
    } catch (e) {
        console.error('[erro everwebinar] inscrição:', (e as Error).message);
        return json({ ok: false, error: 'Não foi possível concluir a sua inscrição agora. Tente de novo em instantes.' }, 502);
    }
};
