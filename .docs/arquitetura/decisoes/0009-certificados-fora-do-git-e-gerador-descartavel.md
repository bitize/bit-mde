# 0009 — Certificados fora do git, com gerador de certificado de teste descartável

**Status**: Aceito
**Data**: 2026-08-16 (o `certs/` gitignored é herdado; o gerador é do fork)

## Contexto

Boa parte da suíte precisa de um certificado: `certificado.test.js` testa a conversão PFX→PEM, `distribuicao.test.js` e `recepcao.test.js` instanciam as classes públicas (que exigem `cert`/`key` no construtor), e `sefaz.test.js` fala com a SEFAZ de verdade.

Pior: **todo arquivo de teste que toca certificado faz `fs.readFileSync` no topo do módulo.** Sem `certs/`, o mocha aborta no carregamento — antes de rodar qualquer teste, inclusive os que não dependem de certificado. Na prática, sem certificado a suíte inteira ficava indisponível.

Certificado A1 é dado sensível e caro: identifica uma empresa, assina documento fiscal com validade jurídica e custa dinheiro por ano. Commitá-lo está fora de questão. Mas a consequência herdada era que **quem não tinha um A1 não conseguia contribuir**, e a CI não conseguia rodar teste nenhum.

## Alternativas consideradas

**Commitar um certificado real, cifrado (git-crypt, SOPS, secret na CI).** Roda tudo, inclusive `sefaz.test.js`. Coloca material criptográfico de uma empresa no repositório — público — dependendo de uma camada de cifra para não vazar, e dá a todo colaborador acesso a um certificado que assina documento fiscal em nome da Bitize. Além disso, A1 vence em um ano: viraria manutenção recorrente com janela de suíte quebrada.

**Refatorar os testes para carregar o certificado sob demanda (fixture lazy, `before()`).** Resolveria o aborto no carregamento e liberaria os testes que não precisam de certificado. Não resolve o problema principal: os testes que **precisam** continuariam indisponíveis. É melhoria complementar, não alternativa.

**Mockar o certificado.** `p12ToPem` seria testado contra um mock de si mesmo — o teste deixaria de provar o que interessa.

**Gerar um autoassinado descartável na hora.** Não fala com a SEFAZ (que exige ICP-Brasil), mas é criptograficamente indistinguível de um A1 para tudo o mais: conversão PFX→PEM, montagem, assinatura XML, imutabilidade.

## Decisão

**`certs/` permanece gitignored, e o repositório traz um gerador de certificado de teste descartável.**

```sh
npm run certs:teste
```

[scripts/gerar-certificado-teste.sh](../../../scripts/gerar-certificado-teste.sh) gera `certificado.pfx`, `passphrase.txt`, `cert.pem` e `key.pem` autoassinados, válidos por 10 anos. Libera **65 dos 67 testes** — tudo menos `sefaz.test.js`, que continua exigindo um ICP-Brasil válido e é o único arquivo excluído da CI (`npm run test:ci`).

O script **aborta se `certs/` já existir**, para não sobrescrever um certificado real que o dev tenha colocado ali.

## Consequências

**Fica mais fácil:**

- Contribuir sem ter um A1 — `npm ci && npm run certs:teste && npm test` e acabou;
- Rodar a suíte na CI, em matriz de Node 20/22/24, sem secret nenhum;
- Rodar os testes de release no workflow de publicação, fechando a janela entre o último push e a tag.

**Fica mais difícil:**

- `sefaz.test.js` continua manual e continua exigindo um A1 válido. Vale rodá-lo antes de release que toque transporte, certificado ou assinatura;
- O ambiente de teste diverge do real em um ponto: cadeia autoassinada, não ICP-Brasil.

**Compromisso de longo prazo — dois detalhes do script são load-bearing:**

1. **`-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES`.** O padrão do OpenSSL 3 para PKCS#12 é AES-256-CBC com PBKDF2, que o **node-forge não decifra**. Sem essas flags, todo teste que carrega o `.pfx` falha na leitura;
2. **Normalização dos `.pem` para CRLF.** O node-forge emite PEM com CRLF, o OpenSSL emite LF no Linux, e `certificado.test.js` compara **byte a byte**. Sem a normalização, o teste falha na CI e passa no Windows.

Nenhum dos dois deve ser "simplificado" — os dois parecem ruído e não são. Ver [../testes-e-certificados.md](../testes-e-certificados.md).
