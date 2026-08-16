'use strict'

const SignedXml = require('xml-crypto').SignedXml

class Assinatura {
  /**
   *
   * @param {string} cert
   * @param {string} key
   * @param {string} xml
   * @returns {string}
   */
  static assinarXml(cert, key, xml) {
    const xpath = "//*[local-name(.)='infEvento']"
    const transforms = [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ]
    // A NF-e exige RSA-SHA1 e digest SHA1. Até a v2 o xml-crypto usava esses
    // algoritmos por padrão; a partir da v3 eles precisam ser informados.
    const sig = new SignedXml({
      privateKey: key,
      publicCert: cert,
      canonicalizationAlgorithm: transforms[1],
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      getKeyInfoContent: () =>
        `<X509Data><X509Certificate>${cert
          .split('-----')[2]
          .replace(/[\r\n]/g, '')}</X509Certificate></X509Data>`,
    })

    sig.addReference({
      xpath: xpath,
      transforms: transforms,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    })

    sig.computeSignature(xml, {
      location: {
        reference: xpath,
        action: 'after',
      },
    })

    return sig.getSignedXml()
  }
}

module.exports = Object.freeze(Assinatura)
