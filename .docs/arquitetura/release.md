# Release

A publicação é feita **pela CI**, em [.github/workflows/publicar.yml](../../.github/workflows/publicar.yml), disparada quando um **release é publicado no GitHub** — não em push na `main`.

## O procedimento

1. Mover as mudanças de `[Não publicado]` para uma seção versionada e datada no [CHANGELOG.md](../../CHANGELOG.md), no formato `## [x.y.z] / AAAA-MM-DD`. Usar a subseção `### Segurança` quando for só bump de dependências.
2. Bumpar `version` no [package.json](../../package.json).
3. `npm run build` — regenera `src/env/version.js`, que é commitado. Ver [build-e-versao.md](build-e-versao.md).
4. Commit `release x.y.z` e push na `main`.
5. Criar o release no GitHub com a tag `vx.y.z`.

> **O `v` da tag é obrigatório.** O workflow compara a tag com o `package.json` e aborta se divergirem — versão publicada no npm não se reescreve.

O passo 3 continua necessário mesmo com o workflow refazendo o build, porque `src/env/version.js` é commitado e há um guard que reprova o release se ele estiver defasado.

## O que o workflow faz

Na ordem:

| Passo                                     | Por quê                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Atualizar npm (`^11.5.1`)                 | Trusted publishing exige npm ≥ 11.5.1, posterior ao que vem com o Node 22                                     |
| `npm ci`                                  | Instala exatamente o lockfile — o pacote sai reproduzível                                                     |
| Conferir tag × `package.json`             | A tag manda no que é publicado                                                                                |
| Conferir `src/env/version.js`             | Compara o **valor** de `VERSION`, não os bytes (o arquivo está em LF no índice e o build o reescreve em CRLF) |
| `npm run certs:teste` + `npm run test:ci` | Fecha a janela entre o último push na `main` e a criação da tag                                               |
| `npm run build`                           | `lib/` e `dist/` são gitignored — sem isso o pacote sai vazio                                                 |
| `npm publish`                             | Sem `--provenance` e sem `--access public`: os dois já vêm de outro lugar                                     |

Como o workflow refaz o build, `lib/` e `dist/` saem sempre do fonte daquela tag.

## Registro e credencial

Publicado no **npmjs.com** como pacote escopado público, sob a org `bitize`.

`publishConfig.access: "public"` no `package.json` é obrigatório e **não pode ser removido**: pacote escopado nasce `restricted`, e sem essa flag o `npm publish` falha exigindo plano pago. Publicar pacote público no npm é gratuito; só privado é cobrado.

### Trusted Publishing (OIDC)

Não existe `NPM_TOKEN` guardado como secret. O npm troca o token de identidade emitido pelo GitHub por uma credencial de curta duração. Por isso o workflow declara:

```yaml
permissions:
  contents: read
  id-token: write
```

**Tirar `id-token: write` quebra a publicação** por falta de credencial. O efeito colateral desejável é o **provenance**, gerado automaticamente (dispensa `--provenance`), que vira selo verificado na página do pacote. Ver [ADR 0002](decisoes/0002-publicacao-por-oidc-sem-npm-token.md).

O trusted publisher é configurado na página do pacote no npmjs.com (Settings → Trusted Publisher → GitHub Actions), apontando `bitize/bit-mde` e o arquivo `publicar.yml`.

> **Renomear `publicar.yml` invalida a configuração do lado do npm.** O nome do arquivo faz parte da identidade que o npm verifica.

### A publicação de bootstrap

A tela de trusted publisher só existe para pacote **já publicado**. Por isso a primeira publicação de `@bitize/bit-mde` (0.15.0) saiu de uma máquina, com `npm run release` (`git pull && npm run build && npm publish`). Da 0.15.1 em diante é sempre a CI.

`npm run release` fica mantido para esse caso e para emergência. Fora dele, publicar da máquina **fura o guard de tag e sai sem provenance** — não fazer.

## Se a publicação falhar

| Sintoma                                                      | Causa provável                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Tag vX não corresponde ao package.json`                     | Tag criada com versão diferente do commit — apagar release e tag, corrigir e refazer             |
| `src/env/version.js está em X, mas o package.json está em Y` | Faltou `npm run build` no passo 3                                                                |
| Erro de credencial no `npm publish`                          | `id-token: write` removido, ou trusted publisher desconfigurado (arquivo do workflow renomeado?) |
| `npm ci` falha logo no início                                | `package-lock.json` fora de sincronia com o `package.json`                                       |

Como versão no npm não se reescreve, um release que falhou **depois** do `npm publish` não se corrige republicando a mesma versão: bumpa-se um patch e recomeça.
