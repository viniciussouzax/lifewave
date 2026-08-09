/**
 * ai-provider.ts — Plugin AI Generator (Walker)
 *
 * Carrega configurações de IA do pluginsConfig.json e chama OpenAI ou Gemini.
 * Adaptado do CNX: remove dependências de settings.yaml e github-api,
 * lê diretamente de src/data/pluginsConfig.json.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type AIProvider = 'openai' | 'gemini' | 'openrouter';

/** Modelo default do OpenRouter quando nenhum é configurado. */
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

export interface AISettings {
    provider: AIProvider;
    apiKey: string;
    pexelsApiKey?: string;
    /** Só usado quando provider === 'openrouter' (ex.: 'anthropic/claude-3.5-sonnet'). */
    model?: string;
}

/**
 * Carrega configurações de IA do pluginsConfig.json.
 */
export function loadAISettings(): AISettings {
    try {
        const raw = readFileSync(resolve(process.cwd(), 'src/data/pluginsConfig.json'), 'utf-8');
        const config = JSON.parse(raw);
        const ai = config?.ai || {};
        return {
            provider: (ai.provider as AIProvider) || 'gemini',
            apiKey: ai.apiKey || '',
            pexelsApiKey: ai.pexelsApiKey || '',
            model: ai.model || '',
        };
    } catch {
        return { provider: 'gemini', apiKey: '' };
    }
}

/**
 * Resolve a API Key efetiva: pluginsConfig primeiro, depois env vars.
 */
export function resolveApiKey(settings: AISettings): string {
    if (settings.apiKey?.trim()) return settings.apiKey.trim();
    if (settings.provider === 'openai') return (process.env.OPENAI_API_KEY || '').trim();
    if (settings.provider === 'openrouter') return (process.env.OPENROUTER_API_KEY || '').trim();
    return (process.env.GEMINI_API_KEY || '').trim();
}

/**
 * Chama a API OpenAI (gpt-4o-mini).
 */
export async function callOpenAI(
    prompt: string,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
    const systemPrompt = options?.systemPrompt ?? 'Você é um redator profissional especializado em criar conteúdo de alta qualidade para blogs.';
    const maxTokens = options?.maxTokens ?? 4096;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
    const orgId = (process.env.OPENAI_ORGANIZATION_ID || '').trim();
    const projId = (process.env.OPENAI_PROJECT_ID || '').trim();
    if (orgId) headers['OpenAI-Organization'] = orgId;
    if (projId) headers['OpenAI-Project'] = projId;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Chama a API Google Gemini (gemini-1.5-flash).
 */
export async function callGemini(
    prompt: string,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
    const systemPrompt = options?.systemPrompt ?? 'Você é um redator profissional especializado em criar conteúdo de alta qualidade para blogs.';
    const maxTokens = options?.maxTokens ?? 4096;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
            },
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

/**
 * Chama a API do OpenRouter (OpenAI-compatível). O modelo é escolhido pelo
 * usuário (ex.: 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'), o que dá
 * acesso a centenas de modelos com uma única chave.
 */
export async function callOpenRouter(
    prompt: string,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number; model?: string }
): Promise<string> {
    const systemPrompt = options?.systemPrompt ?? 'Você é um redator profissional especializado em criar conteúdo de alta qualidade para blogs.';
    const maxTokens = options?.maxTokens ?? 4096;
    const model = options?.model?.trim() || DEFAULT_OPENROUTER_MODEL;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
    // Atribuição opcional no dashboard do OpenRouter (não obrigatório).
    const referer = (process.env.OPENROUTER_SITE_URL || '').trim();
    const title = (process.env.OPENROUTER_SITE_NAME || '').trim();
    if (referer) headers['HTTP-Referer'] = referer;
    if (title) headers['X-Title'] = title;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model,
            temperature: 0.7,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Chama o provedor de IA configurado (OpenAI, Gemini ou OpenRouter).
 */
export async function callAI(
    prompt: string,
    settings: AISettings,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
    if (settings.provider === 'gemini') {
        return callGemini(prompt, apiKey, options);
    }
    if (settings.provider === 'openrouter') {
        return callOpenRouter(prompt, apiKey, { ...options, model: settings.model });
    }
    return callOpenAI(prompt, apiKey, options);
}
