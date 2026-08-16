# 0007 — Assinatura individual por `infEvento` e montagem do lote por recorte de string

**Status**: Aceito
**Data**: Herdada de `lucashpmelo/node-mde`; formalizada como ADR em 2026-08-16

## Contexto

O leiaute do NFeRecepcaoEvento4 exige que **cada `infEvento` do lote seja assinado individualmente**, com sua própria `Signature` posicionada logo após o nó assinado, dentro do respectivo `<evento>`. Um lote com cinco eventos carrega cinco assinaturas independentes — não uma assinatura do lote.

Isso cria um problema de montagem: assinatura digital é sensível a **byte**. Canonicalizar, assinar e depois mexer no documento invalida a assinatura. Qualquer estratégia de montagem precisa produzir o XML final sem tocar no que já foi assinado.

## Alternativas consideradas

**Montar o lote inteiro no schema e assinar cada `infEvento` no documento completo.** É o caminho conceitualmente limpo: um documento, várias referências. Exigiria chamar `computeSignature` várias vezes sobre o mesmo documento, com XPath que selecione **um** `infEvento` específico a cada passada — e cada assinatura inserida altera o documento em que a próxima vai operar. O `xml-crypto` não oferece esse fluxo de forma direta, e a ordem de inserção passaria a importar de um jeito difícil de testar.

**Manipular DOM: assinar cada evento separado e enxertar os nós num documento de lote.** Correto em teoria e a solução "adulta". Na prática, reserializar o nó enxertado pode alterar bytes (prefixo de namespace, declaração redundante, ordem de atributo, whitespace) e invalidar a assinatura recém-calculada. Ganharia uma dependência de DOM e um conjunto novo de armadilhas de canonicalização.

**Assinar cada evento isolado e concatenar as strings assinadas.** O trecho assinado é copiado **verbatim**, sem passar por parser nenhum — é a única forma que garante, por construção, que nenhum byte do que foi assinado mudou.

## Decisão

**Cada evento é montado e assinado isoladamente; o lote é montado por recorte e concatenação de string.**

[RecepcaoSchema](../../../src/schemas/recepcaoEvento-schema.js) monta **um** evento por vez, mas gera a árvore completa (`nfeDadosMsg` > `envEvento` > `evento`). Cada XML é assinado por [Assinatura.assinarXml](../../../src/util/assinatura.js), com XPath `//*[local-name(.)='infEvento']` e `action: 'after'`. Depois, [RecepcaoHelper.montarRequest](../../../src/helpers/recepcaoEvento-helper.js) recorta cada resultado entre `<evento versao="1.00">` e `</envEvento>`, e concatena os pedaços dentro de um `<envEvento>` escrito à mão.

## Consequências

**Fica mais fácil:**

- Garantir que a assinatura sobrevive à montagem — o trecho assinado é copiado byte a byte;
- Testar: um evento assinado isoladamente é verificável sozinho, e o teste de recepção compara o XML final;
- Manter a compatibilidade ao subir o `xml-crypto` — a 0.15.0 foi da v2 para a v6 e o XML assinado saiu **byte a byte idêntico**.

**Fica mais difícil:**

- O `envEvento` do lote é string literal no helper, duplicando informação que o schema também sabe (namespace, `versao`);
- Cada evento é serializado por inteiro e descartado quase todo — irrelevante num limite de 20 eventos;
- Depurar erro de montagem exige ler XML cru.

**Compromisso de longo prazo — o ponto frágil:**

O recorte usa `indexOf` de **literal exato**, e depende de quatro coisas simultâneas:

1. o `XMLBuilder` emitir `<evento versao="1.00">` exatamente assim;
2. `'@_versao': '1.00'` continuar sendo o **último** atributo de `evento` no schema (a ordem das chaves determina a ordem dos atributos);
3. a `Signature` ficar dentro de `evento` e antes de `</envEvento>`;
4. nenhum espaço em branco entre as tags, o que o `Xml.envelopar` e o builder respeitam hoje.

> **`indexOf` que não encontra devolve `-1`, e `substring(-1, n)` trata como `0`.** Ou seja: uma mudança inocente no schema não quebra em exceção — produz um XML com prefixo indevido, aceito pelo JavaScript e rejeitado pela SEFAZ. O sintoma aparece longe da causa.

Regra prática: **mexeu no schema de recepção ou na função de assinatura, rodar `test/recepcao.test.js`.** E, se a mudança for real, valer a pena rodar `test/sefaz.test.js` contra homologação antes do release.

Se algum dia esse recorte precisar sair, a alternativa a avaliar é a de manipulação de DOM com canonicalização controlada — não "montar tudo no schema", que é a que parece óbvia e não resolve o problema de bytes.
