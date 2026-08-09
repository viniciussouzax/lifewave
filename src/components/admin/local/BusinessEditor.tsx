import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';
import type { LocalBusiness } from '../../../lib/localTypes';

const FIELD = 'w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none';
const LABEL = 'block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2';

// Campos de identidade/contato que ESTE editor controla (merge-on-save preserva o resto).
const FIELDS = ['companyName', 'phone', 'whatsapp', 'whatsappMessage', 'address', 'hours', 'mapEmbed'] as const;

export default function BusinessEditor() {
    const [biz, setBiz] = useState<LocalBusiness>({ companyName: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/localBusiness.json')
            .then(d => setBiz({ companyName: '', ...JSON.parse(d?.content || '{}') }))
            .catch(err => { if (!err.message.includes('404')) setError(err.message); })
            .finally(() => setLoading(false));
    }, []);

    const patch = (p: Partial<LocalBusiness>) => setBiz(prev => ({ ...prev, ...p }));

    const save = async () => {
        setSaving(true); setError('');
        triggerToast('Salvando dados da empresa...', 'progress', 20);
        try {
            // Merge-on-save: relê o arquivo e sobrescreve só os campos desta tela,
            // pra não apagar o que a "Página inicial" gravou (hero/quem somos).
            let latest: any = {}; let sha: string | undefined;
            try { const d = await githubApi('read', 'src/data/localBusiness.json'); latest = JSON.parse(d?.content || '{}'); sha = d.sha; } catch {}
            const merged = { ...latest };
            for (const k of FIELDS) merged[k] = (biz as any)[k] ?? '';
            const data = await githubApi('write', 'src/data/localBusiness.json', {
                content: JSON.stringify(merged, null, 2), sha, message: 'CMS: atualiza dados da empresa',
            });
            void data;
            triggerToast('Dados da empresa salvos!', 'success', 100);
        } catch {
            setError('Não foi possível salvar. Verifique sua conexão.');
            triggerToast('Não foi possível salvar os dados da empresa.', 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo dados da empresa...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32 max-w-2xl">
            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div>
                    <label htmlFor="biz-name" className={LABEL}>Nome da empresa</label>
                    <input id="biz-name" type="text" value={biz.companyName || ''} onChange={e => patch({ companyName: e.target.value })} className={FIELD} placeholder="Andaimes SP" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="biz-phone" className={LABEL}>Telefone</label>
                        <input id="biz-phone" type="tel" value={biz.phone || ''} onChange={e => patch({ phone: e.target.value })} className={FIELD} placeholder="(11) 4000-0000" />
                    </div>
                    <div>
                        <label htmlFor="biz-wa" className={LABEL}>WhatsApp <span className="text-ink-faint normal-case tracking-normal">(com DDD, só números)</span></label>
                        <input id="biz-wa" type="text" inputMode="numeric" value={biz.whatsapp || ''} onChange={e => patch({ whatsapp: e.target.value.replace(/\D/g, '') })} className={FIELD} placeholder="5511940000000" />
                    </div>
                </div>
                <div>
                    <label htmlFor="biz-wamsg" className={LABEL}>Mensagem que abre no WhatsApp</label>
                    <input id="biz-wamsg" type="text" value={biz.whatsappMessage || ''} onChange={e => patch({ whatsappMessage: e.target.value })} className={FIELD} placeholder="Olá! Vim pelo site e gostaria de um orçamento." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="biz-address" className={LABEL}>Endereço</label>
                        <input id="biz-address" type="text" value={biz.address || ''} onChange={e => patch({ address: e.target.value })} className={FIELD} placeholder="Av. Exemplo, 1000 - São Paulo - SP" />
                    </div>
                    <div>
                        <label htmlFor="biz-hours" className={LABEL}>Horário de atendimento</label>
                        <input id="biz-hours" type="text" value={biz.hours || ''} onChange={e => patch({ hours: e.target.value })} className={FIELD} placeholder="Seg a Sex: 8h às 18h" />
                    </div>
                </div>
                <div>
                    <label htmlFor="biz-map" className={LABEL}>Mapa do Google <span className="text-ink-faint normal-case tracking-normal">(cole o link de incorporação)</span></label>
                    <textarea id="biz-map" rows={2} value={biz.mapEmbed || ''} onChange={e => patch({ mapEmbed: e.target.value })} className={FIELD + ' resize-y font-mono text-xs'} placeholder="No Google Maps: Compartilhar → Incorporar um mapa → cole aqui o código" />
                    <p className="text-[10px] text-ink-faint mt-1.5">Pode colar o código completo do iframe ou só o endereço do mapa.</p>
                </div>
            </section>

            <div className="fixed bottom-0 left-64 right-0 bg-surface/90 backdrop-blur border-t border-border px-8 py-4 flex justify-end z-40">
                <button onClick={save} disabled={saving} className="bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-6 py-2.5 min-h-[44px] rounded font-semibold flex items-center gap-2 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando…' : 'Salvar'}
                </button>
            </div>
        </div>
    );
}
