# 0004 — Erro de configuração lança; erro de rede/SEFAZ vira retorno

**Status**: Aceito
**Data**: Herdada de `lucashpmelo/node-mde`; formalizada como ADR em 2026-08-16

## Contexto

A biblioteca pode falhar por motivos de duas naturezas completamente diferentes:

1. **O chamador errou** — certificado ausente, `tpAmb` inválido, NSU com 16 dígitos, lote com 21 eventos. É bug no código de quem chama, determinístico, e nenhuma tentativa vai consertar.
2. **O mundo errou** — timeout, DNS, certificado do servidor, 500 da SEFAZ, serviço em manutenção. É condição de operação, não determinística, e frequentemente esperada em produção.

Tratar as duas do mesmo jeito força o chamador a distinguir uma da outra na hora do erro, que é o pior momento para isso.

## Alternativas consideradas

**Lançar em tudo.** Idiomático em JS e uniforme: um `try/catch` cobre. Mas transforma condição operacional normal — a SEFAZ fora do ar é rotina — em exceção, e joga fora o que mais importa no diagnóstico fiscal: o XML enviado e o recebido. Para recuperá-los seria preciso anexá-los a um `Error` customizado, e quem faz `catch (e) { log(e.message) }` perderia tudo.

**Retornar em tudo (estilo `[err, data]` ou `Result`).** Uniforme na outra direção e sem exceção nenhuma. Faz config inválida — que é bug de programação — passar silenciosamente por um retorno que o chamador pode ignorar. Erro que deveria explodir em desenvolvimento vira `data: {}` em produção.

**Separar por natureza.** Erro de programação lança, condição de operação retorna.

## Decisão

**Erro de configuração e de argumento lança, de forma síncrona, na fronteira pública. Erro de rede e da SEFAZ vira retorno.**

A fronteira pública é `apis/`: o lançamento acontece **só** nos construtores e nos métodos públicos de [DistribuicaoDFe](../../../src/apis/distribuicaoDFe-api.js) e [RecepcaoEvento](../../../src/apis/recepcaoEvento-api.js), e em nenhuma camada abaixo.

```js
if (!validator.isValid()) {
  throw new Error(validator.getError())
}
```

Nenhuma camada interna revalida. [SefazService](../../../src/services/sefaz-service.js) em particular **não exige `cert` e `key`**: instanciado sem eles, monta o `https.Agent` mesmo assim e deixa a falha acontecer no handshake, que vira retorno com `status` — a SEFAZ responde `403` — em vez de exceção. É contrato coberto por `test/sefaz.test.js` ("sem informar cert.pem e key.pem"), e é o que permite ao serviço ser usado direto em teste sem carregar certificado. Quem instancia controller ou service por fora de `apis/` fica sem a validação.

Transporte — [SefazService.request](../../../src/services/sefaz-service.js) captura tudo e devolve `{ status, data }`. Quando não há resposta HTTP, o status é sintético e a mensagem vai embrulhada em `<error>…</error>`:

| Situação                 | `status` |
| ------------------------ | -------- |
| `ECONNABORTED` (timeout) | 504      |
| Requisição sem resposta  | 502      |
| Qualquer outro erro      | 500      |

[RetornoHelper](../../../src/helpers/retorno-helper.js) transforma isso no formato final, esvaziando `data` e preenchendo `error` — mas **mantendo `reqXml`, `resXml` e `status`**.

Detalhe deliberado: lançar é **síncrono**. Config inválida falha antes de qualquer `await`, e o `throw` acontece na linha do `new DistribuicaoDFe(...)` — não numa Promise rejeitada.

## Consequências

**Fica mais fácil:**

- Errar a configuração alto e cedo, em desenvolvimento;
- Tratar indisponibilidade da SEFAZ como o que ela é: fluxo normal, com `if (retorno.error)`;
- Diagnosticar rejeição fiscal — `reqXml` e `resXml` chegam preenchidos **mesmo no caminho de erro**.

**Fica mais difícil:**

- Não há tratamento uniforme: quem consome precisa de `try/catch` **e** de checagem de `error`;
- `error` é **string**, não `Error` — sem stack, sem `cause`, sem tipo;
- Status 502/504/500 sintéticos se misturam a status reais da SEFAZ. Quem faz métrica por status precisa saber disso.

**Compromisso de longo prazo:**

- **Helper e service nunca lançam por causa de resposta da SEFAZ.** É o que permite ao chamador confiar que só configuração explode;
- A leitura defensiva de `montarResponse` (desestruturação com default em cada nível) existe para sustentar essa promessa quando a resposta não tem a forma esperada — ver [../camadas/controllers-helpers.md](../camadas/controllers-helpers.md);
- Uma exceção conhecida sobrevive: `Gzip.unzip` de um `docZip` corrompido rejeita a Promise e propaga. Ainda não foi tratada; se virar problema, o conserto é converter em `error`, não relaxar a regra.
