import { describe, expect, it } from 'vitest'

import { Namespace } from '../../constants/index.js'
import {
  DoctypeNotAllowedError,
  MixedContentError,
  UnboundPrefixError,
  XmlLimitExceededError,
  XmlSyntaxError,
} from '../errors.js'

import { parseDocument } from './parse.js'

const INVOICE_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'

/** Küçük ama gerçekçi bir belge sarmalayıcısı. */
const belge = (icerik: string): string =>
  `<Invoice xmlns="${INVOICE_NS}" xmlns:cbc="${Namespace.COMMON_BASIC}" ` +
  `xmlns:cac="${Namespace.COMMON_AGGREGATE}">${icerik}</Invoice>`

describe('temel ayrıştırma', () => {
  it('kök öğeyi ve ad alanı bildirimlerini okur', () => {
    const { root, prefixes, defaultNamespace } = parseDocument(belge('<cbc:ID>X</cbc:ID>'))
    expect(root.name).toBe('Invoice')
    expect(root.namespace).toBe(INVOICE_NS)
    expect(defaultNamespace).toBe(INVOICE_NS)
    expect(prefixes).toEqual({
      cbc: Namespace.COMMON_BASIC,
      cac: Namespace.COMMON_AGGREGATE,
    })
  })

  it('ön ekleri ad alanı URI’sine çözer, silmez', () => {
    // REGRESYON — incelenen iki ayrıştırıcı da `removeNSPrefix: true`
    // kullanıyor. O anda `cbc:ID` ile `cac:ID` aynı anahtara düşer ve
    // ayırt edilemez hâle gelir.
    const { root } = parseDocument(
      belge(
        '<cbc:ID>alan</cbc:ID><cac:PartyIdentification><cbc:ID>taraf</cbc:ID></cac:PartyIdentification>',
      ),
    )
    const [birinci, ikinci] = root.kind === 'container' ? root.children : []
    expect(birinci?.namespace).toBe(Namespace.COMMON_BASIC)
    expect(ikinci?.namespace).toBe(Namespace.COMMON_AGGREGATE)
    expect(birinci?.name).toBe(ikinci?.name === 'PartyIdentification' ? 'ID' : 'ID')
  })

  it('kendiliğinden kapanan öğeyi boş yaprak olarak okur', () => {
    const { root } = parseDocument(belge('<cbc:Note/>'))
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.kind).toBe('leaf')
    expect(cocuk?.kind === 'leaf' ? cocuk.text : null).toBe('')
  })

  it('metni asla sayıya çevirmez', () => {
    // REGRESYON — tür tahmini yapan ayrıştırıcılarda VKN "1234567890"
    // `number`, "0123456789" `string` oluyor: aynı alanın tipi değere göre
    // değişiyor ve tüketici kodu değere göre patlıyor.
    const { root } = parseDocument(
      belge('<cbc:ID>1234567890</cbc:ID><cbc:UUID>0123456789</cbc:UUID>'),
    )
    const cocuklar = root.kind === 'container' ? root.children : []
    for (const cocuk of cocuklar) {
      expect(cocuk.kind === 'leaf' ? typeof cocuk.text : null).toBe('string')
    }
  })

  it('girintili belgedeki boşluğu atar', () => {
    const { root } = parseDocument(
      `<Invoice xmlns="${INVOICE_NS}" xmlns:cbc="${Namespace.COMMON_BASIC}">\n  <cbc:ID>X</cbc:ID>\n</Invoice>`,
    )
    expect(root.kind === 'container' ? root.children.length : 0).toBe(1)
  })
})

describe('güvenlik sınırları', () => {
  it('DOCTYPE bildirimini reddeder', () => {
    // XXE, varlık genişletme (billion laughs) ve karesel şişmenin tamamı
    // DTD üzerinden gelir. "Sınırlı destek" yerine tümden reddetmek bu
    // saldırı sınıfını ortadan kaldırır.
    expect(() =>
      parseDocument(`<!DOCTYPE Invoice [<!ENTITY a "x">]><Invoice xmlns="${INVOICE_NS}"/>`),
    ).toThrow(DoctypeNotAllowedError)
  })

  it('varlık bombasını DTD aşamasında durdurur', () => {
    const bomba =
      '<!DOCTYPE Invoice [<!ENTITY a "AAAAAAAAAA"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]>' +
      `<Invoice xmlns="${INVOICE_NS}"><cbc:ID>&b;</cbc:ID></Invoice>`
    expect(() => parseDocument(bomba)).toThrow(DoctypeNotAllowedError)
  })

  it('harici varlık başvurusunu reddeder', () => {
    expect(() =>
      parseDocument(`<Invoice xmlns="${INVOICE_NS}"><Note>&xxe;</Note></Invoice>`),
    ).toThrow(XmlSyntaxError)
  })

  it('derinlik sınırını uygular', () => {
    const derin = `<Invoice xmlns="${INVOICE_NS}">${'<a>'.repeat(60)}x${'</a>'.repeat(60)}</Invoice>`
    expect(() => parseDocument(derin, { maxDepth: 20 })).toThrow(XmlLimitExceededError)
    expect(() => parseDocument(derin, { maxDepth: 200 })).not.toThrow()
  })

  it('boyut sınırını ayrıştırmadan önce uygular', () => {
    let hata: unknown
    try {
      parseDocument(belge('<cbc:ID>X</cbc:ID>'), { maxSize: 10 })
    } catch (error) {
      hata = error
    }
    expect(hata).toBeInstanceOf(XmlLimitExceededError)
    expect((hata as XmlLimitExceededError).limit).toBe('size')
  })

  it('bildirilmemiş ön eki sessizce yok saymaz', () => {
    expect(() =>
      parseDocument(`<Invoice xmlns="${INVOICE_NS}"><cbc:ID>1</cbc:ID></Invoice>`),
    ).toThrow(UnboundPrefixError)
  })
})

