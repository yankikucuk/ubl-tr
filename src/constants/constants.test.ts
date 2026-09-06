import { describe, expect, it } from 'vitest'

import { FOREIGN_LICENSE_PLATE_SCHEMES, isValidLicensePlateScheme } from './despatch.js'
import { DocumentType, documentNamespace, UBL_VERSION_ID } from './document.js'
import { Namespace, NamespacePrefix } from './namespace.js'
import {
  isValidPaymentMeansCode,
  PAYMENT_MEANS_CODES,
  PAYMENT_MEANS_DEFINITIONS,
  paymentMeansDefinition,
} from './payment.js'

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

describe('ödeme şekli kod listesi', () => {
  it('adı bilinenler geçerli kümenin alt kümesidir', () => {
    // Adı olmayan bir kodu uydurmak yerine kod geçerli sayılır ve adı
    // `undefined` kalır. Bu ayrım kaybolursa ya geçerli kod reddedilir ya
    // da uydurma bir etiket belgeye yazılır.
    for (const tanim of PAYMENT_MEANS_DEFINITIONS) {
      expect(PAYMENT_MEANS_CODES.has(tanim.code)).toBe(true)
    }
    expect(PAYMENT_MEANS_CODES.size).toBeGreaterThan(PAYMENT_MEANS_DEFINITIONS.length)
  })

  it('geçerli ama adsız kodu doğru ele alır', () => {
    expect(isValidPaymentMeansCode('97')).toBe(true)
    expect(paymentMeansDefinition('97')).toBeUndefined()
    expect(paymentMeansDefinition('42')?.name).toBe('Havale/EFT')
  })
})

describe('plaka şemaları', () => {
  it('altı şemanın tamamını tanır', () => {
    for (const s of [
      'PLAKA',
      'DORSE',
      'DORSEPLAKA',
      'YABANCIPLAKA',
      'YABANCIDORSE',
      'YABANCIDORSEPLAKA',
    ]) {
      expect(isValidLicensePlateScheme(s)).toBe(true)
    }
    expect(isValidLicensePlateScheme('TIR')).toBe(false)
  })

  it('yabancı şemaları ayırt eder', () => {
    // Yabancı plakalar Türk plaka biçim kuralından muaftır.
    expect(FOREIGN_LICENSE_PLATE_SCHEMES.has('YABANCIPLAKA')).toBe(true)
    expect(FOREIGN_LICENSE_PLATE_SCHEMES.has('PLAKA')).toBe(false)
  })
})
