/**
 * api/webinar/inscricao.ts — inscreve no webinar da home pela API do EverWebinar.
 *
 * POST /api/webinar/inscricao
 * Body: { horario: "schedule|date", nome, email, ddi: "+55", telefone, consentimento, whatsapp?, fuso: "GMT-3", origem?: { utm_* }, turnstile? }
 * → { ok: true, pid, sala: { userId, inicio, rotulo, liveRoomUrl, replayRoomUrl } }
 *
 * Regras do dono (18/11/2026): o cadastro NÃO PODE ser bloqueado, tem de ser rápido, não pode duplicar e
 * tem de deixar registro para auditar depois.
 * - Não bloqueia: o Turnstile só é anotado (conferido, sem, recusado...), nunca barra. A Cloudflare chegou a
 *   levar 13 s para decidir e o formulário não espera por ela. O que barra robô de verdade é o limite por IP.
 * - Limite: 20 envios válidos por IP a cada 10 min (in-memory). Campo errado não gasta o limite.
 * - Não duplica: o mesmo e-mail no mesmo webinar e horário, nos 30 min seguintes, recebe a MESMA resposta
 *   (o mesmo pid e a mesma sala) sem inscrever de novo; dois envios ao mesmo tempo (clique duplo, duas abas)
 *   esperam o primeiro. Vale por instância da função (in-memory).
 * - Registro: cada envio vai ao postmaster (`/tentativa`, sem dado pessoal: o e-mail vira hash lá) e ao log
 *   da Vercel numa linha `[inscricao] …`.
 *
 * - O código da pessoa (`pid`, funil Brand Partner): gerado aqui, vai ao postmaster (com a sala, o início e o
 *   consentimento do WhatsApp) e, com "campoPid" no webinar.json, a um campo personalizado do EverWebinar
 *   (o campo precisa existir lá com esse rótulo). O navegador guarda e leva em todo link.
 * - Origem: "camposOrigem" (webinar.json) diz em qual campo personalizado do webinar vai cada UTM
 *   ({ "ref": "utm_source" }); o campo precisa existir no EverWebinar com esse rótulo exato. Hoje o
 *   utm_source (o código dos links do postmaster, r…) vai no campo "ref"; o resto fica no tracking-kit.
 * - O rastreamento (Lead) é feito no navegador pelo tracking-kit, com o mesmo event_id no servidor.
 * - Sessão que acabou de começar (o minuto "Ao vivo" da página): se o EverWebinar recusar, inscreve
 *   na sessão seguinte (sessaoSeguinte), sem erro para a pessoa.
 * - O postmaster é avisado de cada inscrição com as UTMs (o utm_source é o código do link casca),
 *   para saber o dono, o canal e o perfil que trouxe a pessoa (lib/postmaster.ts).
 */
import { randomBytes } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import type { APIRoute } from 'astro';
import { readData } from '../../../lib/readData';
import { inscrever, normalizarFuso, readEverwebinarEnv, sessaoSeguinte, type Inscrito, type PedidoDeInscricao } from '../../../lib/everwebinar';
import { avisarInscricaoNoPostmaster, postmasterConfigurado, registrarTentativa, type TentativaDeInscricao } from '../../../lib/postmaster';
import { conferirTurnstile } from '../../../lib/turnstile';

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

