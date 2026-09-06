import { describe, expect, it } from 'vitest'

import { Namespace } from '../../constants/index.js'

import { fromJson, jsonToXml, toJson, xmlToJson } from './json.js'
import { container, leaf } from './node.js'
import { parseDocument } from './parse.js'
import { serializeDocument } from './serialize.js'

const INVOICE_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
const XSI = 'http://www.w3.org/2001/XMLSchema-instance'

/**
 * Gerçek bir e-faturanın taşıdığı her yapısal özelliği içeren belge:
 * ön ekli öznitelik, imza zarfı, tekrarlayan satır, parasal öznitelik,
 * kaçırma gerektiren metin, birden çok ad alanı.
 */
const GERCEKCI = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="${INVOICE_NS}" xmlns:cac="${Namespace.COMMON_AGGREGATE}" xmlns:cbc="${Namespace.COMMON_BASIC}" xmlns:ext="${Namespace.COMMON_EXTENSION}" xmlns:xsi="${XSI}" xsi:schemaLocation="${INVOICE_NS} UBL-Invoice-2.1.xsd"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>ABC2026000000001</cbc:ID><cbc:Note>Sınır Tanımaz A.Ş. &amp; Ortakları &lt;merkez&gt;</cbc:Note><cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">0123456789</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingSupplierParty><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">2.5</cbc:InvoicedQuantity></cac:InvoiceLine><cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="KGM">0.125</cbc:InvoicedQuantity></cac:InvoiceLine><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>`

describe('ağaç ile JSON arasında dönüşüm', () => {
  it('yaprak öğeyi çevirir', () => {
    expect(
      toJson(
        leaf(Namespace.COMMON_BASIC, 'PayableAmount', '1200.00', [
          { name: 'currencyID', value: 'TRY' },
        ]),
      ),
    ).toEqual({
      name: 'PayableAmount',
      ns: Namespace.COMMON_BASIC,
      attrs: { currencyID: 'TRY' },
      text: '1200.00',
    })
  })

  it('ad alanlı özniteliği James Clark gösterimiyle anahtarlar', () => {
    const json = toJson(
      leaf(INVOICE_NS, 'Invoice', '', [{ name: 'schemaLocation', value: 'x', namespace: XSI }]),
    )
    expect(json.attrs).toEqual({ [`{${XSI}}schemaLocation`]: 'x' })
  })

  it('tek alt öğe olsa bile children her zaman dizidir', () => {
    // REGRESYON — ada göre gruplayan dönüştürücülerde tek `InvoiceLine` bir
    // nesne, iki tanesi dizi olur. Tüketici kodu satır sayısına göre patlar.
    // İncelenen dönüştürücü bunu 30'dan fazla etiketlik sabit bir "her
    // zaman dizi" listesiyle yamalıyor; liste hiç tamamlanmıyor.
    const json = toJson(container(INVOICE_NS, 'Invoice', [leaf(Namespace.COMMON_BASIC, 'ID', '1')]))
    expect(Array.isArray('children' in json ? json.children : null)).toBe(true)
  })

  it('JSON’dan ağaca geri döner', () => {
    const agac = container(INVOICE_NS, 'Invoice', [
      leaf(Namespace.COMMON_BASIC, 'ID', 'ABC2026000000001'),
    ])
    expect(fromJson(toJson(agac))).toEqual(agac)
  })

  it('JSON’dan gelen bozuk değeri reddeder', () => {
    expect(() => fromJson({ name: 'Invoice Line', ns: INVOICE_NS, text: 'x' })).toThrow()
  })
})

describe('kayıpsız gidiş-dönüş', () => {
  it('XML → JSON → XML bayt bayt aynıdır', () => {
    expect(jsonToXml(xmlToJson(GERCEKCI))).toBe(GERCEKCI)
  })

  it('ikinci tur da aynıdır (idempotans)', () => {
    const birinci = jsonToXml(xmlToJson(GERCEKCI))
    expect(jsonToXml(xmlToJson(birinci))).toBe(birinci)
  })

  it('girintili girdi sıkışık ve kararlı çıktıya iner', () => {
    const girintili = serializeDocument(parseDocument(GERCEKCI).root, {
      defaultNamespace: INVOICE_NS,
      prefixes: xmlToJson(GERCEKCI).prefixes,
      format: 'indented',
    })
    expect(jsonToXml(xmlToJson(girintili))).toBe(GERCEKCI)
  })

  it('JSON diske yazılıp geri okunabilir', () => {
    const yazilan = JSON.stringify(xmlToJson(GERCEKCI))
    expect(jsonToXml(JSON.parse(yazilan) as ReturnType<typeof xmlToJson>)).toBe(GERCEKCI)
  })
})

describe('gidiş-dönüşte korunan veriler', () => {
  const json = xmlToJson(GERCEKCI)
  const bul = (
    dugum: ReturnType<typeof toJson>,
    ad: string,
  ): ReturnType<typeof toJson> | undefined => {
    if (dugum.name === ad) return dugum
    if (!('children' in dugum)) return undefined
    for (const cocuk of dugum.children) {
      const bulunan = bul(cocuk, ad)
      if (bulunan !== undefined) return bulunan
    }
    return undefined
  }

  it('imza zarfını (ext:UBLExtensions) korur', () => {
    // REGRESYON — incelenen dönüştürücü `UBLExtensions` ve `Signature`
    // öğelerini sabit bir yok sayma listesiyle SİLİYOR. İmza ayrıştırılan
    // JSON'a hiç girmiyor; belge geri kurulamıyor.
    expect(bul(json.root, 'UBLExtensions')).toBeDefined()
  })

  it('kaçırılmış metni doğru çözer ve geri kaçırır', () => {
    const not = bul(json.root, 'Note')
    expect(not !== undefined && 'text' in not ? not.text : null).toBe(
      'Sınır Tanımaz A.Ş. & Ortakları <merkez>',
    )
    expect(jsonToXml(json)).toContain('&amp; Ortakları &lt;merkez&gt;')
  })

  it('baştaki sıfırlı VKN’yi dize olarak korur', () => {
    const kimlik = bul(json.root, 'PartyIdentification')
    const id = kimlik !== undefined && 'children' in kimlik ? kimlik.children[0] : undefined
    expect(id !== undefined && 'text' in id ? id.text : null).toBe('0123456789')
  })

  it('tekrarlayan satırları ayrı tutar', () => {
    const satirlar =
      'children' in json.root ? json.root.children.filter((c) => c.name === 'InvoiceLine') : []
    expect(satirlar).toHaveLength(2)
  })

  it('ondalık hassasiyeti bozmaz', () => {
    expect(jsonToXml(json)).toContain('>0.125<')
  })

  it('ön ekli özniteliği korur', () => {
    expect(json.root.attrs?.[`{${XSI}}schemaLocation`]).toBe(`${INVOICE_NS} UBL-Invoice-2.1.xsd`)
  })
})

describe('sınır durumları', () => {
  it('özniteliksiz öğede attrs alanını hiç yazmaz', () => {
    expect(toJson(leaf(Namespace.COMMON_BASIC, 'ID', '1'))).toEqual({
      name: 'ID',
      ns: Namespace.COMMON_BASIC,
      text: '1',
    })
  })

  it('kapsayıcıda öznitelikleri korur', () => {
    const json = toJson(
      container(
        Namespace.COMMON_AGGREGATE,
        'Party',
        [leaf(Namespace.COMMON_BASIC, 'ID', '1')],
        [{ name: 'x', value: 'y' }],
      ),
    )
    expect(json.attrs).toEqual({ x: 'y' })
  })

  it('kapanışsız süslü parantezli anahtarı düz ad sayar', () => {
    // "{bozuk" gibi bir anahtar James Clark gösterimi değildir; ad alanı
    // uydurmak yerine adın kendisi kabul edilir.
    const agac = fromJson({ name: 'X', ns: 'urn:a', attrs: { _bozuk: 'v' }, text: '1' })
    expect(agac.attributes[0]).toEqual({ name: '_bozuk', value: 'v' })
  })

  it('varsayılan ad alanı olmayan belgeyi çevirir', () => {
    // Ad alanısız kök: `xmlns=""` bildirimi yok. Ön eksiz öğeler ad
    // alanısız kalır ve bildirim gerektirmeden geri yazılabilir.
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Invoice xmlns:cbc="${Namespace.COMMON_BASIC}"><cbc:ID>1</cbc:ID></Invoice>`
    const json = xmlToJson(xml)
    expect(json.defaultNamespace).toBeUndefined()
    expect(json.root.ns).toBe('')
    expect(jsonToXml(json)).toBe(xml)
  })

  it('girintili biçim seçeneğini geçirir', () => {
    expect(jsonToXml(xmlToJson(GERCEKCI), { format: 'indented' })).toContain(
      '\n  <cbc:UBLVersionID>',
    )
  })
})

describe('serileştirici ön ekli öznitelik denetimi', () => {
  it('bildirilmemiş öznitelik ad alanını reddeder', () => {
    const agac = container(INVOICE_NS, 'Invoice', [
      leaf(Namespace.COMMON_BASIC, 'ID', '1', [
        { name: 'schemaLocation', value: 'x', namespace: XSI },
      ]),
    ])
    expect(() =>
      serializeDocument(agac, {
        defaultNamespace: INVOICE_NS,
        prefixes: { cbc: Namespace.COMMON_BASIC },
      }),
    ).toThrow()
  })
})
