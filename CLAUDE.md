# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Biblioteca Node.js (CommonJS, JS puro com tipagem via JSDoc) que consome dois Web Services SOAP da SEFAZ:

- **NFeDistribuicaoDFe** — consulta de documentos destinados a um CNPJ/CPF (por `ultNSU`, `NSU` ou `chNFe`).
- **NFeRecepcaoEvento4** — envio de lote de eventos de manifestação do destinatário.

Publicada no npm como `@bitize/bit-mde` (pacote escopado, `publishConfig.access: public`); o remote é `bitize/bit-mde` (fork de `lucashpmelo/node-mde`, publicado como `node-mde` até a 0.14.13). O `README.md` é a documentação pública da API e deve ser atualizado junto com mudanças de assinatura.

## Comandos

```sh
npm test                        # mocha sobre ./test (exige ./certs — ver abaixo)
npm run test:ci                 # tudo menos sefaz.test.js (o que a CI roda)
npm run certs:teste             # gera ./certs autoassinado descartável
npx mocha test/xml.test.js      # um arquivo de teste
npx mocha --grep "Imutabilidade"  # filtra por nome do teste
npm run build                   # npm run script && npm run types
npm run script                  # gera ./lib a partir de ./src (scripts/index.js)
npm run types                   # npx tsc -> ./dist/index.d.ts
npm run release                 # git pull && npm publish
```

### Pré-requisito dos testes

Todo arquivo de teste que toca certificado faz `fs.readFileSync` **no topo do módulo**, com caminho relativo ao CWD. Sem o diretório `certs/` (gitignored) o mocha aborta antes de rodar qualquer teste — inclusive os que não dependem dele. É preciso criar `certs/` na raiz com `certificado.pfx`, `passphrase.txt`, `cert.pem` e `key.pem` (o mesmo certificado A1 nos dois formatos, pois `certificado.test.js` compara a conversão PFX→PEM com os `.pem` do disco). Sempre rodar mocha a partir da raiz do repositório.

Sem `certs/`, ainda é possível rodar isoladamente: `test/xml.test.js`, `test/gzip.test.js`, `test/zeroPad.test.js`, `test/data.test.js`.

Quem não tem um A1 em mãos pode rodar `npm run certs:teste`, que gera um autoassinado descartável e libera tudo menos `sefaz.test.js` (65 dos 67 testes). O script **aborta se `certs/` já existir**, para não sobrescrever um certificado real. Dois detalhes do `scripts/gerar-certificado-teste.sh` são load-bearing e não devem ser "simplificados": o `.pfx` precisa ser gerado com `-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES` porque o node-forge não decifra o padrão AES-256 do OpenSSL 3; e os `.pem` são normalizados para CRLF porque `certificado.test.js` compara byte a byte com a saída do forge, que usa CRLF, enquanto o OpenSSL escreve LF no Linux.

`test/sefaz.test.js` é um teste de integração real: bate nos endpoints de produção **e** homologação da SEFAZ com mTLS, e falha sem rede ou com certificado vencido. É o único arquivo excluído da CI.

### CI

Dois workflows, ambos em push e PR na `main`:

- `.github/workflows/testes.yml` — matriz Node 20/22/24: `npm install` → `npm run certs:teste` → `npm run test:ci`.
- `.github/workflows/qualidade.yml` — dois jobs paralelos em Node 22: `npm run format:check` (Prettier) e `npm run build`.

Ambos usam `npm install` em vez de `npm ci` e não habilitam `cache: npm`, porque `package-lock.json` é gitignored — os dois exigem o lockfile versionado.

`prettier.config.js` fixa `endOfLine: 'auto'` e isso é obrigatório enquanto não houver `.gitattributes`: com `core.autocrlf=true` no Windows o working tree fica em CRLF, enquanto a CI em Linux vê LF. Com o padrão `'lf'` do Prettier, `format:check` acusaria todos os arquivos na máquina dos devs e nenhum na CI. O Prettier é dependência de dev fixada em versão exata (sem `^`) — sem lockfile versionado, um range deixaria a CI instalar um minor novo e reprovar `format:check` em arquivos intocados. Pelo mesmo motivo, não trocar por `npx prettier` solto, que baixaria uma versão diferente a cada run.

### Build e versão

`scripts/index.js` faz três coisas, nessa ordem: reescreve `src/env/version.js` com a `version` do `package.json`, limpa `./lib` e `./dist`, e copia cada arquivo de `src/` passando por `UglifyJS.minify({output:{beautify:true}})` para `./lib`. O `main` do pacote é `./lib/index.js` e os tipos vêm de `./dist/index.d.ts`, gerado pelo `tsc` (`allowJs` + `emitDeclarationOnly`, entrando só por `src/index.js`).

`lib/` e `dist/` são gitignored — **rodar `npm run build` antes de publicar**. Bumpar a versão no `package.json` sozinho não basta: `src/env/version.js` é commitado e alimenta o header `User-Agent: bit-mde/<version>`; ele só é atualizado pelo build.

