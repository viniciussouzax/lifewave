import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
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
// DOMÍNIOS PRÓPRIOS de campanha (pedido do dono, 18/10/2026): um domínio inteiro que mostra a página
// de uma campanha, como o subdomínio. `brazilianconference.com/<caminho>` = `/braziliancon/<caminho>`.
// Para um domínio novo: uma linha aqui, o domínio no projeto da Vercel e o DNS apontado para ela.
const DOMINIOS_PROPRIOS = {
    'brazilianconference.com': 'braziliancon',
};
const ASSETS_COMPARTILHADOS = String.raw`^/(?!_p/|webinar-app/|api/|_astro/|_image|_server-islands/|favicon|robots\.txt|sitemap)(.*)$`;
const hostExato = (dominio) => '^' + dominio.replace(/\./g, '\\.') + '$';
const rotasDeCampanha = {
    name: 'rotas-de-campanha',
    hooks: {
        'astro:build:done': () => {
            const arquivo = '.vercel/output/config.json';
            if (!existsSync(arquivo)) return;
            const config = JSON.parse(readFileSync(arquivo, 'utf-8'));
            const dosDominios = Object.entries(DOMINIOS_PROPRIOS).map(([dominio, pagina]) => ({
                src: ASSETS_COMPARTILHADOS,
                has: [{ type: 'host', value: hostExato(dominio) }],
                dest: `/${pagina}/$1`,
                check: true,
            }));
            const nossas = new Set([HOST_DE_CAMPANHA, ...Object.keys(DOMINIOS_PROPRIOS).map(hostExato)]);
            config.routes = [
                {
                    src: ASSETS_COMPARTILHADOS,
                    has: [{ type: 'host', value: HOST_DE_CAMPANHA }],
                    dest: '/$campanha/$1',
                    check: true,
                },
                ...dosDominios,
                ...config.routes.filter((r) => !(r.has && r.has.some((h) => nossas.has(h.value)))),
            ];
            writeFileSync(arquivo, JSON.stringify(config, null, 2));
            listarPaginasDeCampanha();
        },
    },
};

// A LISTA DAS PÁGINAS DE CAMPANHA (`/campanhas.json`), lida pelo postmaster no "Nova campanha" para
// sugerir as páginas que ainda não têm campanha, já com nome e endereço. Uma página de campanha é
// a que foi publicada por `publicar-pagina.mjs` (do repositório das páginas): tem a pasta
// `public/<nome>/` com o index.html e os arquivos em `public/_p/<nome>/`.
function listarPaginasDeCampanha() {
    const destino = '.vercel/output/static';
    if (!existsSync(destino) || !existsSync('public/_p')) return;
    const host = new URL(siteUrl).hostname.replace(/^www\./, '');
    const entidades = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
    const paginas = readdirSync('public/_p')
        .filter((nome) => /^[a-z0-9-]+$/.test(nome) && statSync(`public/_p/${nome}`).isDirectory() && existsSync(`public/${nome}/index.html`))
        .map((nome) => {
            const html = readFileSync(`public/${nome}/index.html`, 'utf-8');
            const titulo = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? nome).replace(/&(amp|lt|gt|quot|#39);/g, (e) => entidades[e]).trim();
            return { slug: nome, titulo, url: `https://${host}/${nome}/`, subdominio: `https://${nome}.${host}/` };
        });
    writeFileSync(`${destino}/campanhas.json`, JSON.stringify({ paginas }, null, 2));
}

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
