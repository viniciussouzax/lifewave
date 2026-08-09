# Spec — Simplificação do Admin do Site Local (leigo-friendly)

**Data:** 2026-05-29 · **Autor:** Francis · **Status:** aprovado pelo Bruno

## Problema
O admin do tema local (funcionalidade PRINCIPAL) ficou complexo e técnico para o
público-alvo (dono de empresa local, leigo). Confusão central: "Modelo de página"
vs "Página inicial" (jargão + conteúdo da home espalhado). Conceito de "Nicho" é
camada técnica desnecessária. Variáveis `{cidade}` expostas sem forma de usar.

## Decisões (confirmadas)
1. **Um negócio por site** → "Nicho" eliminado como tela; a **cor vai pro serviço**.
2. **Menu reorganizado** pelo modelo mental do dono (não pelos arquivos de dados):
   `Minha empresa` · `Página inicial` · `Serviços` · `Onde atendemos` · `Publicar`.
3. **Campo inteligente** pra variáveis: botões de inserir (📍cidade 🏢empresa 📞telefone)
   + **prévia ao vivo** resolvida numa cidade de exemplo. O dono nunca digita `{}`.

## Telas
- **Minha empresa** (`localBusiness` identidade): nome, telefone, WhatsApp, msg,
  endereço, horário, mapa.
- **Página inicial** (home num só lugar): topo (homeTitle/subtitle/heroImage),
  provas de confiança, como funciona (passos), quem somos (aboutTitle/text),
  benefícios, faixa final (cta) — cada bloco com **mostrar/ocultar** + rótulos.
  Usa o campo inteligente nos textos.
- **Serviços**: nome, **cor**, ícone, imagem (URL nesta rodada), descrição,
  conteúdo da página (campo inteligente + Gerar com IA).
- **Onde atendemos** (`locations`): cidades/bairros + import em massa.
- **Publicar** (`PageMatrix` com rótulos simplificados).

## Eliminado
- Tela **Nichos** (cor → serviço; `niche` vira opcional/legado).
- Tela **Modelo de página** (contato→Minha empresa; home→Página inicial; fallback
  do texto da página de serviço usa defaults inline já existentes na `.astro`).

## Dados
- `Service.color?: string` (hex) — novo. Leitura: `svc.color || niche?.color || '#8b4a36'`.
- `benefits` migra de `localTemplate` → `localHome` (é conteúdo da home).
- Cada tela = um dono de dados; onde dois editores tocam `localBusiness`, usar
  merge-on-save (reler antes de gravar) pra não perder campos.

## Componente
- `VariableField.tsx` (input + textarea): toolbar de inserir tokens no cursor +
  prévia via `applyTemplateVars(value, exampleVars)`. exampleVars = cidade principal
  + dados da empresa.

## Coordenação com Leonardo (live na LocalHome.astro + service page)
Mudam fontes que ele lê:
- cor do card/hero: `svc.color || niche?.color` (antes só niche).
- benefícios: `localHome.benefits` (antes `localTemplate.benefits`).
- hero/about da home: mantêm em `localBusiness` (sem migração) — sem mudança.
Atualizar `.agents/inbox/leonardo.md` com o novo contrato.

## Imagens
Nesta rodada: campo de **URL** pra heroImage e Service.image. Upload de arquivo
(endpoint) = rodada seguinte.

## Fora de escopo (agora)
Upload de arquivo, microlabels de botão, página de serviço além da fonte de cor,
header/footer além do que já está.
