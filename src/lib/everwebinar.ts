/**
 * everwebinar.ts — cliente da API do EverWebinar (WebinarJam) para o formulário próprio da home.
 *
 * Contrato (documentação oficial; mesmo cliente já testado no postmaster): tudo POST com corpo
 * form-urlencoded e `api_key` sempre no corpo, nunca na URL.
 *   · /everwebinar/webinar  (webinar_id, timezone) → { webinar: { title, schedules: [{ date, schedule, comment }], timezone } }
 *     Com "Auto-detect the user's time zone", os horários já vêm no fuso pedido ("GMT-3").
 *   · /everwebinar/register (webinar_id, first_name, email, schedule, date?, last_name?, timezone?,
 *     ip_address?, phone_country_code "+55", phone só dígitos, twilio_consent 1/0 — obrigatório com telefone;
 *     campos personalizados: o rótulo do campo é o nome do parâmetro)
 *     → { user: { user_id, live_room_url, replay_room_url, thank_you_url, date, timezone } }
 *
 * A chave (EVERWEBINAR_API_KEY) é lida em runtime e nunca vai para o navegador nem para log.
 * Em dev, EVERWEBINAR_FAKE=1 usa o EverWebinar simulado (everwebinarFake.ts).
 */
import { fakeEverwebinar } from './everwebinarFake';

const BASE = 'https://api.webinarjam.com/everwebinar';
const TIMEOUT_MS = 12_000;

export class EverwebinarError extends Error {}

export function readEverwebinarEnv() {
    const key = (process.env.EVERWEBINAR_API_KEY ?? import.meta.env.EVERWEBINAR_API_KEY ?? '').trim();
    const fake = import.meta.env.DEV && (process.env.EVERWEBINAR_FAKE ?? import.meta.env.EVERWEBINAR_FAKE) === '1';
    return { key: fake ? 'ew-falsa-local' : key, fake };
}

// ───────────── fuso e horário (puras) ─────────────

