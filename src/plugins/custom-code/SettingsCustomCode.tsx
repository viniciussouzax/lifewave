/**
 * SettingsCustomCode.tsx — Plugin Custom Code (Walker)
 *
 * UI para 3 slots de injeção de HTML/JS bruto: Head, Body Start, Body End.
 * Padrão de mercado (Ghost / Framer / Webflow).
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Code2, AlertTriangle } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

const SLOTS = [
    {
        key: 'head' as const,
        label: 'Cabeçalho (Head)',
        hint: 'Injetado dentro de <head>. Use pra: meta tags custom, GTM, consent manager, pixels que exigem carregar primeiro.',
        placeholder: '<!-- Ex: Meta Pixel, Google Tag Manager -->\n<script>...</script>',
    },
    {
        key: 'bodyStart' as const,
        label: 'Início do Body',
        hint: 'Injetado logo após <body>. Use pra: AdSense/AdCash e outros ad networks que fazem document.write.',
        placeholder: '<!-- Ex: AdCash, AdSense head snippet -->\n<script src="..." async></script>',
    },
    {
        key: 'bodyEnd' as const,
        label: 'Fim do Body',
        hint: 'Injetado antes de </body>. Use pra: Hotjar, Amplitude, Clarity, custom analytics (melhor pra performance).',
        placeholder: '<!-- Ex: Hotjar, Amplitude -->\n<script>...</script>',
    },
];

type SlotKey = 'head' | 'bodyStart' | 'bodyEnd';

export default function SettingsCustomCode() {
    const [values, setValues] = useState<Record<SlotKey, string>>({ head: '', bodyStart: '', bodyEnd: '' });
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then(data => {
                const config = JSON.parse(data.content);
                setFullConfig(config);
                setFileSha(data.sha);
                const cc = config?.customCode ?? {};
                setValues({
                    head: cc.head ?? '',
                    bodyStart: cc.bodyStart ?? '',
                    bodyEnd: cc.bodyEnd ?? '',
                });
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true); setSaved(false); setError('');
        triggerToast('Salvando código personalizado...', 'progress', 30);
        try {
            const updated = {
                ...fullConfig,
                customCode: {
                    head: values.head.trim(),
                    bodyStart: values.bodyStart.trim(),
                    bodyEnd: values.bodyEnd.trim(),
                },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update custom code injection',
            });
            setFileSha(res.sha ?? fileSha);
            setFullConfig(updated);
            setSaved(true);
            triggerToast('Código salvo! Vai aparecer no site após o próximo deploy (~2min).', 'success', 100);
            setTimeout(() => setSaved(false), 4000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando configuração...
            </div>
        );
    }

    const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm resize-y font-mono';

    return (
        <div className="max-w-3xl space-y-6 pb-32">
            {/* Aviso XSS */}
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 space-y-1">
                    <p className="font-bold">Atenção: código bruto</p>
                    <p>
                        Tudo que você colar aqui vai direto pro HTML do site, sem sanitização. Só cole códigos de <strong>fontes confiáveis</strong> (AdSense, AdCash, Google Analytics, Hotjar, etc). Um script malicioso aqui pode comprometer todos os visitantes do seu site.
                    </p>
                </div>
            </div>

            {/* 3 slots */}
            {SLOTS.map((slot, i) => (
                <div key={slot.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                        <h3 className="font-bold text-slate-800">{slot.label}</h3>
                        <Code2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{slot.hint}</p>
                    <textarea
                        rows={6}
                        value={values[slot.key]}
                        onChange={e => setValues(v => ({ ...v, [slot.key]: e.target.value }))}
                        placeholder={slot.placeholder}
                        className={`${inputClass} text-xs`}
                        spellCheck={false}
                    />
                    <p className="text-xs text-slate-400 mt-1 ml-1 tabular-nums">
                        {values[slot.key].length} caracteres
                    </p>
                </div>
            ))}

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Sticky save bar */}
            <div className="sticky bottom-4 flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-lg p-4">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
                {saved && (
                    <span className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Salvo — deploy em ~2min
                    </span>
                )}
            </div>
        </div>
    );
}