type Resposta = { ok: true; pid: string; sala: Inscrito };
// shortcut: in-memory, vale por instância da função; se a Vercel abrir várias e duplicar, guardar a chave no postmaster.
const REPETIDA_MS = 30 * 60 * 1000;
const feitas = new Map<string, { resposta: Resposta; ate: number }>();
const emAndamento = new Map<string, Promise<Resposta | null>>();
function lembrar(chave: string, resposta: Resposta) {
    const agora = Date.now();
    for (const [k, v] of feitas) if (v.ate < agora) feitas.delete(k);
    feitas.set(chave, { resposta, ate: agora + REPETIDA_MS });
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
    // A mesma regra do formulário (duas palavras): o servidor não recusa o que a página aceitou.
    if (nome.split(' ').length < 2) erros.nome = 'Informe nome e sobrenome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.email = 'Informe um e-mail válido.';
    if (!/^\+\d{1,4}$/.test(ddi)) erros.telefone = 'Escolha o país do telefone.';
    else if (telefone.length < 6 || telefone.length + ddi.length - 1 > 15) erros.telefone = 'Confira o número do WhatsApp.';
    return {
        erros,
        dados: { nome, email, horario, ddi, telefone, consentimento: b?.consentimento === true, whatsapp: b?.whatsapp === true, fuso: normalizarFuso(b?.fuso) ?? 'GMT+0' },
    };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
    const inicio = Date.now();
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || clientAddress || '').trim() || null;
    // Cada envio deixa uma linha no log e uma no postmaster (depois da resposta: a pessoa não espera).
    const registrar = (t: TentativaDeInscricao) => {
        // O motivo vem do provedor: um e-mail que aparecer nele sai antes do log e do postmaster.
        const r = { ...t, motivo: t.motivo?.replace(/[^\s@]+@[^\s@]+/g, '…'), ms: Date.now() - inicio };
        const linha = `[inscricao] ${r.resultado} etapa=${r.etapa} turnstile=${r.turnstile ?? '-'} sessao=${r.sessao ?? '-'} user=${r.everwebinarUserId ?? '-'} ms=${r.ms}${r.motivo ? ` motivo=${r.motivo}` : ''}`;
        (r.resultado === 'erro' ? console.error : console.log)(linha);
        waitUntil(registrarTentativa(r).catch(() => {}));
    };

    let b: any;
    try {
        const txt = await request.text();
        if (txt.length > 8 * 1024) return json({ ok: false, error: 'Pedido grande demais.' }, 413);
        b = JSON.parse(txt);
    } catch {
        registrar({ resultado: 'recusada', etapa: 'corpo', motivo: 'JSON inválido' });
        return json({ ok: false, error: 'Pedido inválido.' }, 400);
    }

    const { erros, dados } = conferir(b);
    if (Object.keys(erros).length) {
        registrar({ resultado: 'recusada', etapa: 'validacao', motivo: Object.keys(erros).join(','), email: dados.email || undefined });
        return json({ ok: false, erros }, 422);
    }

    const cfg = readData('webinar.json', {}) as any;
    const webinarId = String(cfg?.webinarId ?? '').trim();
    const base = { email: dados.email, webinarId, sessao: dados.horario };

    // O mesmo envio de novo (a pessoa clicou de novo, voltou da sala, a rede caiu depois de inscrever): a mesma resposta.
    const chave = `${webinarId}|${dados.email}|${dados.horario}`;
    const feita = feitas.get(chave);
    if (feita && feita.ate > Date.now()) {
        registrar({ ...base, resultado: 'repetida', etapa: 'mesma_resposta', pid: feita.resposta.pid, everwebinarUserId: feita.resposta.sala.userId });
        return json(feita.resposta);
    }
    const andando = emAndamento.get(chave);
    if (andando) {
        const r = await andando;
        if (r) {
            registrar({ ...base, resultado: 'repetida', etapa: 'envio_simultaneo', pid: r.pid, everwebinarUserId: r.sala.userId });
            return json(r);
        }
    }

    if (!dentroDoLimite(ip ?? 'sem-ip')) {
        registrar({ ...base, resultado: 'recusada', etapa: 'limite', motivo: `mais de ${LIMITE} envios em 10 min do mesmo IP` });
        return json({ ok: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }, 429);
    }

    // A partir daqui este envio é O envio desta pessoa neste horário: outro igual que chegar espera por ele.
    // Sem nenhuma espera entre a conferência acima e esta marca (senão os dois passam e inscrevem duas vezes).
    let soltar!: (r: Resposta | null) => void;
    let feito: Resposta | null = null;
    emAndamento.set(chave, new Promise((ok) => { soltar = ok; }));
    try {
        // Navegador de verdade? Só anota: o cadastro não é barrado por isso (regra do dono, 18/11/2026).
        const humano = await conferirTurnstile(b?.turnstile, ip);
        const turnstile: TentativaDeInscricao['turnstile'] = humano.ok
            ? (humano.conferido ? 'conferido' : (process.env.TURNSTILE_SECRET ?? import.meta.env.TURNSTILE_SECRET ?? '').trim() ? 'indisponivel' : 'desligado')
            : humano.motivo === 'sem comprovante' ? 'sem' : 'recusado';

        const { key, fake } = readEverwebinarEnv();
        if (!webinarId || !key) {
            registrar({ ...base, turnstile, resultado: 'erro', etapa: 'indisponivel', motivo: !webinarId ? 'sem webinarId no webinar.json' : 'sem EVERWEBINAR_API_KEY' });
            return json({ ok: false, error: 'As inscrições estão indisponíveis agora. Tente de novo em instantes.' }, 503);
        }

        const pid = randomBytes(16).toString('base64url');
        const extras: Record<string, string> = {};
        const campoPid = String(cfg?.campoPid ?? '').trim();
        if (campoPid) extras[campoPid] = pid;
        // camposOrigem: { "<rótulo do campo no EverWebinar>": "<utm>" } (ex.: { "ref": "utm_source" });
        // a lista antiga (["utm_source"]) manda cada utm num campo com o mesmo nome.
        const mapa: Record<string, unknown> = Array.isArray(cfg?.camposOrigem)
            ? Object.fromEntries(cfg.camposOrigem.map((k: string) => [k, k]))
            : cfg?.camposOrigem && typeof cfg.camposOrigem === 'object' ? cfg.camposOrigem : {};
        if (b?.origem && typeof b.origem === 'object') {
            for (const [campo, utm] of Object.entries(mapa)) {
                if (typeof utm !== 'string' || !UTM.includes(utm)) continue;
                const v = String(b.origem[utm] ?? '').trim().slice(0, 100);
                if (v) extras[campo] = v;
            }
        }

        let etapa = 'everwebinar';
        const trabalho = (async (): Promise<Resposta> => {
            const pedido: PedidoDeInscricao = {
                webinarId, horarioId: dados.horario, nome: dados.nome, email: dados.email,
                ddi: dados.ddi, telefone: dados.telefone, consentimentoSms: dados.consentimento,
                fuso: dados.fuso, ip, extras,
            };
            let r: Inscrito;
            try {
                r = await inscrever(key, pedido, fake);
            } catch (e) {
                // A sessão já começou e o EverWebinar recusou? Inscreve na seguinte; senão, o erro segue.
                const seguinte = await sessaoSeguinte(key, webinarId, dados.fuso, dados.horario, fake).catch(() => null);
                if (!seguinte) throw e;
                console.warn(`[everwebinar] sessão ${dados.horario} recusada (${(e as Error).message}); inscrevendo na seguinte, ${seguinte}`);
                etapa = 'sessao_seguinte';
                r = await inscrever(key, { ...pedido, horarioId: seguinte }, fake);
            }
            return { ok: true, pid, sala: r };
        })();
        try {
            const resposta = await trabalho;
            feito = resposta;
            const r = resposta.sala;
            lembrar(chave, resposta);
            // Inscrita no EverWebinar. Sem o link da sala ainda é inscrição (o e-mail dele leva o link): não vira
            // erro, que faria a pessoa tentar de novo; fica anotado para auditar.
            registrar({ ...base, turnstile, resultado: 'ok', etapa: r.liveRoomUrl ? etapa : 'sem_sala', pid, everwebinarUserId: r.userId, sessao: r.rotulo || dados.horario });
            // Avisa o postmaster (com o código de origem) sem deixar falha dele afetar a resposta.
            // Depois da resposta (waitUntil): o aviso tem até 2,5 s + 4 s e a pessoa não espera por ele.
            const origem: Record<string, string> = {};
            if (b?.origem && typeof b.origem === 'object') {
                for (const k of UTM) if (typeof b.origem[k] === 'string') origem[k] = b.origem[k];
            }
            waitUntil(avisarInscricaoNoPostmaster({
                nome: dados.nome, email: dados.email, ddi: dados.ddi, telefone: dados.telefone, origem,
                webinarId, sessao: r.rotulo, everwebinarUserId: r.userId,
                pid, salaUrl: r.liveRoomUrl || undefined, replayUrl: r.replayRoomUrl || undefined, inicio: r.inicio || undefined, whatsapp: dados.whatsapp,
            }).then((aceito) => { if (!aceito && postmasterConfigurado()) registrar({ ...base, resultado: 'erro', etapa: 'aviso_postmaster', motivo: 'o postmaster não recebeu a inscrição (ver [postmaster] no log)', pid }); })
                .catch((e) => console.error('[postmaster] aviso da inscrição:', (e as Error).message)));
            return json(resposta);
        } catch (e) {
            registrar({ ...base, turnstile, resultado: 'erro', etapa, motivo: (e as Error).message.slice(0, 300) });
            return json({ ok: false, error: 'Não foi possível concluir a sua inscrição agora. Tente de novo em instantes.' }, 502);
        }
    } finally {
        emAndamento.delete(chave);
        soltar(feito);
    }
};