## Arquitetura

Fluxo de uma chamada, em camadas fixas:

```
apis/          classe pública, valida config no construtor e congela (Object.freeze)
  └ validators/  normaliza a entrada e produz mensagem de erro
controllers/   static enviar(opts): montarRequest -> envia -> montarResponse -> montarRetorno
  └ helpers/     orquestra schema -> XML -> (assinatura) -> serviço -> parse da resposta
      └ schemas/   objeto JS espelhando o XML (chaves `@_` = atributos, para o XMLBuilder)
      └ services/sefaz-service.js  instância axios + https.Agent com mTLS
      └ helpers/retorno-helper.js  formato final { data, reqXml, resXml, status, error? }
env/           constantes: endpoints por tpAmb, cadeia CA ICP-Brasil, EVENTOS, CODIGOS_UF, ZONES, VERSION
```

`src/index.js` exporta `DistribuicaoDFe` e `RecepcaoEvento` em três formas (`module.exports`, `.default`, `.mde`) para interoperar com `require` e `import`.

### Convenções que atravessam o código

**Contrato dos validators.** Todos seguem o mesmo formato: `new Validator(entrada)` → `isValid()` → `getValues()` / `getError()`. `isValid()` **muta o estado interno** — é onde acontecem a conversão PFX→PEM, o zero-padding do NSU (`ZeroPad.padNsu`, 15 dígitos), o default de `idLote` (`'1'`) e o de `timezone` (`'America/Sao_Paulo'`). Chamar `getValues()` sem antes chamar `isValid()` devolve dados crus. Novos validators devem seguir esse mesmo contrato.

**Onde o erro aparece.** Problemas de configuração e de argumento **lançam** (`throw new Error(validator.getError())`) de forma síncrona, dentro do construtor ou do método público. Problemas de rede/SEFAZ **não lançam**: `SefazService.request` captura tudo e devolve `{status, data:'<error>…</error>'}` (504 para `ECONNABORTED`, 502 quando não houve resposta, 500 no resto), e `RetornoHelper` transforma isso em `{ data: {}, error, reqXml, resXml, status }`. Preservar essa separação.

**Imutabilidade.** Praticamente todo módulo exporta `Object.freeze(Classe)`, e as instâncias de `apis/` congelam `this` e `this.config`. Existem testes que asseguram isso (`assert.throws` ao sobrescrever um método estático). Consequência prática: `requestOptions` e `httpsOptions` chegam congelados no `SefazService`, que precisa copiá-los (`{ ...opts.httpsOptions }`) antes de mesclar — foi exatamente a origem do bug #22 (`Cannot add property rejectUnauthorized, object is not extensible`).

**Assinatura digital.** Só a recepção de evento assina. `RecepcaoHelper.montarRequest` assina cada `infEvento` individualmente com `xml-crypto` (referência `//*[local-name(.)='infEvento']`, assinatura inserida _depois_ do nó) e depois faz _splice de string_ nos blocos `<evento versao="1.00">…` para montar o lote dentro de um único `<envEvento>`. Mexer no formato do XML gerado pelo schema pode quebrar esse recorte por `indexOf`.

**Ambiente.** `tpAmb` é string: `'1'` produção, `'2'` homologação. É a chave dos mapas em `env/distribuicao.js` e `env/recepcao.js`.

**Idioma e mensagens.** Domínio, nomes de arquivo/classe e mensagens de erro são em português. As mensagens são comparadas **literalmente** nos testes (`assert.strictEqual(err.message, 'NSU não informado.')`) — alterar o texto quebra testes.

**Estilo.** Prettier: sem ponto e vírgula, aspas simples, 2 espaços, trailing comma `es5`. Todo módulo começa com `'use strict'`. Sem TypeScript no fonte: a tipagem pública vem dos blocos JSDoc nas classes de `src/apis/` — atualizá-los ao mudar a API pública, pois é deles que sai o `dist/index.d.ts`.

## Release

1. Mover as mudanças de `[Não publicado]` para uma seção versionada e datada no `CHANGELOG.md` (formato `## [x.y.z] / AAAA-MM-DD`, com subseção `### Segurança` quando for só bump de dependências).
2. Bumpar `version` no `package.json`.
3. `npm run build` (regenera `src/env/version.js`).
4. Commit `release x.y.z` e `npm run release`.

`.npmignore` exclui `src`, `scripts`, `test`, `.github`, `.vscode` e `certs` — o pacote publicado leva só `lib/`, `dist/` e a documentação.

### Registro

Publicado no **npmjs.com** como pacote escopado público, sob a org `bitize`. `publishConfig.access: "public"` é obrigatório e não pode ser removido: pacote escopado nasce `restricted`, e sem essa flag o `npm publish` falha exigindo plano pago. Publicar públicos no npm é gratuito; só pacote privado é cobrado.
