import { describe, expect, it } from 'vitest'

import { DocumentType, documentNamespace, Namespace } from '../../constants/index.js'
import { UndeclaredNamespaceError } from '../errors.js'

import { container, leaf, optionalContainer, optionalLeaf } from './node.js'
import { serializeDocument } from './serialize.js'

const INVOICE_NS = documentNamespace(DocumentType.INVOICE)

/** UBL faturasının standart ad alanı yapılandırması. */
const UBL: Parameters<typeof serializeDocument>[1] = {
  defaultNamespace: INVOICE_NS,
  prefixes: {
    cac: Namespace.COMMON_AGGREGATE,
    cbc: Namespace.COMMON_BASIC,
    ext: Namespace.COMMON_EXTENSION,
  },
}

const kucukFatura = (): ReturnType<typeof container> =>
  container(INVOICE_NS, 'Invoice', [
    leaf(Namespace.COMMON_BASIC, 'UBLVersionID', '2.1'),
    leaf(Namespace.COMMON_BASIC, 'CustomizationID', 'TR1.2'),
    container(Namespace.COMMON_AGGREGATE, 'AccountingSupplierParty', [
      container(Namespace.COMMON_AGGREGATE, 'Party', [
        leaf(Namespace.COMMON_BASIC, 'WebsiteURI', 'https://ornek.example'),
      ]),
    ]),
  ])

describe('ad alanı çözümlemesi', () => {
  it('her alt öğeyi kendi ad alanının ön ekiyle yazar', () => {
    // REGRESYON — bu, incelenen rakiplerden birinin ölümcül hatası.
    // O kütüphane `cbc`/`cac`/`ext` ön eklerini kök öğede bildiriyor ama
    // hiçbir öğede kullanmıyordu. Ön eksiz her öğe varsayılan ad alanına
    // (Invoice-2) düşer; yani `UBLVersionID` CommonBasicComponents-2
    // yerine Invoice-2 ad alanında üretiliyordu ve belge XSD
    // doğrulamasından geçemiyordu. Canlı olarak doğrulandı.
    const xml = serializeDocument(kucukFatura(), UBL)
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>')
    expect(xml).toContain('<cac:AccountingSupplierParty>')
    expect(xml).not.toMatch(/<UBLVersionID[\s>]/)
    expect(xml).not.toMatch(/<AccountingSupplierParty[\s>]/)
  })

  it('kök öğeyi varsayılan ad alanında ön eksiz yazar', () => {
    const xml = serializeDocument(kucukFatura(), UBL)
    expect(xml).toContain(`<Invoice xmlns="${INVOICE_NS}"`)
  })

  it('bildirilmemiş ad alanını sessizce düşürmez, hata fırlatır', () => {
    const agac = container(INVOICE_NS, 'Invoice', [
      leaf(Namespace.XADES, 'SigningTime', '2026-09-06T00:00:00'),
    ])
    expect(() => serializeDocument(agac, UBL)).toThrow(UndeclaredNamespaceError)
  })

  it('tüm bildirimleri yalnızca kök öğede toplar', () => {
    const xml = serializeDocument(kucukFatura(), UBL)
    expect(xml.match(/xmlns:cbc=/g)).toHaveLength(1)
    expect(xml.match(/xmlns=/g)).toHaveLength(1)
  })
})

describe('determinizm', () => {
  it('aynı ağaç için bayt bayt aynı çıktıyı verir', () => {
    expect(serializeDocument(kucukFatura(), UBL)).toBe(serializeDocument(kucukFatura(), UBL))
  })

  it('ön ek bildirimlerinin sırası nesne anahtar sırasından bağımsızdır', () => {
    // Altın dosya testleri, çıktının girdi nesnesinin yazım sırasına
    // duyarlı OLMAMASINI gerektirir; aksi hâlde bir alanı yer değiştirmek
    // testleri kırar ama belgeyi değiştirmez.
    const a = serializeDocument(kucukFatura(), UBL)
    const b = serializeDocument(kucukFatura(), {
      defaultNamespace: INVOICE_NS,
      prefixes: {
        ext: Namespace.COMMON_EXTENSION,
        cbc: Namespace.COMMON_BASIC,
        cac: Namespace.COMMON_AGGREGATE,
      },
    })
    expect(a).toBe(b)
  })
})

