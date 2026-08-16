# 0008 — `lib/` gerado por UglifyJS em modo `beautify`

**Status**: Aceito
**Data**: Herdada de `lucashpmelo/node-mde`; formalizada como ADR em 2026-08-16

## Contexto

O pacote publica `./lib/index.js` como `main`, e `lib/` é produzido a partir de `src/` por [scripts/index.js](../../../scripts/index.js), passando cada arquivo por:

```js
UglifyJS.minify(data.toString(), { output: { beautify: true } })
```

O nome da função diz "minify", mas `beautify: true` desliga justamente a minificação. O que sai é código legível, com quebras de linha e indentação — não um bundle comprimido.

À primeira vista é um passo sem propósito: por que não copiar `src/` para `lib/`, ou publicar `src/` direto?

## Alternativas consideradas

**Publicar `src/` direto, sem `lib/`.** O mais simples possível: sem script de build, sem diretório gerado, sem `.npmignore` precisando distinguir os dois. Perde a separação entre fonte e artefato — e, mais concreto, perde o passo em que `src/env/version.js` é regenerado e todo arquivo é forçado a passar por um parser antes de virar pacote.

**Copiar `src/` → `lib/` com `fs.copyFile`.** Mantém a separação com metade do código. Também perde a checagem de parse, e não muda mais nada: o resultado seria funcionalmente idêntico.

**Minificar de verdade (`beautify: false`).** Reduz o tamanho do pacote em alguns KB. Numa biblioteca de servidor, tamanho de pacote não é métrica que importe — não há bundle de navegador aqui. Em troca, todo stack trace de produção passaria a apontar para código ilegível, num pacote que lida com assinatura digital e cujo diagnóstico depende de ler o que aconteceu.

**Bundler moderno (esbuild, rollup, tsup).** Traria sourcemap e dual CJS/ESM. É toolchain nova para um pacote CommonJS de 29 arquivos com API estável — custo sem demanda correspondente.

## Decisão

**Manter o UglifyJS com `beautify: true`.**

O passo entrega três coisas, nesta ordem de importância:

1. **Regenera `src/env/version.js`** a partir do `package.json`, antes de qualquer cópia — é o que mantém o header `User-Agent: bit-mde/<version>` correto;
2. **Serve de checagem de parse**: arquivo com erro de sintaxe não produz `code`, e o problema aparece no build em vez de no `require` do consumidor;
3. **Normaliza o código publicado** — comentários removidos, sintaxe consistente — mantendo-o legível.

## Consequências

**Fica mais fácil:**

- Ler o código publicado quando algo quebra na máquina de um consumidor;
- Rastrear `lib/x.js` até `src/x.js`: a estrutura de diretórios e o nome dos arquivos são preservados 1:1;
- Garantir que o `version.js` publicado corresponde à versão do pacote.

**Fica mais difícil:**

- Justificar o passo para quem lê o script pela primeira vez — daí este ADR;
- O pacote carrega uma dependência de dev que faz pouco do que o nome promete.

**Compromisso de longo prazo:**

- **`lib/` e `dist/` são gitignored.** `npm run build` antes de publicar não é opcional — sem ele o pacote sai sem o próprio código. O workflow de release refaz o build por isso;
- `popularDiretorio` só escreve arquivo que **não existe**. Funciona porque o passo anterior limpou o diretório; rodar as funções do script fora do `run()` deixaria arquivos velhos intactos;
- Se um dia o pacote precisar de ESM ou sourcemap, é aqui que a troca acontece — e aí um bundler passa a se justificar. Enquanto for CommonJS puro, trocar é custo sem retorno.
