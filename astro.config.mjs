import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let sitemap;
try { sitemap = require('@astrojs/sitemap').default; } catch {}

let siteUrl = 'https://example.com';
try {
    const cfg = JSON.parse(readFileSync('src/data/siteConfig.json', 'utf-8'));
    if (cfg.url) {
        let raw = String(cfg.url).trim().replace(/\/$/, '');
        if (raw && !/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
        if (raw) siteUrl = raw;
    }
} catch {}

// Páginas de campanha por subdomínio: NOME.brandpartner.team/<caminho> mostra /NOME/<caminho> (a
// página copiada em public/NOME), sem trocar o endereço. Na Vercel os arquivos são servidos ANTES
// das rewrites do vercel.json, então lá a regra nunca valia para `/` (a home existe e ganhava).
// Por isso a rota entra no config.json do build, antes do `handle: filesystem`; o `check` faz o
// destino passar pelos arquivos de novo, e o que não existir cai no 404 de sempre.
// Ficam de fora os assets compartilhados (_p, webinar-app, _astro…) e os hosts que não são páginas.
const HOST_DE_CAMPANHA = String.raw`(?<campanha>(?!(?:www|edge|lifewave)\.)[a-z0-9-]+)\.brandpartner\.team`;
const rotasDeCampanha = {
    name: 'rotas-de-campanha',
    hooks: {
        'astro:build:done': () => {
            const arquivo = '.vercel/output/config.json';
            if (!existsSync(arquivo)) return;
            const config = JSON.parse(readFileSync(arquivo, 'utf-8'));
            config.routes = [
                {
                    src: String.raw`^/(?!_p/|webinar-app/|api/|_astro/|_image|_server-islands/|favicon|robots\.txt|sitemap)(.*)$`,
                    has: [{ type: 'host', value: HOST_DE_CAMPANHA }],
                    dest: '/$campanha/$1',
                    check: true,
                },
                ...config.routes.filter((r) => !(r.has && r.has.some((h) => h.value === HOST_DE_CAMPANHA))),
            ];
            writeFileSync(arquivo, JSON.stringify(config, null, 2));
        },
    },
};

export default defineConfig({
    site: siteUrl,
    output: 'static',
    adapter: vercel(),
    integrations: [
        react(),
        tailwind({ applyBaseStyles: false }),
        ...(sitemap ? [sitemap()] : []),
        rotasDeCampanha,
    ],
    vite: {
        optimizeDeps: {
            include: ['marked'],
        },
    },
});
