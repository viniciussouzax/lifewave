/**
 * postmaster.ts — avisa o postmaster de cada inscrição feita na home, pelo webhook de webinar dele.
 *
 * Os links casca do postmaster (lifewave.brandpartner.team/pt?utm_source=r…) chegam à home com o
 * código de quem divulgou no `utm_source`. A inscrição pela API do EverWebinar não leva esse código,
 * então é daqui que ele vai: o postmaster resolve o código em dono, canal, perfil e ponto de contato
 * (codigo_publico → connection/account) e grava o lead. Os avisos seguintes do EverWebinar (assistiu,
 * comprou…) chegam ao mesmo lead pelo e-mail.
 *
 * A campanha: a home é a porta de inscrição do webinar, então todo aviso daqui vai com
 * `campanha: "webinar"` (o slug da campanha no postmaster). Sem ela cadastrada lá, o postmaster
 * ainda grava o lead, só que fora das campanhas.
 *
 * Env:
 *   POSTMASTER_WEBHOOK_URL     o endereço do webhook do projeto, como o postmaster mostra
 *                              (https://…/api/webhooks/webinar/<projeto>); aqui acrescenta /inscricao
 *   POSTMASTER_WEBHOOK_SECRET  o segredo do webhook do projeto (pmw_…)
 * Sem os dois, não faz nada. Nunca atrapalha a inscrição: erro e demora só vão para o log.
 *
 * Duas tentativas (2,5 s e depois 4 s), a segunda só em falha de rede, demora ou erro do lado do
 * postmaster (5xx, 429): este aviso é o ÚNICO caminho do código de quem divulgou até lá (o aviso
 * do EverWebinar não o leva), então uma oscilação não pode apagar a origem. Recusa (4xx) não se
 * repete. A repetição não duplica: o postmaster grava o mesmo evento uma vez só (chave do evento).
 */

export interface AvisoDeInscricao {
    nome: string; email: string; ddi: string; telefone: string;
    origem: Record<string, string>;
    webinarId?: string; sessao?: string; everwebinarUserId?: string;
    /** Outra campanha do postmaster que não a do webinar (ex.: o formulário da CTA final). */
    campanha?: string;
    /** O código da pessoa (funil Brand Partner): vai em todo link; o postmaster guarda na inscrição. */
    pid?: string;
    /** O link pessoal da sala do EverWebinar e o início da sessão (ISO): a sala de espera de outro aparelho usa. */
    salaUrl?: string; inicio?: string;
    /** O link pessoal da reprise no EverWebinar: a mensagem de quem perdeu leva a ele. */
    replayUrl?: string;
    /** A pessoa aceitou receber os lembretes pelo WhatsApp. */
    whatsapp?: boolean;
}

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
/** O slug da campanha do webinar no postmaster (= o nome da página e do subdomínio). */
const CAMPANHA = 'webinar';

function lerEnv() {
    const url = (process.env.POSTMASTER_WEBHOOK_URL ?? import.meta.env.POSTMASTER_WEBHOOK_URL ?? '').trim().replace(/\/+$/, '');
    const segredo = (process.env.POSTMASTER_WEBHOOK_SECRET ?? import.meta.env.POSTMASTER_WEBHOOK_SECRET ?? '').trim();
    return { url, segredo };
}

/** O aviso está ligado (URL https e segredo no ambiente)? */
export function postmasterConfigurado(): boolean {
    const { url, segredo } = lerEnv();
    return !!url && !!segredo && /^https:\/\//.test(url);
}

/** true se o postmaster aceitou o aviso; quem só quer registrar a origem (a home) ignora o retorno. */
export async function avisarInscricaoNoPostmaster(a: AvisoDeInscricao): Promise<boolean> {
    const { url, segredo } = lerEnv();
    if (!url || !segredo || !/^https:\/\//.test(url)) return false;
    const [primeiro, ...resto] = a.nome.split(' ');
    const corpo: Record<string, string> = {
        email: a.email,
        first_name: primeiro ?? '',
        last_name: resto.join(' '),
        phone_country_code: a.ddi,
        phone: a.telefone,
        webinar_id: a.webinarId ?? '',
        date: a.sessao ?? '',
        everwebinar_user_id: a.everwebinarUserId ?? '',
        site: 'brandpartner.team',
        campanha: a.campanha || CAMPANHA,
        ...(a.pid ? { pid: a.pid } : {}),
        ...(a.salaUrl ? { sala_url: a.salaUrl } : {}),
        ...(a.replayUrl ? { replay_url: a.replayUrl } : {}),
        ...(a.inicio ? { session_start: a.inicio } : {}),
        ...(a.whatsapp ? { whatsapp_consent: '1' } : {}),
    };
    for (const k of UTM) {
        const v = String(a.origem?.[k] ?? '').trim().slice(0, 100);
        if (v) corpo[k] = v;
    }
    for (const [i, limite] of [2500, 4000].entries()) {
        try {
            const res = await fetch(`${url}/inscricao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segredo}` },
                body: JSON.stringify(corpo),
                signal: AbortSignal.timeout(limite),
            });
            if (res.ok) return true;
            const motivo = `${res.status} ${(await res.text()).slice(0, 200)}`;
            if (res.status < 500 && res.status !== 429) { console.error(`[postmaster] inscrição recusada: ${motivo}`); return false; }
            console.error(`[postmaster] tentativa ${i + 1} falhou: ${motivo}`);
        } catch (e) {
            console.error(`[postmaster] tentativa ${i + 1} não avisou:`, (e as Error).message);
        }
    }
    return false;
}

