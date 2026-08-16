# 0003 — `package-lock.json` versionado e `npm ci` em todos os workflows

**Status**: Aceito
**Data**: 2026-08-16

## Contexto

O repositório herdado do upstream **ignorava** o `package-lock.json`. Para uma biblioteca, esse já foi o conselho corrente: o lockfile de uma lib não é respeitado por quem a instala, então versioná-lo pareceria ruído.

Com o fork vieram três workflows de CI e, principalmente, um workflow que **publica o pacote**. O argumento mudou de lugar: o lockfile deixou de ser sobre o consumidor e passou a ser sobre o artefato que a gente produz.

## Alternativas consideradas

**Continuar ignorando, com `npm install` na CI.** Menos um arquivo em PR de dependência. Cada run resolve o range do `package.json` na hora — dois runs do mesmo commit podem instalar árvores diferentes. Pior: o pacote publicado passaria a ser montado com o que estivesse disponível no minuto do release, sem reprodutibilidade e sem como responder "com qual `axios` esse build foi feito?".

**Ignorar, mas fixar toda dependência em versão exata.** Aproxima o efeito sem o arquivo. Não cobre dependência transitiva, que é onde mora a maior parte do risco de supply chain, e transforma cada bump em edição manual de `package.json`.

**Versionar e usar `npm ci`.** `npm ci` instala exatamente a árvore do lockfile e falha de imediato se ele estiver fora de sincronia com o `package.json` — a inconsistência aparece no PR, não no release.

## Decisão

**`package-lock.json` versionado, e `npm ci` com `cache: npm` nos três workflows.**

O lockfile fica fora do pacote publicado, via `.npmignore` — ele serve ao build, não ao consumidor.

## Consequências

**Fica mais fácil:**

- Reproduzir um build: mesmo commit, mesma árvore de dependências;
- Auditar o que entrou numa versão publicada;
- Ver mudança de dependência transitiva no diff do PR, em vez de descobri-la em produção;
- Cache do `setup-node`, que precisa do lockfile para gerar a chave.

**Fica mais difícil:**

- PR de dependência fica maior e mais ruidoso;
- Conflito de merge em `package-lock.json` acontece e não se resolve à mão (regenerar, não editar).

**Compromisso de longo prazo:**

- **Não voltar a ignorar o lockfile.** Sem ele, `npm ci` falha de imediato nos três workflows;
- **Bump de dependência é mudança de dois arquivos** — `package.json` e `package-lock.json`, no mesmo commit;
- O Prettier segue fixado em **versão exata** (sem `^`) mesmo com o lockfile. Virou redundância proposital: o `npm ci` já instalaria a mesma versão, mas o pin mantém a intenção visível e impede que um `npm update` suba um minor e reprove `format:check` em arquivos intocados. Pelo mesmo motivo, não trocar por `npx prettier` solto, que baixaria versão diferente a cada run.
