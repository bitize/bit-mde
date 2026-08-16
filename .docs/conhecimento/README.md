# Conhecimento externo

Material que **não é nosso**: documentação da SEFAZ, notas técnicas, XSDs, comportamentos observados do serviço e links de referência.

Está separado de [../arquitetura/](../arquitetura/) porque tem outro ciclo de vida — muda quando a SEFAZ muda, não quando o nosso código muda.

## O que entra aqui

- Resumo de nota técnica ou de trecho do Manual de Orientação do Contribuinte que afeta a biblioteca;
- Tabela de código (`cStat`, `tpEvento`, schema de `docZip`) que a gente consulta com frequência;
- Comportamento observado do serviço que não está documentado — restrição de cadência, mensagem de erro real, diferença entre produção e homologação;
- Links, com data de acesso.

## O que não entra

- Como o nosso código funciona → [../arquitetura/](../arquitetura/);
- Por que escolhemos algo → [../arquitetura/decisoes/](../arquitetura/decisoes/);
- Cópia integral de documento da SEFAZ. Resumir o que importa e linkar a fonte; documento fiscal é revisado com frequência e a cópia envelhece em silêncio.

## Convenção

Um arquivo por assunto, kebab-case. Começar com a **fonte e a data**:

```markdown
# Título

**Fonte**: <link ou nome do documento e versão>
**Consultado em**: AAAA-MM-DD
```

A data importa mais aqui do que em qualquer outro doc do repositório: material fiscal desatualizado leva a decisão errada, e sem data ninguém sabe se ainda vale.

## Referências permanentes

| O quê                                       | Onde                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Portal da NF-e — serviços e documentação    | https://www.nfe.fazenda.gov.br                                                                                         |
| Relação de serviços web (Ambiente Nacional) | Portal NF-e → Serviços → Relação de Serviços Web                                                                       |
| Endpoints usados pela biblioteca            | [../../src/env/distribuicao.js](../../src/env/distribuicao.js), [../../src/env/recepcao.js](../../src/env/recepcao.js) |