/** Deslocamento do navegador em minutos (-180) → "GMT-3"; 330 → "GMT+5:30". */
export function fusoDoDeslocamento(minutos: number): string {
    const sinal = minutos < 0 ? '-' : '+';
    const abs = Math.abs(Math.round(minutos));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `GMT${sinal}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** "GMT-3", "GMT+05:30" → minutos; só deslocamentos reais (-12 a +14). Outra coisa → null. */
export function minutosDoFuso(bruto: unknown): number | null {
    const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(String(bruto ?? '').trim().replace(/\s+/g, ''));
    if (!m) return null;
    const min = m[3] ? Number(m[3]) : 0;
    if (![0, 15, 30, 45].includes(min)) return null;
    const total = (Number(m[2]) * 60 + min) * (m[1] === '-' ? -1 : 1);
    return total >= -720 && total <= 840 ? total : null;
}

export function normalizarFuso(bruto: unknown): string | null {
    const m = minutosDoFuso(bruto);
    return m === null ? null : fusoDoDeslocamento(m);
}

/** Deslocamento (min) de um fuso IANA ("America/New_York") num instante. Inválido → null. */
function deslocamentoIana(tz: string, instante: Date): number | null {
    try {
        const p = Object.fromEntries(
            new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                .formatToParts(instante).map((x) => [x.type, x.value]),
        );
        const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
        return Math.round((comoUtc - instante.getTime()) / 60000);
    } catch {
        return null;
    }
}

/**
 * "2026-10-20 20:00" no fuso dado → instante ISO (UTC). O fuso pode ser "GMT-3" ou um nome IANA.
 * Formato que não reconhecemos → null (a página mostra o rótulo do EverWebinar e não conta tempo).
 */
export function inicioEmUtc(date: string, fuso: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(String(date ?? '').trim());
    if (!m) return null;
    const comoUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    let desloc = minutosDoFuso(fuso);
    if (desloc === null && fuso) {
        const d1 = deslocamentoIana(fuso, new Date(comoUtc));
        desloc = d1 === null ? null : (deslocamentoIana(fuso, new Date(comoUtc - d1 * 60000)) ?? d1);
    }
    if (desloc === null) return null;
    return new Date(comoUtc - desloc * 60000).toISOString();
}

/** "Maria da Silva" → { primeiro: "Maria", sobrenome: "da Silva" }. */
export function separarNome(nome: string) {
    const partes = String(nome ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    return { primeiro: partes[0] ?? '', sobrenome: partes.slice(1).join(' ') };
}

// ───────────── chamada ─────────────

const texto = (v: unknown, max = 500) => (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);

async function chamar(caminho: string, params: Record<string, string | undefined>, chave: string, fake: boolean): Promise<any> {
    const corpo = new URLSearchParams();
    corpo.set('api_key', chave);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') corpo.set(k, v);
    const url = `${BASE}/${caminho}`;
    const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: corpo.toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    };
    let res: Response;
    try {
        res = fake ? fakeEverwebinar(url, init) : await fetch(url, init);
    } catch (e) {
        const nome = (e as Error)?.name;
        throw new EverwebinarError(nome === 'TimeoutError' || nome === 'AbortError' ? 'o EverWebinar não respondeu a tempo' : 'falha de rede ao falar com o EverWebinar');
    }
    const cru = await res.text().catch(() => '');
    let j: any = null;
    try { j = cru ? JSON.parse(cru) : null; } catch { j = null; }
    const status = String(j?.status ?? '').toLowerCase();
    if (!res.ok || ['error', 'fail', 'failed'].includes(status)) {
        const msg = texto(j?.message ?? j?.error ?? '', 200).split(chave).join('…');
        throw new EverwebinarError(`EverWebinar HTTP ${res.status}${msg ? `: ${msg}` : ''}`);
    }
    if (!j || typeof j !== 'object') throw new EverwebinarError(`EverWebinar respondeu algo que não é JSON (HTTP ${res.status})`);
    return j;
}

// ───────────── operações ─────────────

export interface Horario {
    /** O que a página devolve no envio: `schedule|date`, exatamente como vieram. */
    id: string;
    /** Instante de início (ISO, UTC) quando dá para calcular; senão null. */
    inicio: string | null;
    rotulo: string;
}

export interface WebinarComHorarios { titulo: string; horarios: Horario[] }

/** O webinar com os horários no fuso pedido. */
export async function horariosDoWebinar(chave: string, webinarId: string, fuso: string, fake = false): Promise<WebinarComHorarios> {
    const j = await chamar('webinar', { webinar_id: webinarId, timezone: fuso }, chave, fake);
    const w = j?.webinar ?? j?.data ?? j;
    // Fuso dos horários: o do webinar quando é fixo; com auto-detect, o que pedimos.
    const fusoDoWebinar = texto(w?.timezone, 60);
    const fusoDosHorarios = minutosDoFuso(fusoDoWebinar) !== null || /^[A-Za-z]+\/[A-Za-z_]+/.test(fusoDoWebinar) ? fusoDoWebinar : fuso;
    const lista = Array.isArray(w?.schedules) ? w.schedules : [];
    const horarios: Horario[] = [];
    for (const s of lista) {
        if (!s || typeof s !== 'object') continue; // textos soltos ("Every day, 8 PM") não inscrevem
        const schedule = texto(s.schedule ?? s.schedule_id ?? s.id, 80);
        const date = texto(s.date, 60);
        if (!schedule) continue;
        horarios.push({ id: `${schedule}|${date}`, inicio: inicioEmUtc(date, fusoDosHorarios), rotulo: texto(s.comment, 200) || date });
    }
    return { titulo: texto(w?.title, 200), horarios };
}

/**
 * O PLANO B da inscrição na sessão que acabou de começar (pedido do dono, 17/10/2026): a página
 * deixa a sessão "Ao vivo" escolhida por 1 minuto, e quem se inscreve nesse minuto entra nela. Se o
 * EverWebinar recusar (sessão já começada), a inscrição vai para a seguinte. Devolve o id da sessão
 * seguinte, ou null quando a pedida ainda está no futuro (a recusa foi por outro motivo, não é caso
 * de trocar) ou quando não há sessão seguinte.
 */
export async function sessaoSeguinte(chave: string, webinarId: string, fuso: string, horarioId: string, fake = false, agora = Date.now()): Promise<string | null> {
    const { horarios } = await horariosDoWebinar(chave, webinarId, fuso, fake);
    const pedida = horarios.find((h) => h.id === horarioId);
    if (pedida && (!pedida.inicio || new Date(pedida.inicio).getTime() > agora)) return null;
    const futuras = horarios.filter((h) => h.inicio && new Date(h.inicio).getTime() > agora);
    futuras.sort((a, b) => new Date(a.inicio!).getTime() - new Date(b.inicio!).getTime());
    return futuras[0]?.id ?? null;
}

export interface PedidoDeInscricao {
    webinarId: string; horarioId: string; nome: string; email: string;
    ddi?: string; telefone?: string; consentimentoSms?: boolean;
    fuso: string; ip?: string | null; extras?: Record<string, string>;
}

const RESERVADOS = new Set(['api_key', 'webinar_id', 'first_name', 'last_name', 'email', 'schedule', 'date', 'timezone', 'ip_address', 'phone_country_code', 'phone', 'twilio_consent', 'country', 'state', 'timezone_id']);

/** Corpo do register (sem a chave). É o contrato com o EverWebinar. */
export function parametrosDaInscricao(p: PedidoDeInscricao): Record<string, string | undefined> {
    const { primeiro, sobrenome } = separarNome(p.nome);
    const [schedule, ...resto] = p.horarioId.split('|');
    const date = resto.join('|');
    const comFone = !!(p.telefone && p.ddi);
    const extras: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.extras ?? {})) if (k && v && !RESERVADOS.has(k.toLowerCase())) extras[k] = v;
    return {
        webinar_id: p.webinarId, schedule, date: date || undefined,
        first_name: primeiro, last_name: sobrenome || undefined, email: p.email,
        timezone: p.fuso, ip_address: p.ip || undefined,
        ...(comFone ? { phone_country_code: p.ddi, phone: p.telefone, twilio_consent: p.consentimentoSms ? '1' : '0' } : {}),
        ...extras,
    };
}

/** userId: id do inscrito no EverWebinar (o mesmo dos relatórios de presença). liveRoomUrl é individual. */
export interface Inscrito { userId: string; liveRoomUrl: string; replayRoomUrl: string; inicio: string | null; rotulo: string }

export async function inscrever(chave: string, p: PedidoDeInscricao, fake = false): Promise<Inscrito> {
    const j = await chamar('register', parametrosDaInscricao(p), chave, fake);
    const u = j?.user ?? j?.data ?? j;
    const date = texto(u?.date, 60);
    const fuso = texto(u?.timezone, 60) || p.fuso;
    return {
        userId: texto(u?.user_id == null ? '' : String(u.user_id), 40),
        liveRoomUrl: texto(u?.live_room_url, 1000),
        replayRoomUrl: texto(u?.replay_room_url, 1000),
        inicio: inicioEmUtc(date, fuso),
        rotulo: date,
    };
}
