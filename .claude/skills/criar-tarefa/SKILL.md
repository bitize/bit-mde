---
name: criar-tarefa
description: Cria e especifica uma tarefa em .docs/tasks/ do bit-mde — nome do arquivo, fontes da verdade a ler por camada tocada, preenchimento do template, abertura da issue no GitHub e promoção de drafts/ para specified/. USE WHEN o pedido for criar, especificar, planejar ou promover uma tarefa deste repositório. Trigger words - criar tarefa, nova tarefa, especificar tarefa, promover tarefa, abrir issue, task nova, create task, new task, spec a task, task workflow.
---

# Criar tarefa — bit-mde

Procedimento executável. O **formato** da tarefa (ciclo de vida, nomenclatura, o que preencher ao concluir ou cancelar) é definido em [.docs/tasks/README.md](../../../.docs/tasks/README.md) e no [template](../../../.docs/tasks/_templates/task-template.md) — ler de lá, não reproduzir aqui. Esta skill cobre o que **fazer**, na ordem, e as decisões que costumam sair erradas.

Regra de fronteira, herdada de [ESTRUTURA.md](../../../.docs/arquitetura/ESTRUTURA.md): se a informação já está no README de tasks ou no template, referencie; não copie.

---

## Passo 1 — Nascer em `drafts/`

```bash
cp .docs/tasks/_templates/task-template.md .docs/tasks/drafts/descricao-curta.md
```

Nome: kebab-case, minúsculo, **sem acento**, até 50 caracteres, descrição em **português**. Em `drafts/` não há prefixo — a issue ainda não existe.

Exceção: tarefa que nasce de issue já aberta por terceiro entra em `drafts/` já com o número (`GH-NN-descricao.md`).

## Passo 2 — Ler as fontes da verdade **antes** de especificar

Este passo não é burocracia: o repositório tem invariantes que quebram teste quando ignoradas, e quase toda tarefa mal especificada aqui é uma que não leu a camada que ia tocar.

Sempre ler [arquitetura/README.md](../../../.docs/arquitetura/README.md) (as cinco invariantes). Depois, pelo que a tarefa toca:

| A tarefa mexe em…                       | Ler                                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assinatura pública, JSDoc, `.d.ts`      | [camadas/apis.md](../../../.docs/arquitetura/camadas/apis.md) + [ADR 0006](../../../.docs/arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md)                                |
| Validação de entrada, mensagem de erro  | [camadas/validators.md](../../../.docs/arquitetura/camadas/validators.md) + [ADR 0004](../../../.docs/arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)      |
| Formato do retorno, parse da resposta   | [camadas/controllers-helpers.md](../../../.docs/arquitetura/camadas/controllers-helpers.md)                                                                                              |
| XML gerado, ordem de campos, parser     | [camadas/schemas-xml.md](../../../.docs/arquitetura/camadas/schemas-xml.md)                                                                                                              |
| Rede, mTLS, timeout, headers, status    | [camadas/services-sefaz.md](../../../.docs/arquitetura/camadas/services-sefaz.md) + [ADR 0005](../../../.docs/arquitetura/decisoes/0005-object-freeze-pervasivo.md)                      |
| Endpoint, evento novo, UF, timezone, CA | [camadas/env.md](../../../.docs/arquitetura/camadas/env.md)                                                                                                                              |
| Consulta de documentos                  | [fluxos/distribuicao-dfe.md](../../../.docs/arquitetura/fluxos/distribuicao-dfe.md)                                                                                                      |
| Manifestação / assinatura de evento     | [fluxos/recepcao-evento.md](../../../.docs/arquitetura/fluxos/recepcao-evento.md) + [ADR 0007](../../../.docs/arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)    |
| Teste, certificado                      | [testes-e-certificados.md](../../../.docs/arquitetura/testes-e-certificados.md) + [ADR 0009](../../../.docs/arquitetura/decisoes/0009-certificados-fora-do-git-e-gerador-descartavel.md) |
| Build, `lib/`, `dist/`, `version.js`    | [build-e-versao.md](../../../.docs/arquitetura/build-e-versao.md) + [ADR 0008](../../../.docs/arquitetura/decisoes/0008-build-com-uglifyjs-beautify.md)                                  |
| Versão, tag, publicação                 | [release.md](../../../.docs/arquitetura/release.md) + [ADR 0002](../../../.docs/arquitetura/decisoes/0002-publicacao-por-oidc-sem-npm-token.md)                                          |
| Dependência (`package.json`)            | [ADR 0003](../../../.docs/arquitetura/decisoes/0003-lockfile-versionado.md)                                                                                                              |

