# 0005 — `Object.freeze` em todo módulo e nas instâncias públicas

**Status**: Aceito
**Data**: Herdada de `lucashpmelo/node-mde`; formalizada como ADR em 2026-08-16

## Contexto

A biblioteca lida com certificado digital e assinatura de documento fiscal. Duas categorias de acidente preocupam:

1. **Monkey patching** — código de terceiro (ou um teste mal isolado) substituindo `Assinatura.assinarXml` ou `SefazService.request` em runtime. Numa biblioteca de assinatura, isso é caminho de assinatura forjada.
2. **Mutação de configuração após a validação** — o construtor valida `cert`, `key` e `tpAmb`, e alguém altera `instancia.config.tpAmb` depois. A validação passa a não significar nada, e o evento vai para o ambiente errado.

## Alternativas consideradas

**Não congelar.** É o normal em JS. Depende inteiramente de disciplina do consumidor, e não deixa rastro quando alguém quebra a regra.

**Encapsular com closure ou `#private`.** Proteção mais forte e sem custo em runtime. Exigiria reescrever as classes estáticas em fábricas ou adotar campos privados de classe — mudança grande num código que já funciona, e `#private` não impede substituir o método estático no objeto exportado.

**`Object.freeze` no export e na instância.** Barato, uma linha por módulo, e falha alto: em modo estrito — e todo módulo começa com `'use strict'` — atribuição a objeto congelado **lança `TypeError`**, em vez de falhar em silêncio.

## Decisão

**Praticamente todo módulo de `src/` exporta `Object.freeze(Classe)`; as instâncias de `apis/` congelam `this` e `this.config`, e ainda `requestOptions` e `httpsOptions` dentro dela.**

Duas exceções, ambas por natureza do módulo:

- [src/services/sefaz-service.js](../../../src/services/sefaz-service.js) — precisa ser instanciado com estado (`this.instance`);
- os arquivos de `src/env/` — são módulos de dado, não de comportamento.

Há testes que asseguram o congelamento (`assert.throws` ao sobrescrever método estático), então remover um `Object.freeze` reprova o PR.

## Consequências

**Fica mais fácil:**

- Confiar que `DistribuicaoDFe#config.tpAmb` no fim da execução é o mesmo que foi validado no construtor;
- Detectar monkey patching acidental: a tentativa lança em vez de passar;
- Testar imutabilidade — a garantia é verificável, não documental.

**Fica mais difícil:**

- **Fazer stub em teste.** Substituir um método estático exige `proxyquire`/`mock-require` ou injeção, não atribuição direta;
- Estender a biblioteca por herança ou patch — que é justamente o que se quis impedir, mas o custo recai também sobre uso legítimo.

**Compromisso de longo prazo:**

Objetos congelados **atravessam camadas**, e quem recebe precisa saber disso. `requestOptions` e `httpsOptions` chegam congelados no `SefazService`, que hoje só os usa como **fonte** de mescla, nunca como alvo:

```js
const AgentOptions = Object.assign(
  { cert, key, ca, rejectUnauthorized: false },
  { ...opts.httpsOptions }
)
```

`Object.assign` escreve no primeiro argumento, e aqui esse argumento é um literal recém-criado — o objeto congelado nunca é destino. A versão anterior, porém, **mutava `opts.httpsOptions` direto**, antes da mescla:

```js
if (opts.tpAmb === '1' && 'rejectUnauthorized' in opts.httpsOptions === false) {
  opts.httpsOptions['rejectUnauthorized'] = false
}
```

Era essa linha a origem do bug **`Cannot add property rejectUnauthorized, object is not extensible`** ([#22](https://github.com/lucashpmelo/node-mde/issues/22), corrigido na 0.14.13). O conserto foi apagá-la e mover o default `rejectUnauthorized: false` para dentro do literal.

A lição vale para qualquer código novo: **objeto vindo de `this.config` é congelado — copie antes de mutar.** A regra se aplica a escrita, não a leitura: mesclar a partir dele é seguro; atribuir nele lança em runtime, no consumidor que passa `httpsOptions`.

Vale notar o que o congelamento **não** cobre: `Object.freeze` é raso, e `{ ...this.config }` produz objeto novo e mutável — é assim que os métodos públicos acrescentam `nsu`/`chNFe` a `opts` sem violar nada.