/** POST num caminho do webhook do projeto (`<url>/<caminho>`), com o segredo; o JSON da resposta ou null. Uma tentativa. */
async function chamarPostmaster(caminho: string, corpo: unknown, limiteMs: number): Promise<any> {
    const { url, segredo } = lerEnv();
    if (!url || !segredo || !/^https:\/\//.test(url)) return null;
    try {
        const res = await fetch(`${url}/${caminho}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segredo}` },
            body: JSON.stringify(corpo),
            signal: AbortSignal.timeout(limiteMs),
        });
        if (!res.ok) { console.error(`[postmaster] ${caminho}: ${res.status} ${(await res.text()).slice(0, 200)}`); return null; }
        return await res.json();
    } catch (e) {
        console.error(`[postmaster] ${caminho}:`, (e as Error).message);
        return null;
    }
}

/**
 * O nome do canal de quem trouxe na LifeWave (lifewave.com/<nome>), resolvido pelo postmaster a partir do código
 * (`utm_source`). null = sem canal com link (o /proximo-passo usa o do administrador).
 */
export async function nomeDeQuemTrouxe(codigo: string): Promise<string | null> {
    const j = await chamarPostmaster('indicacao', { codigo }, 3000);
    const nome = typeof j?.nome === 'string' ? j.nome : '';
    return /^[A-Za-z0-9._-]{1,80}$/.test(nome) ? nome : null;
}

export interface ProximoPasso {
    acao: 'link' | 'formulario';
    objetivo: 'bp' | 'preferencial';
    sub?: string; continente: string; pais: string; comEntrega: boolean; codigo?: string; pid?: string;
    nome?: string; email?: string; ddi?: string; telefone?: string;
}

/** A escolha da pessoa no /proximo-passo vai ao postmaster, que avisa quem trouxe. false = não gravado; no
 *  formulário, `whatsapp` é o número do canal de WhatsApp do projeto (o botão da confirmação), ou null. */
export async function avisarProximoPasso(p: ProximoPasso): Promise<false | { whatsapp: string | null }> {
    const j = await chamarPostmaster('proximo-passo', p, 8000);
    if (!j?.ok) return false;
    return { whatsapp: typeof j.whatsapp === 'string' && /^\d{8,15}$/.test(j.whatsapp) ? j.whatsapp : null };
}

export interface TentativaDeInscricao {
    resultado: 'ok' | 'repetida' | 'recusada' | 'erro';
    /** Onde parou ou o que valeu: validacao, limite, indisponivel, everwebinar, sessao_seguinte, sem_sala... */
    etapa: string;
    /** O texto do erro (do provedor), sem dado pessoal. */
    motivo?: string;
    /** Vira hash no postmaster; não é guardado. */
    email?: string;
    webinarId?: string; sessao?: string; everwebinarUserId?: string; pid?: string;
    turnstile?: 'conferido' | 'sem' | 'recusado' | 'desligado' | 'indisponivel';
    ms?: number;
}
/**
 * Cada envio do formulário de inscrição vai ao postmaster (`/tentativa`), para auditar depois: o log da
 * Vercel guarda só 1 hora. Uma tentativa, nunca atrapalha a inscrição (quem chama não espera).
 */
export async function registrarTentativa(t: TentativaDeInscricao): Promise<void> {
    await chamarPostmaster('tentativa', t, 4000);
}

/** O formato do código da pessoa: 16 bytes aleatórios em base64url. */
export const PID = /^[A-Za-z0-9_-]{22}$/;

export interface PessoaDoPid {
    primeiroNome: string; codigo: string | null; nomeIndicacao: string | null; inicio: number | null;
    salaUrl: string | null; emailMascarado: string; telefoneMascarado: string;
}
/** Quem é o dono de um código de pessoa (`/pessoa` do postmaster); null = desconhecido ou fora do ar. */
export async function pessoaDoPid(pid: string): Promise<PessoaDoPid | null> {
    if (!PID.test(pid)) return null;
    return (await chamarPostmaster('pessoa', { pid }, 3000))?.pessoa ?? null;
}

export type Marco = 'entrou_sala' | 'chegou_proximo_passo';
/** Um marco da pessoa no funil (`/marco` do postmaster): a régua de lembretes usa. */
export async function marcarNoPostmaster(pid: string, marco: Marco): Promise<boolean> {
    if (!PID.test(pid)) return false;
    return !!(await chamarPostmaster('marco', { pid, marco }, 3000))?.ok;
}