Marcar no cabeçalho da tarefa o que foi efetivamente lido, e registrar em **Referências** os docs e ADRs consultados.

**Um ADR aceito não se edita.** Se a tarefa contraria uma invariante, ela precisa propor um ADR novo que supersede o antigo — e isso vai na seção Decisões de design, não passa em silêncio.

## Passo 3 — Preencher o template

Sempre: Contexto e motivação, Requisitos, Decisões de design, Testes, Checklist de implementação.

Só as camadas realmente tocadas: os blocos de **Impacto por camada**. Apagar os demais e os blocos de instrução — o arquivo entregue não carrega andaime.

Ao escrever, antecipar as armadilhas que este repositório tem e que a especificação precisa endereçar explicitamente:

- **Mensagem de erro é contrato.** Os testes comparam com `assert.strictEqual`. Toda mensagem nova ou alterada vai na tarefa com o **texto exato**.
- **Ordem das chaves do schema é a ordem do XML.** Campo novo exige dizer _onde_ entra na sequência, não só que existe.
- **Recepção:** mudar o XML gerado pode quebrar o recorte por `indexOf` que monta o lote. A tarefa precisa responder se afeta.
- **Retorno:** campo escalar novo entra com `|| ''`, e o JSDoc do controller é o que vira tipo público.
- **`tpAmb` é string** (`'1'` / `'2'`).
- **Bump de dependência são dois arquivos** no mesmo commit: `package.json` **e** `package-lock.json`.
- **Mudança de API pública** arrasta, no mesmo PR: código, JSDoc de `src/apis/`, `README.md`, `CHANGELOG.md` e o doc de camada.

Se a decisão tem alternativa real e reversão custosa, ela merece ADR próprio — não só um parágrafo na tarefa.

## Passo 4 — Promover para `specified/`

Só depois de a especificação estar aceita. Nesta ordem:

1. **Criar a issue** — o corpo é um resumo (até ~300 palavras), nunca a especificação inteira:

   ```bash
   gh issue create --title "<título da tarefa>" --body-file <(…)
   ```

2. **Mover com `git mv`**, usando o número retornado:

   ```bash
   git mv .docs/tasks/drafts/descricao-curta.md .docs/tasks/specified/GH-NN-descricao-curta.md
   ```

3. **Preencher o cabeçalho** — campo **Issue**, **Status** `specified`, **Atualizado em**.
4. **Conferir o blockquote final da issue** — precisa apontar para o caminho real, agora em `specified/`. Ele volta a mudar quando a tarefa for para `done/` ou `canceled/`.

> **O repositório é público.** Nada de certificado, CNPJ de cliente, chave de NF-e real ou XML de produção na issue. Anonimizar quando for necessário ao diagnóstico — inclusive `cStat`/`xMotivo` colados de rejeição real.

## Passo 5 — Validar antes de commitar a tarefa

Tarefa é Markdown em `.docs/`, que **não** está no `.prettierignore` e passa pelo `format:check` da CI:

```bash
npm run format
```

Os demais gates (`certs:teste` + `test:ci`, `sefaz.test.js` à parte, `build`) valem para o PR de **implementação**, e já estão na seção "Validação pré-PR" do template. Não rodar teste para commitar uma especificação.

---

## Fechamento

Concluir ou cancelar segue a checklist que já está na própria tarefa ("Conclusão e entrega") e em [.docs/tasks/README.md](../../../.docs/tasks/README.md). O ponto mais esquecido dos dois fluxos: depois do `git mv`, **corrigir o blockquote de especificação no corpo da issue**, trocando `specified/` por `done/` ou `canceled/`.

Tarefa cancelada não se apaga — vira registro, com o motivo, e os checklists ficam desmarcados.