describe('içerik türleri', () => {
  it('CDATA bölümünü ham metin olarak okur', () => {
    const { root } = parseDocument(belge('<cbc:Note><![CDATA[A & B <ham>]]></cbc:Note>'))
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.kind === 'leaf' ? cocuk.text : null).toBe('A & B <ham>')
  })

  it('yorumları atar', () => {
    const { root } = parseDocument(belge('<!-- açıklama --><cbc:ID>X</cbc:ID><!-- son -->'))
    expect(root.kind === 'container' ? root.children.length : 0).toBe(1)
  })

  it('önceden tanımlı ve sayısal başvuruları çözer', () => {
    const { root } = parseDocument(belge('<cbc:Note>A &amp; B &lt;x&gt; &#65; &#x42;</cbc:Note>'))
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.kind === 'leaf' ? cocuk.text : null).toBe('A & B <x> A B')
  })

  it('bilinmeyen varlık başvurusunu reddeder', () => {
    expect(() => parseDocument(belge('<cbc:Note>&sirket;</cbc:Note>'))).toThrow(XmlSyntaxError)
  })

  it('büyük base64 içeriği kısaltmaz', () => {
    // REGRESYON — incelenen bir dönüştürücü 1000 karakterden uzun base64
    // içeriği "#base64encoded" dizesiyle DEĞİŞTİRİYOR ve bu kapatılamıyor.
    // Gömülü bir PDF geri gelmiyor.
    const base64 = 'QUJD'.repeat(500)
    const { root } = parseDocument(
      belge(`<cbc:EmbeddedDocumentBinaryObject>${base64}</cbc:EmbeddedDocumentBinaryObject>`),
    )
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.kind === 'leaf' ? cocuk.text : '').toHaveLength(2000)
  })

  it('karışık içeriği reddeder', () => {
    expect(() => parseDocument(belge('metin<cbc:ID>1</cbc:ID>'))).toThrow(MixedContentError)
  })
})

describe('öznitelikler', () => {
  it('ad alanısız öznitelikleri okur', () => {
    const { root } = parseDocument(
      belge('<cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount>'),
    )
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.attributes).toEqual([{ name: 'currencyID', value: 'TRY' }])
  })

  it('ön ekli özniteliğin ad alanını korur', () => {
    const xml =
      `<Invoice xmlns="${INVOICE_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xsi:schemaLocation="${INVOICE_NS} UBL-Invoice-2.1.xsd"><Note>x</Note></Invoice>`
    const { root } = parseDocument(xml)
    expect(root.attributes[0]?.namespace).toBe('http://www.w3.org/2001/XMLSchema-instance')
    expect(root.attributes[0]?.name).toBe('schemaLocation')
  })

  it('varsayılan ad alanını özniteliklere uygulamaz', () => {
    // Namespaces in XML 1.0 §6.2: varsayılan ad alanı bildirimi ÖĞELERE
    // uygulanır, ÖZNİTELİKLERE uygulanmaz. Ön eksiz bir özniteliğin ad
    // alanı yoktur.
    const { root } = parseDocument(belge('<cbc:ID schemeID="VKN">1</cbc:ID>'))
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.attributes[0]?.namespace).toBeUndefined()
  })

  it('öznitelik değeri normalizasyonunu uygular', () => {
    // XML 1.0 §3.3.3: ham sekme/satır sonu tek boşluğa dönüşür, ama sayısal
    // başvurular normalizasyondan muaftır. Bu ayrım, bizim serileştiricinin
    // neden `&#xA;` yazdığını doğrular.
    const { root } = parseDocument(belge('<cbc:Note a="x&#xA;y" b="x\ny">1</cbc:Note>'))
    const cocuk = root.kind === 'container' ? root.children[0] : undefined
    expect(cocuk?.attributes.find((x) => x.name === 'a')?.value).toBe('x\ny')
    expect(cocuk?.attributes.find((x) => x.name === 'b')?.value).toBe('x y')
  })
})

