import { describe, expect, it } from 'vitest'

import { DocumentType, documentNamespace, UBL_VERSION_ID } from './document.js'
import { Namespace, NamespacePrefix } from './namespace.js'

describe('ad alanları', () => {
  it('hepsi mutlak URI', () => {
    for (const uri of Object.values(Namespace)) {
      expect(() => new URL(uri)).not.toThrow()
    }
  })

  it('her ad alanının bir ön eki var ve ön ekler benzersiz', () => {
    const prefixes = Object.values(Namespace).map((uri) => NamespacePrefix[uri])
    expect(prefixes).toHaveLength(Object.keys(Namespace).length)
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  it('UBL ortak bileşen ad alanları -2 ile biter', () => {
    // UBL 2.x ad alanları sürüm numarasını URI'nin sonunda taşır. Sondaki
    // "-2" düşerse belge UBL 1.0 ad alanına işaret eder ve şema doğrulaması
    // hiçbir açıklayıcı hata vermeden başarısız olur.
    for (const uri of [Namespace.COMMON_BASIC, Namespace.COMMON_AGGREGATE]) {
      expect(uri.endsWith('-2')).toBe(true)
    }
  })
})

describe('belge ad alanı üretimi', () => {
  it('kök öğe adını ad alanına yazar', () => {
    expect(documentNamespace(DocumentType.INVOICE)).toBe(
      'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    )
    expect(documentNamespace(DocumentType.DESPATCH_ADVICE)).toBe(
      'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
    )
  })

  it('her belge tipi için farklı bir ad alanı üretir', () => {
    const uris = Object.values(DocumentType).map(documentNamespace)
    expect(new Set(uris).size).toBe(uris.length)
  })

  it('kök öğe adları PascalCase ve boşluksuz', () => {
    // Bu, sabitlerdeki bir yazım hatasını yakalayan tek koruma: kök öğe adı
    // hem XML öğesi hem ad alanının parçası olduğu için buradaki bir sapma
    // iki yerde birden sessizce yanlış belge üretir.
    for (const name of Object.values(DocumentType)) {
      expect(name).toMatch(/^[A-Z][A-Za-z]+$/)
    }
  })
})

describe('sürüm sabitleri', () => {
  it('UBL sürümü 2.1', () => {
    expect(UBL_VERSION_ID).toBe('2.1')
  })
})
