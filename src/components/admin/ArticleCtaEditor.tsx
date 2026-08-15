/**
 * ArticleCtaEditor.tsx — edita src/data/articleCta.json
 *
 * Controla os 3 CTAs da página de artigo:
 *  - webinar: bloco padrão depois da FAQ (título + texto + botão/link)
 *  - inline: faixa distribuída no meio da leitura (a cada N títulos h2)
 *  - banner: card fixo (sticky) na lateral direita (desktop); aceita imagem
 */
import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Megaphone, Rows3, PanelRight } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

const CONFIG_PATH = 'src/data/articleCta.json';

export default function ArticleCtaEditor() {
    const [cfg, setCfg] = useState<any>(null);
    const [sha, setSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then((d: any) => { setCfg(JSON.parse(d.content)); setSha(d.sha); })
            .catch((e: any) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const patch = (section: string, key: string, val: any) =>
        setCfg((c: any) => ({ ...c, [section]: { ...(c?.[section] || {}), [key]: val } }));

    const handleSave = async () => {
        setSaving(true); setSaved(false); setError('');
        triggerToast('Salvando CTAs do artigo...', 'progress', 30);
        try {
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(cfg, null, 2), sha, message: 'CMS: Update article CTA',
            });
            setSha(res.sha || sha); setSaved(true);
            triggerToast('CTAs salvas!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) { setError(e.message); triggerToast(`Erro: ${e.message}`, 'error'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando…</p>
        </div>
    );
    if (error && !cfg) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-lg border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0" /><div><h3 className="text-xl font-bold mb-2">Erro de leitura</h3><p>{error}</p></div>
        </div>
    );

    const inputCls = 'w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20 transition-all';
    const labelCls = 'block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1.5';
    const w = cfg.webinar || {}, i = cfg.inline || {}, b = cfg.banner || {};

    const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
        <button type="button" onClick={onClick} role="switch" aria-checked={on}
            className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
    );

    const Field = ({ label, value, onChange, placeholder, mono }: any) => (
        <div>
            <label className={labelCls}>{label}</label>
            <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
                placeholder={placeholder} className={`${inputCls} ${mono ? 'font-mono' : ''}`} />
        </div>
    );

    const card = 'bg-surface rounded-lg border border-border p-6';
    const head = 'flex items-center justify-between mb-5 pb-4 border-b border-border';

    return (
        <div className="max-w-2xl space-y-6 pb-32">
            {/* WEBINAR — pós-FAQ */}
            <section className={card}>
                <div className={head}>
                    <div className="flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-primary" aria-hidden="true" />
                        <div>
                            <h3 className="font-bold text-ink">CTA após a FAQ</h3>
                            <p className="text-xs text-ink-faint">Bloco de destaque no fim de cada artigo.</p>
                        </div>
                    </div>
                    <Toggle on={w.enabled !== false} onClick={() => patch('webinar', 'enabled', !(w.enabled !== false))} />
                </div>
                <div className="space-y-4">
                    <Field label="Etiqueta (eyebrow)" value={w.eyebrow} onChange={(v: any) => patch('webinar', 'eyebrow', v)} placeholder="Apresentação ao vivo" />
                    <Field label="Título" value={w.title} onChange={(v: any) => patch('webinar', 'title', v)} placeholder="Participe da apresentação ao vivo" />
                    <div>
                        <label className={labelCls}>Texto</label>
                        <textarea value={w.text ?? ''} onChange={e => patch('webinar', 'text', e.target.value)} rows={2}
                            placeholder="Descubra na prática como funciona…" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Texto do botão" value={w.buttonLabel} onChange={(v: any) => patch('webinar', 'buttonLabel', v)} placeholder="Quero participar" />
                        <Field label="Link do botão" value={w.buttonUrl} onChange={(v: any) => patch('webinar', 'buttonUrl', v)} placeholder="https://…" mono />
                    </div>
                </div>
            </section>

            {/* INLINE — no meio da leitura */}
            <section className={card}>
                <div className={head}>
                    <div className="flex items-center gap-2">
                        <Rows3 className="w-5 h-5 text-primary" aria-hidden="true" />
                        <div>
                            <h3 className="font-bold text-ink">CTA inline (no meio da leitura)</h3>
                            <p className="text-xs text-ink-faint">Faixa distribuída ao longo do artigo.</p>
                        </div>
                    </div>
                    <Toggle on={i.enabled !== false} onClick={() => patch('inline', 'enabled', !(i.enabled !== false))} />
                </div>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Aparece a cada N títulos (h2)</label>
                        <input type="number" min={1} max={10} value={Number(i.everyNHeadings ?? 3)}
                            onChange={e => patch('inline', 'everyNHeadings', Math.max(1, Number(e.target.value) || 3))}
                            className={`${inputCls} w-24`} />
                    </div>
                    <Field label="Título" value={i.title} onChange={(v: any) => patch('inline', 'title', v)} placeholder="Quer ver ao vivo?" />
                    <div>
                        <label className={labelCls}>Texto</label>
                        <textarea value={i.text ?? ''} onChange={e => patch('inline', 'text', e.target.value)} rows={2}
                            placeholder="Participe da nossa apresentação…" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Texto do botão" value={i.buttonLabel} onChange={(v: any) => patch('inline', 'buttonLabel', v)} placeholder="Participar" />
                        <Field label="Link do botão" value={i.buttonUrl} onChange={(v: any) => patch('inline', 'buttonUrl', v)} placeholder="https://…" mono />
                    </div>
                </div>
            </section>

            {/* BANNER — lateral sticky */}
            <section className={card}>
                <div className={head}>
                    <div className="flex items-center gap-2">
                        <PanelRight className="w-5 h-5 text-primary" aria-hidden="true" />
                        <div>
                            <h3 className="font-bold text-ink">Banner lateral (fixo no desktop)</h3>
                            <p className="text-xs text-ink-faint">Card fixo à direita. Se informar uma imagem, ela substitui o card.</p>
                        </div>
                    </div>
                    <Toggle on={b.enabled !== false} onClick={() => patch('banner', 'enabled', !(b.enabled !== false))} />
                </div>
                <div className="space-y-4">
                    <Field label="Título" value={b.title} onChange={(v: any) => patch('banner', 'title', v)} placeholder="Apresentação ao vivo" />
                    <div>
                        <label className={labelCls}>Texto</label>
                        <textarea value={b.text ?? ''} onChange={e => patch('banner', 'text', e.target.value)} rows={2}
                            placeholder="Entre na próxima sessão…" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Texto do botão" value={b.buttonLabel} onChange={(v: any) => patch('banner', 'buttonLabel', v)} placeholder="Garantir vaga" />
                        <Field label="Link do botão" value={b.buttonUrl} onChange={(v: any) => patch('banner', 'buttonUrl', v)} placeholder="https://…" mono />
                    </div>
                    <div className="pt-2 border-t border-border">
                        <Field label="Imagem do banner (URL) — opcional" value={b.image} onChange={(v: any) => patch('banner', 'image', v)} placeholder="/uploads/banner.png ou https://…" mono />
                        <p className="text-xs text-ink-faint mt-1.5 mb-3">Se preenchido, mostra a imagem no lugar do card. O link abaixo é usado ao clicar na imagem.</p>
                        <Field label="Link da imagem" value={b.imageLink} onChange={(v: any) => patch('banner', 'imageLink', v)} placeholder="https://… (senão usa o link do botão)" mono />
                    </div>
                </div>
            </section>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 text-sm rounded-md flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            <div className="sticky bottom-0 bg-bg/80 backdrop-blur py-3 -mx-1 px-1">
                <button type="button" onClick={handleSave} disabled={saving}
                    className="bg-primary hover:brightness-90 disabled:opacity-50 text-white px-6 py-2.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar CTAs'}
                </button>
            </div>
        </div>
    );
}