describe('sözdizimi hataları', () => {
  it('eşleşmeyen kapanış etiketini konumuyla bildirir', () => {
    let hata: unknown
    try {
      parseDocument(belge('<cbc:ID>1</cbc:Name>'))
    } catch (error) {
      hata = error
    }
    expect(hata).toBeInstanceOf(XmlSyntaxError)
    const tipli = hata as XmlSyntaxError
    expect(tipli.code).toBe('XML_SYNTAX')
    expect(tipli.line).toBeGreaterThan(0)
    expect(tipli.column).toBeGreaterThan(0)
  })

  it('kök öğeden sonra fazladan içeriği reddeder', () => {
    expect(() => parseDocument(`${belge('<cbc:ID>1</cbc:ID>')}<Baska/>`)).toThrow(XmlSyntaxError)
  })

  it('aynı ön ekin iki farklı ad alanına bağlanmasını reddeder', () => {
    // Bildirimler kökte toplandığı için bu belge kayıpsız yeniden
    // yazılamaz. Sessizce birini seçmek yerine reddediyoruz.
    const xml =
      `<Invoice xmlns="${INVOICE_NS}" xmlns:p="urn:a"><p:X>1</p:X>` +
      `<Y xmlns:p="urn:b"><p:Z>2</p:Z></Y></Invoice>`
    expect(() => parseDocument(xml)).toThrow(XmlSyntaxError)
  })
})

describe('bozuk girdiye dayanıklılık', () => {
  const bozuk: [string, string][] = [
    ['boş girdi', ''],
    ['yalnızca boşluk', '   \n  '],
    ['kök öğe yok', '<?xml version="1.0"?>'],
    ['kapanmamış prolog yorumu', '<!-- açık'],
    ['kapanmamış prolog işlem talimatı', '<?islem'],
    ['kapanmamış son ek yorumu', `<Invoice xmlns="${INVOICE_NS}"/><!-- açık`],
    ['kapanmamış içerik işlem talimatı', `<Invoice xmlns="${INVOICE_NS}"><?islem</Invoice>`],
    ['kapanmamış içerik yorumu', `<Invoice xmlns="${INVOICE_NS}"><!-- açık</Invoice>`],
    ['kapanmamış CDATA', `<Invoice xmlns="${INVOICE_NS}"><![CDATA[abc</Invoice>`],
    ['kapanmamış etiket', `<Invoice xmlns="${INVOICE_NS}"`],
    ['kapanmamış öğe', `<Invoice xmlns="${INVOICE_NS}"><Note>x`],
    ['öznitelikte eşittir yok', `<Invoice xmlns="${INVOICE_NS}" a/>`],
    ['tırnaksız öznitelik değeri', `<Invoice xmlns="${INVOICE_NS}" a=x/>`],
    ['kapanmamış öznitelik değeri', `<Invoice xmlns="${INVOICE_NS}" a="x/>`],
    ['kapanış etiketinde > yok', `<Invoice xmlns="${INVOICE_NS}"><Note>x</Note`],
    ['ad yok', `<Invoice xmlns="${INVOICE_NS}"></>`],
    ['kapanmamış varlık', `<Invoice xmlns="${INVOICE_NS}"><Note>&amp</Note></Invoice>`],
    ['bozuk sayısal başvuru', `<Invoice xmlns="${INVOICE_NS}"><Note>&#zz;</Note></Invoice>`],
    ['bozuk onaltılık başvuru', `<Invoice xmlns="${INVOICE_NS}"><Note>&#xZZ;</Note></Invoice>`],
    ['aralık dışı başvuru', `<Invoice xmlns="${INVOICE_NS}"><Note>&#99999999;</Note></Invoice>`],
    ['gövdede DOCTYPE', `<Invoice xmlns="${INVOICE_NS}"><!DOCTYPE x></Invoice>`],
  ]

  it.each(bozuk)('%s → hata fırlatır, çökmez', (_ad, girdi) => {
    // Ayrıştırıcı dış girdiyle çalışır. Bozuk her belgede tanımlı bir hata
    // fırlatmalı; hiçbirinde sonsuz döngüye girmemeli ya da yığın taşmamalı.
    expect(() => parseDocument(girdi)).toThrow()
  })

  it('prolog ve son ekte yorum ile işlem talimatını kabul eder', () => {
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><!-- başlık -->` +
      `<Invoice xmlns="${INVOICE_NS}"><Note>x</Note></Invoice>` +
      `<!-- son --><?islem veri?>`
    expect(parseDocument(xml).root.name).toBe('Invoice')
  })

  it('tek tırnaklı öznitelik değerini okur', () => {
    const { root } = parseDocument(`<Invoice xmlns='${INVOICE_NS}' a='x'/>`)
    expect(root.attributes[0]?.value).toBe('x')
  })

  it('ad alanı bildirimsiz belgeyi boş ad alanıyla okur', () => {
    const { root, prefixes, defaultNamespace } = parseDocument('<Invoice><Note>x</Note></Invoice>')
    expect(root.namespace).toBe('')
    expect(defaultNamespace).toBeUndefined()
    expect(prefixes).toEqual({})
  })
})
