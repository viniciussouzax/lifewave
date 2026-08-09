import React, { useRef } from 'react';
import { applyTemplateVars } from '../../../lib/localVars';

export interface VarDef {
    /** Token sem chaves, ex: 'cidade'. */
    token: string;
    /** Rótulo amigável no botão, ex: 'cidade'. */
    label: string;
    /** Emoji opcional pro botão. */
    icon?: string;
    /** Valor de exemplo usado na prévia. */
    example: string;
}

interface Props {
    value: string;
    onChange: (v: string) => void;
    vars: VarDef[];
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    id?: string;
    'aria-label'?: string;
}

const FIELD = 'w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none';

/**
 * Campo de texto que aceita variáveis ({cidade}/{empresa}/...) sem o usuário leigo
 * precisar digitá-las: botões inserem o token no cursor, e uma prévia mostra o texto
 * resolvido num exemplo real. Coração da usabilidade do admin do tema local.
 */
export default function VariableField({ value, onChange, vars, multiline, rows = 4, placeholder, id, ...rest }: Props) {
    const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

    const insert = (token: string) => {
        const el = ref.current;
        const tok = `{${token}}`;
        if (!el) { onChange(`${value}${tok}`); return; }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + tok + value.slice(end);
        onChange(next);
        // Reposiciona o cursor depois do token inserido.
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + tok.length;
            el.setSelectionRange(pos, pos);
        });
    };

    const exampleMap = Object.fromEntries(vars.map((v) => [v.token, v.example]));
    const resolved = applyTemplateVars(value, exampleMap);
    const hasToken = /\{(\w+)\}/.test(value);

    return (
        <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mr-1">Inserir:</span>
                {vars.map((v) => (
                    <button
                        key={v.token}
                        type="button"
                        onClick={() => insert(v.token)}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-primary-soft text-primary px-2.5 py-1.5 rounded hover:brightness-95 transition-all"
                        title={`Inserir ${v.label}`}
                    >
                        {v.icon && <span aria-hidden="true">{v.icon}</span>}
                        {v.label}
                    </button>
                ))}
            </div>

            {multiline ? (
                <textarea ref={ref as any} id={id} value={value} rows={rows} placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)} className={FIELD + ' resize-y'} aria-label={rest['aria-label']} />
            ) : (
                <input ref={ref as any} id={id} type="text" value={value} placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)} className={FIELD} aria-label={rest['aria-label']} />
            )}

            {hasToken && (
                <div className="mt-2 bg-surface border border-border rounded-md p-3">
                    <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mb-1.5">
                        Prévia {vars[0] ? `(exemplo: ${vars.find((v) => v.token === 'cidade')?.example || vars[0].example})` : ''}
                    </p>
                    <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{resolved || '—'}</p>
                </div>
            )}
        </div>
    );
}