describe('çıktı biçimi', () => {
  it('varsayılan olarak hiç boşluk üretmez', () => {
    // REGRESYON — en çok indirilen rakip `prettyPrint: true` varsayılanıyla
    // geliyor. Girinti, kapsayıcıların içine boşluk metin düğümleri sokar;
    // sarmalanmış XAdES imzasında bu düğümler imzalanan içeriğin parçasıdır
    // ve belge sonradan yeniden biçimlendirilirse imza geçersiz olur.
    const xml = serializeDocument(kucukFatura(), UBL)
    const govde = xml.slice(xml.indexOf('?>') + 2)
    expect(govde).not.toMatch(/>\s+</)
    expect(govde).not.toContain('\n')
  })

  it('istendiğinde girintili yazar', () => {
    const xml = serializeDocument(kucukFatura(), { ...UBL, format: 'indented' })
    expect(xml).toContain('\n  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>')
    expect(xml).toContain('\n      <cbc:WebsiteURI>')
  })

  it('XML bildirimini isteğe bağlı yazar', () => {
    expect(serializeDocument(kucukFatura(), UBL)).toMatch(/^<\?xml version="1\.0"/)
    expect(serializeDocument(kucukFatura(), { ...UBL, xmlDeclaration: false })).toMatch(/^<Invoice/)
  })

  it('boş öğeyi kanonik biçimde açılış/kapanış çifti olarak yazar', () => {
    // C14N 1.0 §2.3 `<a/>` biçimini hiç kullanmaz. Çıktıyı baştan kanonik
    // üretmek, imzalayıcının belgeyi yeniden yazmasını gereksiz kılar.
    const agac = container(INVOICE_NS, 'Invoice', [
      leaf(Namespace.COMMON_BASIC, 'Note', ''),
      container(Namespace.COMMON_AGGREGATE, 'Delivery', []),
    ])
    const xml = serializeDocument(agac, UBL)
    expect(xml).toContain('<cbc:Note></cbc:Note>')
    expect(xml).toContain('<cac:Delivery></cac:Delivery>')
    expect(xml).not.toContain('/>')
  })
})

describe('kaçırma serileştiricinin işidir', () => {
  it('ham metni çağıran kaçırmadan verir', () => {
    // REGRESYON — rakiplerde kaçırma çağıranın sorumluluğundaydı: `tag()`
    // ham içerik kabul ediyor, her çağrı noktası `escapeXml` çağırmayı
    // hatırlamak zorunda kalıyordu. Bir kez unutulduğunda çıktı bozuk ya da
    // enjekte edilebilir oluyor. Burada unutmak mümkün değil.
    const agac = container(INVOICE_NS, 'Invoice', [
      leaf(Namespace.COMMON_BASIC, 'Note', 'A & B <script>'),
    ])
    expect(serializeDocument(agac, UBL)).toContain('<cbc:Note>A &amp; B &lt;script&gt;</cbc:Note>')
  })

  it('öznitelik değerlerini de kaçırır', () => {
    const agac = container(INVOICE_NS, 'Invoice', [
      leaf(Namespace.COMMON_BASIC, 'PayableAmount', '1200.00', [
        { name: 'currencyID', value: 'A"B' },
      ]),
    ])
    expect(serializeDocument(agac, UBL)).toContain('currencyID="A&quot;B"')
  })
})

describe('isteğe bağlı öğeler', () => {
  it('boş değerde yaprak öğe üretmez', () => {
    expect(optionalLeaf(Namespace.COMMON_BASIC, 'PostalZone', undefined)).toBeUndefined()
    expect(optionalLeaf(Namespace.COMMON_BASIC, 'PostalZone', '   ')).toBeUndefined()
    expect(optionalLeaf(Namespace.COMMON_BASIC, 'PostalZone', '34710')).toBeDefined()
  })

  it('alt öğesi kalmayan kapsayıcı üretmez', () => {
    // REGRESYON — incelenen bir rakip tek satırlık bir faturada on adet boş
    // öğe üretiyordu (`<BuildingName></BuildingName>` gibi). Boş bir öğe,
    // olmayan bir öğeyle aynı şey değildir.
    const bos = optionalContainer(Namespace.COMMON_AGGREGATE, 'Contact', [
      optionalLeaf(Namespace.COMMON_BASIC, 'Telephone', undefined),
      optionalLeaf(Namespace.COMMON_BASIC, 'ElectronicMail', ''),
    ])
    expect(bos).toBeUndefined()

    const dolu = optionalContainer(Namespace.COMMON_AGGREGATE, 'Contact', [
      optionalLeaf(Namespace.COMMON_BASIC, 'Telephone', undefined),
      optionalLeaf(Namespace.COMMON_BASIC, 'ElectronicMail', 'a@b.example'),
    ])
    expect(dolu?.children).toHaveLength(1)
  })

  it('kapsayıcı undefined alt öğeleri ayıklar', () => {
    const oge = container(Namespace.COMMON_AGGREGATE, 'PostalAddress', [
      leaf(Namespace.COMMON_BASIC, 'CityName', 'İstanbul'),
      undefined,
      optionalLeaf(Namespace.COMMON_BASIC, 'PostalZone', undefined),
    ])
    expect(oge.children).toHaveLength(1)
  })
})

describe('öğe kurucuları', () => {
  it('aynı özniteliği iki kez kabul etmez', () => {
    expect(() =>
      leaf(Namespace.COMMON_BASIC, 'ID', 'x', [
        { name: 'schemeID', value: 'VKN' },
        { name: 'schemeID', value: 'TCKN' },
      ]),
    ).toThrow(/iki kez/)
  })

  it('üretilen öğeleri dondurur', () => {
    const oge = leaf(Namespace.COMMON_BASIC, 'ID', 'x')
    expect(Object.isFrozen(oge)).toBe(true)
    expect(Object.isFrozen(oge.attributes)).toBe(true)
  })
})
