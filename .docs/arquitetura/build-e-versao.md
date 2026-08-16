# Build e versão

```sh
npm run build     # npm run script && npm run types
npm run script    # gera ./lib a partir de ./src   (scripts/index.js)
npm run types     # npx tsc → ./dist/index.d.ts
```

`lib/` e `dist/` são **gitignored e gerados**. O `main` do pacote é `./lib/index.js` e os tipos vêm de `./dist/index.d.ts` — sem build, o pacote publicado sai sem o próprio código.

## `npm run script`

[scripts/index.js](../../scripts/index.js) faz três coisas, nesta ordem:

### 1. Reescreve `src/env/version.js`

```js
const data = `module.exports = { VERSION: '${version}' }\r\n`
```

A `version` vem do `package.json`. **Este arquivo é commitado** e alimenta o header `User-Agent: bit-mde/<version>` do [SefazService](camadas/services-sefaz.md).

> Bumpar a versão no `package.json` **não basta**. Sem rodar o build, `src/env/version.js` fica na versão anterior e a lib se identifica errado na SEFAZ. A CI de publicação tem guard exatamente para isso — ver [release.md](release.md).
>
> Note o `\r\n`: o arquivo é escrito em **CRLF**, enquanto no índice do git está em LF. Por isso o guard da CI compara o **valor** de `VERSION`, e não os bytes do arquivo — um `git diff` acusaria diferença em toda execução.

### 2. Limpa `./lib` e `./dist`

Em paralelo, criando o diretório se não existir. Remove arquivos e subdiretórios, mantendo a raiz.

### 3. Copia `src/` → `lib/`, passando pelo UglifyJS

```js
UglifyJS.minify(data.toString(), { output: { beautify: true } })
```

Cada arquivo é processado individualmente, preservando a estrutura de diretórios. `beautify: true` é o ponto: o resultado **não é minificado de verdade** — sai legível, com nomes preservados no escopo exportado. O que o passo realmente faz é normalizar o código (comentários removidos, sintaxe consistente) e servir de checagem de parse: arquivo com erro de sintaxe não gera `code`.

Ver [ADR 0008](decisoes/0008-build-com-uglifyjs-beautify.md) para o porquê de manter esse passo.

> `popularDiretorio` só escreve arquivo que **não existe** (`if (!existsSync(a))`). Como o passo 2 limpou o diretório, na prática todos são escritos. Mas rodar `npm run script` com `lib/` populado e sem limpeza deixaria arquivos velhos intactos — não invocar as funções do script fora do `run()`.

## `npm run types`

`npx tsc`, com o [tsconfig.json](../../tsconfig.json) em `allowJs` + `emitDeclarationOnly`, entrando por [src/index.js](../../src/index.js) e emitindo `dist/index.d.ts`.

**A tipagem pública do pacote é gerada a partir dos blocos JSDoc** de `src/apis/` e do JSDoc de retorno dos controllers. Não há `.d.ts` escrito à mão. Ver [ADR 0006](decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md).

Consequência: JSDoc desatualizado vira tipo errado publicado, e o erro só aparece no editor de quem consome. O job `qualidade` da CI roda `npm run build`, então JSDoc que não compila reprova o PR — mas JSDoc que compila e está **errado**, não.

## O que vai no pacote

[.npmignore](../../.npmignore) exclui `src`, `scripts`, `test`, `.github`, `.vscode`, `certs`, `.docs`, `package-lock.json`, `tsconfig.json` e `prettier.config.js`. O publicado leva `lib/`, `dist/` e a documentação de raiz (`README.md`, `CHANGELOG.md`, `LICENSE`, etc.).

> Pasta com ponto **não** é excluída por padrão pelo npm — só um punhado de nomes fixos (`.git`, `.npmrc`, `.gitignore`…) é. `.github`, `.vscode` e `.docs` estão listados um a um por isso. Ao criar pasta nova de tooling na raiz, verificar se ela precisa entrar ali.

## Checklist ao mudar a API pública

No mesmo PR:

1. Código em `src/`;
2. JSDoc do método/construtor em `src/apis/` (vira o `.d.ts`);
3. [README.md](../../README.md) — documentação pública;
4. `CHANGELOG.md`, em `[Não publicado]`;
5. O doc de camada correspondente aqui em `.docs/arquitetura/`;
6. `npm run build` e `npm test` antes de abrir o PR.
