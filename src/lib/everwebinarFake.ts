/**
 * EverWebinar SIMULADO — só para desenvolvimento local (EVERWEBINAR_FAKE=1, nunca em produção).
 * Mesmo formato da documentação oficial e do simulador do postmaster: horários em 3 dias
 * (2 por dia, em UTC) convertidos para o `timezone` pedido; register devolve links falsos.
 * Um horário extra "daqui a 2 minutos" deixa testar a sala de espera virando para "entrar".
 */
export function fakeEverwebinar(url: string, init: RequestInit): Response {
    const corpo = new URLSearchParams(String(init.body ?? ''));
    if (corpo.get('api_key') !== 'ew-falsa-local') return Response.json({ status: 'error', message: 'Invalid API key' }, { status: 401 });
    const w = { webinar_id: 2, title: 'Apresentação LifeWave (simulada)', timezone: 'Auto-detect' };
    if (corpo.get('webinar_id') !== String(w.webinar_id)) return Response.json({ status: 'error', message: 'Webinar not found' }, { status: 404 });

    const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(corpo.get('timezone') ?? '');
    const desloc = m ? (Number(m[2]) * 60 + Number(m[3] ?? 0)) * (m[1] === '-' ? -1 : 1) : 0;
    const local = (t: Date) => new Date(t.getTime() + desloc * 60_000).toISOString().slice(0, 16).replace('T', ' ');

    if (url.endsWith('/webinar')) {
        const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
        const daqui2min = new Date(Math.ceil((Date.now() + 2 * 60_000) / 60_000) * 60_000);
        const schedules = [{ date: local(daqui2min), schedule: 99, comment: 'Em 2 minutos' }];
        // Sessões "just in time" de 15 em 15 minutos.
        const quarto = Math.ceil((Date.now() + 5 * 60_000) / 900_000) * 900_000;
        for (const [i, t] of [quarto, quarto + 900_000, quarto + 1_800_000].entries()) {
            schedules.push({ date: local(new Date(t)), schedule: 90 + i, comment: 'Just in time' });
        }
        for (const d of [1, 2, 3]) {
            for (const [i, h] of [15, 23].entries()) {
                const t = new Date(hoje.getTime() + d * 86_400_000 + h * 3_600_000);
                schedules.push({ date: local(t), schedule: 20 + i, comment: t.toUTCString().slice(0, 22) });
            }
        }
        return Response.json({ status: 'success', webinar: { ...w, schedules } });
    }
    if (url.endsWith('/register')) {
        if (corpo.get('phone') && !corpo.get('twilio_consent')) return Response.json({ status: 'error', message: 'twilio_consent is required' }, { status: 400 });
        if (!corpo.get('email') || !corpo.get('first_name') || !corpo.get('schedule')) return Response.json({ status: 'error', message: 'Missing required fields' }, { status: 400 });
        console.log('[everwebinar simulado] register:', [...corpo.keys()].filter((k) => k !== 'api_key').join(', '));
        return Response.json({ status: 'success', user: {
            user_id: 555, date: corpo.get('date'), timezone: corpo.get('timezone'),
            live_room_url: 'https://event.webinarjam.com/live/simulado-555',
            replay_room_url: 'https://event.webinarjam.com/replay/simulado-555',
            thank_you_url: 'https://event.webinarjam.com/thankyou/simulado-555',
        } });
    }
    return Response.json({ status: 'error', message: 'unknown endpoint' }, { status: 404 });
}
