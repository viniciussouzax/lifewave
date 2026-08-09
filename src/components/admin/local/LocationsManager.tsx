import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, MapPin, X, Edit2, Upload, Search } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';
import { slugify } from '../../../lib/slugify';
import type { Location } from '../../../lib/localTypes';

/**
 * LocationsManager — "Onde atendemos". Simples pro leigo: cada lugar é só um
 * NOME + ESTADO (UF). Slug, tipo e cidade-mãe são automáticos por baixo; a
 * ativação fica na tela "Publicar". Suporta adicionar 1 a 1 ou colar uma lista.
 */
export default function LocationsManager() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [tempState, setTempState] = useState('');
    const [modalError, setModalError] = useState('');

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/locations.json')
            .then(data => { setLocations(JSON.parse(data?.content || '[]')); setFileSha(data.sha); })
            .catch(err => { if (err.message.includes('404')) setLocations([]); else setError(err.message); })
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = locations.map((l, i) => ({ l, i }));
        if (!q) return list;
        return list.filter(({ l }) => l.name.toLowerCase().includes(q) || l.state.toLowerCase().includes(q));
    }, [locations, query]);

    const openCreate = () => { setTempName(''); setTempState(''); setEditingIndex(null); setModalError(''); setIsModalOpen(true); };
    const openEdit = (idx: number) => { const l = locations[idx]; setTempName(l.name); setTempState(l.state || ''); setEditingIndex(idx); setModalError(''); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setModalError(''); };

    useEffect(() => {
        if (!isModalOpen && !isImportOpen) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setIsModalOpen(false); setIsImportOpen(false); } };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isModalOpen, isImportOpen]);

    const previewSlug = slugify(tempName);

    const saveArray = async (newList: Location[]) => {
        setSaving(true); setError('');
        triggerToast('Salvando...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/locations.json', {
                content: JSON.stringify(newList, null, 2), sha: fileSha || undefined, message: 'CMS: atualiza locations.json',
            });
            setFileSha(data.sha);
            triggerToast('Lugares atualizados!', 'success', 100);
        } catch {
            setError('Não foi possível salvar. Verifique sua conexão.');
            triggerToast('Não foi possível salvar. Tente novamente.', 'error');
        } finally { setSaving(false); }
    };

    const saveModal = async () => {
        setModalError('');
        const name = tempName.trim();
        const state = tempState.trim().toUpperCase();
        const slug = slugify(name);
        if (!name) { setModalError('Digite o nome do lugar.'); return; }
        if (!slug) { setModalError('Esse nome não gera um endereço válido. Tente outro.'); return; }
        if (!/^[A-Za-z]{2}$/.test(state)) { setModalError('Informe o estado com 2 letras (ex: SP).'); return; }

        const collision = locations.find((l, i) => i !== editingIndex && l.slug === slug);
        if (collision) { setModalError(`Já existe um lugar com esse nome ("${collision.name}"). Use um nome diferente.`); return; }

        // Cria simples; ao editar, preserva os campos internos (tipo, ativo, cidade).
        const entry: Location = editingIndex === null
            ? { name, slug, state, type: 'bairro', active: true }
            : { ...locations[editingIndex], name, slug, state };
        const arr = editingIndex === null ? [...locations, entry] : locations.map((l, i) => i === editingIndex ? entry : l);
        setLocations(arr); closeModal(); await saveArray(arr);
    };

    const removeLocation = async (idx: number) => {
        if (!confirm('Remover este lugar? As páginas dele deixam de ser geradas.')) return;
        const arr = locations.filter((_, i) => i !== idx);
        setLocations(arr); await saveArray(arr);
    };

    // Import em massa: "Nome, UF" por linha.
    const runImport = async () => {
        setImportError('');
        const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) { setImportError('Cole pelo menos uma linha no formato "Lugar, UF".'); return; }

        const existing = new Set(locations.map(l => l.slug));
        const added: Location[] = [];
        let skipped = 0;
        for (const line of lines) {
            const [rawName, rawUf] = line.split(',').map(p => p.trim());
            const uf = (rawUf || '').toUpperCase();
            const slug = slugify(rawName || '');
            if (!rawName || !slug || !/^[A-Za-z]{2}$/.test(uf) || existing.has(slug) || added.some(a => a.slug === slug)) { skipped++; continue; }
            added.push({ name: rawName, slug, state: uf, type: 'bairro', active: true });
        }
        if (!added.length) { setImportError(`Nada para adicionar. ${skipped} linha(s) inválida(s) ou repetida(s).`); return; }

        const arr = [...locations, ...added];
        setLocations(arr);
        setIsImportOpen(false); setImportText('');
        await saveArray(arr);
        triggerToast(`${added.length} lugar(es) adicionado(s)${skipped ? ` · ${skipped} ignorado(s)` : ''}.`, 'success', 100);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo os lugares...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-ink">Onde você atende</h2>
                    <p className="text-sm text-ink-muted mt-0.5">As cidades e bairros que você atende. {locations.length} cadastrado{locations.length === 1 ? '' : 's'}.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {saving && <span className="flex items-center gap-2 text-ink-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span>}
                    <button onClick={() => { setImportError(''); setImportText(''); setIsImportOpen(true); }} disabled={saving}
                        className="bg-elev hover:bg-border/40 disabled:opacity-50 text-ink px-4 py-2.5 min-h-[44px] rounded font-semibold flex items-center justify-center gap-2 transition-all">
                        <Upload className="w-4 h-4" aria-hidden="true" /> Colar lista
                    </button>
                    <button onClick={openCreate} disabled={saving}
                        className="bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-5 py-2.5 min-h-[44px] rounded font-semibold flex items-center justify-center gap-2 transition-all">
                        <Plus className="w-4 h-4" aria-hidden="true" /> Adicionar lugar
                    </button>
                </div>
            </div>

            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            {locations.length > 0 && (
                <div className="relative max-w-sm">
                    <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar um lugar…"
                        className="w-full bg-surface border border-border rounded-md pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" aria-label="Buscar lugar" />
                </div>
            )}

            {locations.length === 0 ? (
                <div className="bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                    <MapPin className="w-12 h-12 text-ink-faint mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-ink mb-1">Nenhum lugar ainda</h3>
                    <p className="text-ink-muted mb-6">Adicione um lugar, ou cole uma lista de vários de uma vez.</p>
                    <div className="flex gap-3">
                        <button onClick={openCreate} className="bg-primary text-surface font-semibold px-6 py-3 rounded hover:brightness-90 transition-all">Adicionar lugar</button>
                        <button onClick={() => setIsImportOpen(true)} className="bg-elev text-ink font-semibold px-6 py-3 rounded hover:bg-border/40 transition-all">Colar lista</button>
                    </div>
                </div>
            ) : (
                <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                    {filtered.length === 0 ? (
                        <p className="p-6 text-sm text-ink-faint">Nenhum lugar encontrado para "{query}".</p>
                    ) : filtered.map(({ l, i }) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5 group">
                            <div className="flex items-center gap-3 min-w-0">
                                <MapPin className="w-4 h-4 text-ink-faint shrink-0" aria-hidden="true" />
                                <p className="font-semibold text-ink truncate">
                                    {l.name} <span className="text-ink-faint font-normal">· {l.state}</span>
                                    {l.active === false && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-elev px-1.5 py-0.5 rounded align-middle">fora do ar</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => openEdit(i)} aria-label={`Editar: ${l.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-ink-muted hover:bg-elev rounded transition-colors"><Edit2 className="w-4 h-4" aria-hidden="true" /></button>
                                <button onClick={() => removeLocation(i)} aria-label={`Remover: ${l.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal — só Nome + Estado */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={closeModal} aria-hidden="true">
                    <div role="dialog" aria-modal="true" aria-labelledby="modal-loc-title" className="bg-surface rounded-lg w-full max-w-md" style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 id="modal-loc-title" className="text-lg font-bold text-ink">{editingIndex !== null ? 'Editar lugar' : 'Adicionar lugar'}</h3>
                            <button onClick={closeModal} aria-label="Fechar" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                <div>
                                    <label htmlFor="loc-name" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Cidade ou bairro</label>
                                    <input id="loc-name" type="text" value={tempName} onChange={e => setTempName(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-semibold focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Ex: Moema" autoFocus />
                                </div>
                                <div>
                                    <label htmlFor="loc-state" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Estado</label>
                                    <input id="loc-state" type="text" maxLength={2} value={tempState} onChange={e => setTempState(e.target.value.toUpperCase())} className="w-16 text-center bg-elev border border-border rounded-md px-2 py-3 text-ink font-mono uppercase focus:ring-2 focus:ring-primary/30 outline-none" placeholder="SP" />
                                </div>
                            </div>
                            {tempName.trim() && previewSlug && (
                                <p className="text-[11px] text-ink-faint">Endereço da página: <code className="bg-elev px-1.5 py-0.5 rounded font-mono">/{previewSlug}/…</code></p>
                            )}
                        </div>
                        {modalError && <div className="px-6 pb-2"><p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5 py-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{modalError}</p></div>}
                        <div className="p-6 border-t border-border flex gap-3 justify-end">
                            <button onClick={closeModal} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors">Cancelar</button>
                            <button onClick={saveModal} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal — colar lista */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={() => setIsImportOpen(false)} aria-hidden="true">
                    <div role="dialog" aria-modal="true" aria-labelledby="modal-imp-title" className="bg-surface rounded-lg w-full max-w-lg" style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 id="modal-imp-title" className="text-lg font-bold text-ink">Colar uma lista de lugares</h3>
                            <button onClick={() => setIsImportOpen(false)} aria-label="Fechar" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-ink-muted">Um lugar por linha, no formato <code className="bg-elev px-1 rounded font-mono">Nome, UF</code>:</p>
                            <pre className="text-xs font-mono bg-elev rounded-md p-3 text-ink-muted leading-relaxed">Moema, SP{'\n'}Pinheiros, SP{'\n'}Campinas, SP</pre>
                            <textarea rows={8} value={importText} onChange={e => setImportText(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none resize-y" placeholder="Moema, SP" aria-label="Lista de lugares" autoFocus />
                            {importError && <p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{importError}</p>}
                        </div>
                        <div className="p-6 border-t border-border flex gap-3 justify-end">
                            <button onClick={() => setIsImportOpen(false)} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors">Cancelar</button>
                            <button onClick={runImport} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all">Adicionar todos</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
