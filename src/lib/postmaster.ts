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
    webinarId: string; sessao: string; everwebinarUserId: string;
}

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
/** O slug da campanha do webinar no postmaster (= o nome da página e do subdomínio). */
const CAMPANHA = 'webinar';

function lerEnv() {
    const url = (process.env.POSTMASTER_WEBHOOK_URL ?? import.meta.env.POSTMASTER_WEBHOOK_URL ?? '').trim().replace(/\/+$/, '');
    const segredo = (process.env.POSTMASTER_WEBHOOK_SECRET ?? import.meta.env.POSTMASTER_WEBHOOK_SECRET ?? '').trim();
    return { url, segredo };
}

export async function avisarInscricaoNoPostmaster(a: AvisoDeInscricao): Promise<void> {
    const { url, segredo } = lerEnv();
    if (!url || !segredo || !/^https:\/\//.test(url)) return;
    const [primeiro, ...resto] = a.nome.split(' ');
    const corpo: Record<string, string> = {
        email: a.email,
        first_name: primeiro ?? '',
        last_name: resto.join(' '),
        phone_country_code: a.ddi,
        phone: a.telefone,
        webinar_id: a.webinarId,
        date: a.sessao,
        everwebinar_user_id: a.everwebinarUserId,
        site: 'brandpartner.team',
        campanha: CAMPANHA,
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
            if (res.ok) return;
            const motivo = `${res.status} ${(await res.text()).slice(0, 200)}`;
            if (res.status < 500 && res.status !== 429) { console.error(`[postmaster] inscrição recusada: ${motivo}`); return; }
            console.error(`[postmaster] tentativa ${i + 1} falhou: ${motivo}`);
        } catch (e) {
            console.error(`[postmaster] tentativa ${i + 1} não avisou:`, (e as Error).message);
        }
    }
}
