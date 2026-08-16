# 0002 — Publicação pela CI por Trusted Publishing (OIDC), sem `NPM_TOKEN`

**Status**: Aceito
**Data**: 2026-08-16

## Contexto

Com o fork ([ADR 0001](0001-fork-e-republicacao-como-bitize-bit-mde.md)), era preciso decidir como `@bitize/bit-mde` chega ao npm.

O modelo herdado era `npm run release` (`git pull && npm run build && npm publish`) rodado na máquina do mantenedor. Isso significa: build feito com o que estava no disco daquele momento, nenhuma prova de qual commit gerou o artefato, e uma credencial de publicação de longa duração guardada no `~/.npmrc` de alguém.

Pacote público que entra na cadeia de dependências de um ERP fiscal é alvo. O risco não é hipotético — comprometimento de token de publicação é o vetor recorrente dos ataques recentes de supply chain no npm.

## Alternativas consideradas

**Manter `npm publish` manual.** Zero configuração. Nenhuma reprodutibilidade, nenhuma atestação, e a credencial vive indefinidamente numa máquina de trabalho. Um `postinstall` malicioso em qualquer dependência de dev alcança esse token.

**CI com `NPM_TOKEN` em secret.** Resolve reprodutibilidade e tira o token da máquina pessoal. O token continua existindo: de longa duração, com poder de publicar, visível a qualquer workflow do repositório e a quem tiver permissão de admin. Rotação vira tarefa manual que ninguém lembra de fazer.

**CI com Trusted Publishing (OIDC).** O GitHub emite um token de identidade de curta duração para aquele workflow, naquele repositório; o npm troca esse token por uma credencial de publicação momentânea. Não há segredo persistido em lugar nenhum. Custo: exige npm ≥ 11.5.1 (posterior ao que acompanha o Node 22) e a configuração do lado do npm só existe para pacote já publicado.

## Decisão

**Trusted Publishing (OIDC), com a publicação disparada por release publicado no GitHub.**

```yaml
permissions:
  contents: read
  id-token: write
```

O gatilho é `release: [published]`, e não push na `main`: a tag é a fonte da verdade da versão, e o release dá um ponto de aprovação humana entre "está na `main`" e "está no npm".

O workflow atualiza o npm para `^11.5.1` antes de tudo, confere a tag contra o `package.json`, confere `src/env/version.js`, roda a suíte, refaz o build e publica.

A **primeira** publicação (0.15.0) saiu de uma máquina, porque a tela de trusted publisher no npmjs.com só existe para pacote já publicado. Da 0.15.1 em diante é sempre a CI.

## Consequências

**Fica mais fácil:**

- **Provenance sai de graça.** Com trusted publishing o npm gera a atestação sozinho (dispensa `--provenance`), e cada versão fica vinculada de forma verificável ao commit e ao workflow que a produziu — selo verificado na página do pacote;
- Não há credencial para rotacionar, vazar ou revogar;
- O artefato publicado sempre sai de `npm ci` + build limpo, na tag.

**Fica mais difícil:**

- Publicar fora da CI, de propósito — quem faz fura o guard de tag e sai sem provenance;
- Depurar falha de credencial: o erro aparece só no `npm publish`, no fim do workflow.

**Compromisso de longo prazo:**

- **`id-token: write` não pode sair do workflow.** Sem essa permissão não há token de identidade, e a publicação falha por falta de credencial;
- **Renomear `.github/workflows/publicar.yml` invalida a configuração do lado do npm.** O nome do arquivo faz parte da identidade verificada;
- O requisito de npm ≥ 11.5.1 sobrevive à imagem do runner: enquanto o Node LTS trouxer npm mais antigo, o passo de atualização continua obrigatório.
