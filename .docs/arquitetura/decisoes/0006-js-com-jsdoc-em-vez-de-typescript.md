# 0006 — JavaScript com JSDoc em vez de TypeScript no fonte

**Status**: Aceito
**Data**: Herdada de `lucashpmelo/node-mde`; formalizada como ADR em 2026-08-16

## Contexto

A biblioteca é consumida majoritariamente por projetos TypeScript — o BitERP entre eles — e precisa publicar tipos decentes: `tpAmb` como `'1' | '2'`, `cUFAutor` como união dos 27 códigos IBGE, `tipoEvento` como união dos quatro eventos, e o shape completo do retorno.

Ao mesmo tempo, é uma biblioteca pequena (29 arquivos em `src/`), CommonJS, de superfície pública mínima e ritmo de mudança baixo — meses entre releases funcionais.

## Alternativas consideradas

**Migrar o fonte para TypeScript.** Checagem real em todo o código interno, refactoring assistido, e o `.d.ts` sai naturalmente. Custo: toolchain de build maior (transpilação, sourcemaps, `tsconfig` de produção), reescrita completa de 29 arquivos com risco de regressão sutil em código de assinatura digital, e o `lib/` publicado deixa de ser rastreável linha a linha até o fonte.

**JS puro, sem tipos publicados.** Zero tooling. Joga o custo no consumidor: cada projeto TS escreve o próprio `.d.ts` ou usa `any`, e o contrato deixa de ter dono.

**`.d.ts` escrito e mantido à mão.** Controle total sobre os tipos publicados, e nenhum passo de geração. Duas fontes da verdade que divergem no primeiro PR apressado — e a divergência só aparece para quem consome.

**JS com JSDoc, gerando `.d.ts` pelo `tsc`.** Uma fonte da verdade, tipos publicados, e nenhuma transpilação no fonte.

## Decisão

**JavaScript puro (CommonJS), com tipagem declarada em blocos JSDoc, e `dist/index.d.ts` gerado pelo `tsc`** com `allowJs` + `emitDeclarationOnly`, entrando por [src/index.js](../../../src/index.js).

Na prática, **os blocos JSDoc de `src/apis/` e o JSDoc de retorno dos controllers são a definição de tipos do pacote**. O `npm run types` não emite JavaScript — só o `.d.ts`.

O `main` continua sendo `./lib/index.js`, gerado pelo UglifyJS ([ADR 0008](0008-build-com-uglifyjs-beautify.md)), e `types` aponta para `./dist/index.d.ts`.

## Consequências

**Fica mais fácil:**

- Consumidor TS recebe união literal (`'1' | '2'`, os 27 códigos de UF, os 14 timezones) sem que ninguém mantenha um `.d.ts` paralelo;
- O que roda em produção é o que está escrito — sem transpilação entre fonte e artefato, o stack trace aponta para código legível;
- Contribuição sem toolchain: `node` e `mocha` bastam.

**Fica mais difícil:**

- **Nada checa o código interno.** JSDoc só descreve a fronteira pública; erro de tipo dentro de `helpers/` ou `validators/` só aparece em teste;
- Tipo complexo em JSDoc fica verboso — a assinatura de `enviar` nos controllers é uma linha só, longa;
- Refactoring é manual, sem "rename symbol" confiável.

**Compromisso de longo prazo:**

- **JSDoc desatualizado vira tipo errado publicado**, e o erro só aparece no editor de quem consome. Mudou a API pública, o JSDoc muda no mesmo PR — junto com o `README.md` e o `CHANGELOG.md`;
- O job `qualidade` da CI roda `npm run build`, então JSDoc que **não compila** reprova o PR. JSDoc que compila e está **errado**, não — essa é a lacuna que a disciplina precisa cobrir;
- Migrar para TypeScript depois continua possível, e o JSDoc atual serve de especificação. Mas seria mudança grande num código de assinatura digital: só com motivo forte.
