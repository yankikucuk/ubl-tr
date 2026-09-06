import { describe, expect, it } from 'vitest'

import { CURRENCY_DEFINITIONS, currencyDefinition, isValidCurrencyCode } from './currency.js'
import { FOREIGN_LICENSE_PLATE_SCHEMES, isValidLicensePlateScheme } from './despatch.js'
import { DocumentType, documentNamespace, UBL_VERSION_ID } from './document.js'
import { availableBillingDocumentTypes, InvoiceType } from './invoice.js'
import { Namespace, NamespacePrefix } from './namespace.js'
import {
  isValidPackagingTypeCode,
  PACKAGING_TYPE_DEFINITIONS,
  packagingTypeDefinition,
} from './packaging.js'
import { isKnownPartyIdentificationScheme, PARTY_IDENTIFICATION_SCHEMES } from './party-scheme.js'
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

describe('ambalaj cinsi kodları', () => {
  it('bilinen kodun Türkçe adını verir', () => {
    expect(packagingTypeDefinition('BX')?.name).toBe('Kutu')
    expect(packagingTypeDefinition('NE')?.name).toBe('Ambalajsız')
  })

  it('bilinmeyen kod için undefined döner', () => {
    expect(packagingTypeDefinition('XX')).toBeUndefined()
    expect(isValidPackagingTypeCode('XX')).toBe(false)
  })

  it('kod tablosu gömülü tanımın önüne geçer', () => {
    const tablolar = { packagingTypes: [{ code: 'BX', name: 'Özel kutu' }] }
    expect(packagingTypeDefinition('BX', tablolar)?.name).toBe('Özel kutu')
    expect(isValidPackagingTypeCode('ZZ', { packagingTypes: [{ code: 'ZZ', name: 'Yeni' }] })).toBe(
      true,
    )
  })

  it('kodlar benzersizdir', () => {
    const kodlar = PACKAGING_TYPE_DEFINITIONS.map((t) => t.code)
    expect(new Set(kodlar).size).toBe(kodlar.length)
  })
})

describe('para birimi listesi', () => {
  it('tablonun dizi hâli aynı tanımları taşır', () => {
    expect(CURRENCY_DEFINITIONS.map((c) => c.code)).toContain('TRY')
    expect(CURRENCY_DEFINITIONS.find((c) => c.code === 'JPY')?.minorUnits).toBe(0)
  })

  it('bilinmeyen kod geçersiz sayılır ama belge yine düzenlenebilir', () => {
    expect(isValidCurrencyCode('TRY')).toBe(true)
    expect(isValidCurrencyCode('XYZ')).toBe(false)
    // Tablo kapalı değildir: bilinmeyen kod için makul varsayılan üretilir.
    expect(currencyDefinition('XYZ').minorUnits).toBe(2)
  })

  it('kod tablosu bilinmeyen kodu tanımlı hâle getirir', () => {
    const tablolar = { currencies: [{ code: 'XYZ', minorUnits: 3, name: 'Deneme' }] }
    expect(isValidCurrencyCode('XYZ', tablolar)).toBe(true)
  })
})

describe('taraf kimlik şemaları', () => {
  it('bilinen şemayı tanır', () => {
    expect(isKnownPartyIdentificationScheme('ABONENO')).toBe(true)
    expect(isKnownPartyIdentificationScheme('TESISATNO')).toBe(true)
  })

  it('bilinmeyen şema için false döner ama liste kapalı değildir', () => {
    // Liste yalnızca arayüz içindir; buna dayanan bir doğrulama kuralı
    // yoktur, çünkü GİB listeyi genişlettiğinde doğru belgeyi reddederdi.
    expect(isKnownPartyIdentificationScheme('YENIKOD')).toBe(false)
  })

  it('şemalar benzersizdir', () => {
    expect(new Set(PARTY_IDENTIFICATION_SCHEMES).size).toBe(PARTY_IDENTIFICATION_SCHEMES.length)
  })
})

describe('iade atfı belge tipi', () => {
  it('iade tipinde faturanın kendi tipini verir', () => {
    expect(availableBillingDocumentTypes(InvoiceType.IADE)).toEqual([InvoiceType.IADE])
    expect(availableBillingDocumentTypes(InvoiceType.TEVKIFAT_IADE)).toEqual([
      InvoiceType.TEVKIFAT_IADE,
    ])
  })

  it('iade olmayan tipte boş liste verir', () => {
    expect(availableBillingDocumentTypes(InvoiceType.SATIS)).toEqual([])
  })
})
