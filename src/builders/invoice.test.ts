import { describe, expect, it } from 'vitest'

import { InvoiceProfile, InvoiceType, Namespace } from '../constants/index.js'
import { parseDocument, xmlToJson } from '../core/index.js'
import { formatAmount } from '../documents/index.js'

import { buildInvoice, buildInvoiceXml, type InvoiceInput } from './invoice.js'
import type { PartyInput } from './party.js'

const satici: PartyInput = {
  taxNumber: '1234567890',
  name: 'Satıcı A.Ş.',
  taxOffice: 'Üsküdar',
  address: { street: 'Cadde 1', district: 'Üsküdar', city: 'İstanbul', postalCode: '34664' },
}
const alici: PartyInput = {
  taxNumber: '9876543210',
  name: 'Alıcı Ltd. Şti.',
  address: { district: 'Kadıköy', city: 'İstanbul' },
}

const girdi = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  issueTime: '10:00:00',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.SATIS,
  supplier: satici,
  customer: alici,
  lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
  ...over,
})

/** Kök seviyesindeki öğe adlarını sırayla döndürür. */
const kokSirasi = (xml: string): string[] => {
  const kok = parseDocument(xml).root
  return kok.kind === 'container' ? kok.children.map((c) => c.name) : []
}

describe('belge yapısı', () => {
  it('UBL sırasına uyar', () => {
    // UBL `xsd:sequence` kullanır: doğru öğeleri YANLIŞ sırada yazmak
    // belgeyi geçersiz kılar. Sıra bu yüzden sabitlenir.
    expect(kokSirasi(buildInvoiceXml(girdi()))).toEqual([
      'UBLExtensions',
      'UBLVersionID',
      'CustomizationID',
      'ProfileID',
      'ID',
      'CopyIndicator',
      'UUID',
      'IssueDate',
      'IssueTime',
      'InvoiceTypeCode',
      'Note',
      'DocumentCurrencyCode',
      'LineCountNumeric',
      'Signature',
      'AccountingSupplierParty',
      'AccountingCustomerParty',
      'TaxTotal',
      'LegalMonetaryTotal',
      'InvoiceLine',
    ])
  })

  it('her öğeyi doğru ad alanına yazar', () => {
    const kok = parseDocument(buildInvoiceXml(girdi())).root
    const cocuklar = kok.kind === 'container' ? kok.children : []
    const bul = (ad: string): string | undefined => cocuklar.find((c) => c.name === ad)?.namespace
    expect(bul('UBLVersionID')).toBe(Namespace.COMMON_BASIC)
    expect(bul('AccountingSupplierParty')).toBe(Namespace.COMMON_AGGREGATE)
    expect(bul('UBLExtensions')).toBe(Namespace.COMMON_EXTENSION)
  })

  it('sabit başlık alanlarını yazar', () => {
    const xml = buildInvoiceXml(girdi())
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>')
    expect(xml).toContain('<cbc:CustomizationID>TR1.2</cbc:CustomizationID>')
    expect(xml).toContain('<cbc:LineCountNumeric>1</cbc:LineCountNumeric>')
  })

  it('imza zarfı ve imza bloğu isteğe bağlıdır', () => {
    const acik = kokSirasi(buildInvoiceXml(girdi()))
    expect(acik).toContain('UBLExtensions')
    expect(acik).toContain('Signature')
    const kapali = kokSirasi(
      buildInvoiceXml(girdi(), { includeUblExtensions: false, includeSignature: false }),
    )
    expect(kapali).not.toContain('UBLExtensions')
    expect(kapali).not.toContain('Signature')
  })

  it('çıktı deterministiktir', () => {
    expect(buildInvoiceXml(girdi())).toBe(buildInvoiceXml(girdi()))
  })

  it('varsayılan çıktı boşluksuzdur', () => {
    const xml = buildInvoiceXml(girdi())
    expect(xml.slice(xml.indexOf('?>') + 2)).not.toMatch(/>\s+</)
  })
})

describe('tutarlar', () => {
  it('toplamları kendi hesaplar, çağırandan almaz', () => {
    // Çağıranın verdiği toplama güvenen bir tasarımda girdi tutarsızsa
    // belge GİB'de reddedilir ve hata çok geç ortaya çıkar. Burada
    // toplamların satırlarla tutarlılığı yapısal bir garantidir.
    const { totals } = buildInvoice(girdi())
    expect(formatAmount(totals.lineExtensionAmount)).toBe('1000.00')
    expect(formatAmount(totals.payableAmount)).toBe('1200.00')
  })

  it('tevkifat bloğunu yalnız gerektiğinde yazar', () => {
    const yok = kokSirasi(buildInvoiceXml(girdi()))
    expect(yok).not.toContain('WithholdingTaxTotal')

    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.TEVKIFAT,
        lines: [
          { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
        ],
      }),
    )
    expect(kokSirasi(xml)).toContain('WithholdingTaxTotal')
    expect(xml).toContain('<cbc:TaxTypeCode>603</cbc:TaxTypeCode>')
    expect(xml).toContain('<cbc:PayableAmount currencyID="TRY">1060.00</cbc:PayableAmount>')
  })

  it('her KDV oranı için ayrı alt toplam yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        lines: [
          { name: 'A', quantity: 10, unitPrice: 10, vatRate: 1 },
          { name: 'B', quantity: 10, unitPrice: 20, vatRate: 10 },
          { name: 'C', quantity: 10, unitPrice: 30, vatRate: 20 },
        ],
      }),
    )
    const kok = xmlToJson(xml).root
    const taxTotal = 'children' in kok ? kok.children.find((c) => c.name === 'TaxTotal') : undefined
    const altToplamlar =
      taxTotal !== undefined && 'children' in taxTotal
        ? taxTotal.children.filter((c) => c.name === 'TaxSubtotal')
        : []
    expect(altToplamlar).toHaveLength(3)
  })

  it('iskontoyu satır ve toplam düzeyinde yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20, discountRate: 10 }],
      }),
    )
    expect(xml).toContain('<cac:AllowanceCharge>')
    expect(xml).toContain('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>')
    expect(xml).toContain(
      '<cbc:AllowanceTotalAmount currencyID="TRY">100.00</cbc:AllowanceTotalAmount>',
    )
  })

  it('hassas miktarı kırpmaz', () => {
    // Sabit iki basamak `0,125 kg`'ı `0.13`'e yuvarlayıp veriyi imha ederdi.
    const xml = buildInvoiceXml(
      girdi({
        lines: [
          { name: 'Ceviz', quantity: '0.125', unitPrice: '33.33', vatRate: 1, unitCode: 'KGM' },
        ],
      }),
    )
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="KGM">0.125</cbc:InvoicedQuantity>')
  })

  it('yazıyla tutar notunu ilk sıraya yazar ve kapatılabilir', () => {
    expect(buildInvoiceXml(girdi())).toContain(
      '<cbc:Note>YALNIZ #Bin İki Yüz Türk Lirası#</cbc:Note>',
    )
    expect(buildInvoiceXml(girdi(), { amountInWords: { case: 'upper' } })).toContain(
      'BİN İKİ YÜZ TÜRK LİRASI',
    )
    expect(buildInvoiceXml(girdi(), { amountInWords: false })).not.toContain('YALNIZ')
  })

  it('serbest notları yazıyla tutardan sonra yazar', () => {
    const xml = buildInvoiceXml(girdi({ notes: ['Sipariş no: 42'] }))
    expect(xml.indexOf('YALNIZ')).toBeLessThan(xml.indexOf('Sipariş no: 42'))
  })
})

describe('profil ve tip denetimi', () => {
  it('uyumsuz eşleşmeyi reddeder', () => {
    // GİB bunu yalnızca Schematron ile denetler; XSD denetlemez. Yani
    // uyumsuz belge `xmllint` ile şema doğrulamasından GEÇER ve karşı
    // tarafta reddedilir.
    expect(() =>
      buildInvoiceXml(girdi({ profile: InvoiceProfile.TICARI, type: InvoiceType.IADE })),
    ).toThrow(/kullanılamaz/)
    expect(() =>
      buildInvoiceXml(girdi({ profile: InvoiceProfile.IHRACAT, type: InvoiceType.SATIS })),
    ).toThrow()
  })

  it('denetim kapatılabilir', () => {
    expect(() =>
      buildInvoiceXml(girdi({ profile: InvoiceProfile.IHRACAT, type: InvoiceType.SATIS }), {
        validateProfileType: false,
      }),
    ).not.toThrow()
  })

  it('iade tipinde asıl faturaya atıf zorunludur', () => {
    expect(() => buildInvoiceXml(girdi({ type: InvoiceType.IADE }))).toThrow(/billingReference/)
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.IADE,
        billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
      }),
    )
    expect(xml).toContain('<cac:BillingReference>')
    expect(kokSirasi(xml).indexOf('BillingReference')).toBeLessThan(
      kokSirasi(xml).indexOf('Signature'),
    )
  })
})

describe('taraflar', () => {
  it('vergi numarası türünü kontrol basamağından belirler', () => {
    const xml = buildInvoiceXml(girdi())
    expect(xml).toContain('<cbc:ID schemeID="VKN">1234567890</cbc:ID>')
  })

  it('gerçek kişide PartyName yerine Person yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        customer: {
          taxNumber: '52040077498',
          name: 'Ayşe Yılmaz',
          address: { district: 'Çankaya', city: 'Ankara' },
          person: { firstName: 'Ayşe', familyName: 'Yılmaz' },
        },
      }),
    )
    expect(xml).toContain('<cbc:ID schemeID="TCKN">52040077498</cbc:ID>')
    expect(xml).toContain('<cac:Person><cbc:FirstName>Ayşe</cbc:FirstName>')
    expect(xml).not.toContain('<cbc:Name>Ayşe Yılmaz</cbc:Name>')
  })

  it('adres zorunlu alanlarını her zaman yazar', () => {
    // GİB paketinde CitySubdivisionName, CityName ve Country zorunludur —
    // stok OASIS şemasında isteğe bağlı olsalar bile.
    const xml = buildInvoiceXml(girdi())
    expect(xml).toContain('<cbc:CitySubdivisionName>Kadıköy</cbc:CitySubdivisionName>')
    expect(xml).toContain('<cbc:CityName>İstanbul</cbc:CityName>')
    expect(xml).toContain('<cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>')
  })

  it('boş iletişim bloğu yazmaz', () => {
    expect(buildInvoiceXml(girdi())).not.toContain('<cac:Contact></cac:Contact>')
  })
})

describe('kaçış ve para birimi', () => {
  it('ünvandaki XML meta karakterlerini kaçırır', () => {
    const xml = buildInvoiceXml(girdi({ supplier: { ...satici, name: 'A & B <Ltd> "Şti"' } }))
    expect(xml).toContain('<cbc:Name>A &amp; B &lt;Ltd&gt; "Şti"</cbc:Name>')
    expect(() => parseDocument(xml)).not.toThrow()
  })

  it('para biriminin ondalık basamağını uygular', () => {
    const xml = buildInvoiceXml(
      girdi({
        currencyCode: 'JPY',
        lines: [{ name: 'x', quantity: 3, unitPrice: '1000.5', vatRate: 0 }],
      }),
    )
    expect(xml).toContain('<cbc:PayableAmount currencyID="JPY">3002</cbc:PayableAmount>')
  })
})

describe('muafiyet, iskonto oranı ve kalem tanımlayıcıları', () => {
  it('muafiyet açıklamasını koddan tamamlar', () => {
    // Yalnızca kodu yazıp açıklamayı atlamak yaygın bir eksik; açıklama
    // belgenin insan tarafından okunan görüntüsünde de yer alır.
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.ISTISNA,
        lines: [
          { name: 'İhracat', quantity: 1, unitPrice: 1000, vatRate: 0, exemptionCode: '351' },
        ],
      }),
    )
    expect(xml).toContain('<cbc:TaxExemptionReasonCode>351</cbc:TaxExemptionReasonCode>')
    expect(xml).toContain('<cbc:TaxExemptionReason>')
  })

  it('açıkça verilen açıklama tablodakini geçersiz kılar', () => {
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.ISTISNA,
        lines: [
          {
            name: 'x',
            quantity: 1,
            unitPrice: 100,
            vatRate: 0,
            exemptionCode: '351',
            exemptionReason: 'Kendi açıklamam',
          },
        ],
      }),
    )
    expect(xml).toContain('<cbc:TaxExemptionReason>Kendi açıklamam</cbc:TaxExemptionReason>')
  })

  it('iskonto oranını çarpan olarak yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        lines: [{ name: 'x', quantity: 10, unitPrice: 100, vatRate: 20, discountRate: 10 }],
      }),
    )
    expect(xml).toContain('<cbc:MultiplierFactorNumeric>0.1</cbc:MultiplierFactorNumeric>')
  })

  it('bedelsiz satırda sıfıra bölme üretmez', () => {
    // REGRESYON — çarpanı `iskonto / brüt` ile hesaplayan bir uygulama,
    // brüt sıfırken `Infinity` üretip belgeye yazar. Burada oran doğrudan
    // girdiden gelir; bölme hiç yapılmaz.
    //
    // İki bedelsiz durum ayrı ayrı denenir: oranla verilen iskontoda tutar
    // sıfır çıkar ve blok hiç yazılmaz; tutarla verilende blok yazılır ama
    // çarpan hesaplanmaz.
    const oranla = buildInvoiceXml(
      girdi({
        lines: [{ name: 'Promosyon', quantity: 1, unitPrice: 0, vatRate: 20, discountRate: 10 }],
      }),
    )
    expect(oranla).not.toContain('Infinity')
    expect(oranla).not.toContain('NaN')
    expect(oranla).not.toContain('<cac:AllowanceCharge>')

    const tutarla = buildInvoiceXml(
      girdi({
        lines: [{ name: 'Promosyon', quantity: 1, unitPrice: 0, vatRate: 20, discountAmount: 5 }],
      }),
    )
    expect(tutarla).not.toContain('Infinity')
    expect(tutarla).not.toContain('NaN')
    expect(tutarla).toContain('<cbc:BaseAmount currencyID="TRY">0.00</cbc:BaseAmount>')
  })
  it('iskonto tutarla verildiğinde çarpan yazmaz', () => {
    const xml = buildInvoiceXml(
      girdi({
        lines: [{ name: 'x', quantity: 10, unitPrice: 100, vatRate: 20, discountAmount: 250 }],
      }),
    )
    expect(xml).not.toContain('MultiplierFactorNumeric')
    expect(xml).toContain('<cbc:Amount currencyID="TRY">250.00</cbc:Amount>')
  })

  it('kalem ek tanımlayıcılarını yazar', () => {
    // HKS'de her kalemde 19 karakterlik künye numarası zorunludur.
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.HKS,
        type: InvoiceType.HKS_SATIS,
        lines: [
          {
            name: 'Domates',
            quantity: 500,
            unitPrice: 20,
            vatRate: 10,
            unitCode: 'KGM',
            additionalIdentifications: [{ schemeId: 'KUNYENO', value: 'KUN-2026-042-DOM001' }],
          },
        ],
      }),
    )
    expect(xml).toContain(
      '<cac:AdditionalItemIdentification><cbc:ID schemeID="KUNYENO">KUN-2026-042-DOM001</cbc:ID></cac:AdditionalItemIdentification>',
    )
  })

  it('iade atfına belge tipini yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.IADE,
        billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
      }),
    )
    expect(xml).toContain('<cbc:DocumentTypeCode>IADE</cbc:DocumentTypeCode>')
  })
})

describe('sipariş, ödeme ve döviz kuru', () => {
  it('sipariş atfını iade atfından önce yazar', () => {
    const xml = buildInvoiceXml(
      girdi({ orderReference: { id: 'PO-2026-04-000099', issueDate: '2026-04-15' } }),
    )
    expect(xml).toContain('<cbc:ID>PO-2026-04-000099</cbc:ID>')
    const sira = kokSirasi(xml)
    expect(sira.indexOf('OrderReference')).toBeLessThan(sira.indexOf('Signature'))
  })

  it('ödeme bilgisini yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        paymentMeans: {
          meansCode: '42',
          dueDate: '2026-05-23',
          accountNumber: 'TR330006100519786457841326',
          note: '30 gün vadeli',
        },
      }),
    )
    expect(xml).toContain('<cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>')
    expect(xml).toContain('<cbc:PaymentDueDate>2026-05-23</cbc:PaymentDueDate>')
    expect(xml).toContain('<cbc:ID>TR330006100519786457841326</cbc:ID>')
    expect(xml).toContain('<cbc:PaymentNote>30 gün vadeli</cbc:PaymentNote>')
  })

  it('hesap bilgisi yoksa boş kapsayıcı yazmaz', () => {
    const xml = buildInvoiceXml(girdi({ paymentMeans: { meansCode: '10' } }))
    expect(xml).toContain('<cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>')
    expect(xml).not.toContain('PayeeFinancialAccount')
  })

  it('döviz kurunu altı basamakla yazar', () => {
    // Kur hassasiyeti Türk lirası karşılığını belirler; iki basamağa
    // kırpmak büyük tutarlarda kuruş farkı yaratır.
    const xml = buildInvoiceXml(girdi({ currencyCode: 'EUR', exchangeRate: { rate: 36.75 } }))
    expect(xml).toContain('<cbc:SourceCurrencyCode>EUR</cbc:SourceCurrencyCode>')
    expect(xml).toContain('<cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode>')
    expect(xml).toContain('<cbc:CalculationRate>36.750000</cbc:CalculationRate>')
  })
})

describe('taraf genişletmeleri', () => {
  it('TCKN tarafında adı ad ve soyada ayırır', () => {
    const xml = buildInvoiceXml(
      girdi({
        customer: {
          taxNumber: '52040077498',
          name: 'Ayşe Nur Yılmaz',
          address: { district: 'Beşiktaş', city: 'İstanbul' },
        },
      }),
    )
    expect(xml).toContain('<cbc:FirstName>Ayşe Nur</cbc:FirstName>')
    expect(xml).toContain('<cbc:FamilyName>Yılmaz</cbc:FamilyName>')
    expect(xml).not.toContain('<cbc:Name>Ayşe Nur Yılmaz</cbc:Name>')
  })

  it('açıkça verilen ad soyad türetmeyi geçersiz kılar', () => {
    // Türetme belirsizdir; çok parçalı soyadlarında yanlış böler. Doğru
    // bölmeyi yalnızca veriyi giren bilir.
    const xml = buildInvoiceXml(
      girdi({
        customer: {
          taxNumber: '52040077498',
          name: 'Ayşe van der Berg',
          address: { district: 'Beşiktaş', city: 'İstanbul' },
          person: { firstName: 'Ayşe', familyName: 'van der Berg' },
        },
      }),
    )
    expect(xml).toContain('<cbc:FamilyName>van der Berg</cbc:FamilyName>')
  })

  it('ek taraf tanımlayıcılarını yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        customer: {
          ...alici,
          identifications: [{ schemeId: 'MUSTERINO', value: 'KAMU-2026-42' }],
        },
      }),
    )
    expect(xml).toContain('<cbc:ID schemeID="MUSTERINO">KAMU-2026-42</cbc:ID>')
  })

  it('ticaret unvanını yazar', () => {
    const xml = buildInvoiceXml(
      girdi({ customer: { ...alici, legalRegistrationName: 'Alıcı Limited Şirketi' } }),
    )
    expect(xml).toContain(
      '<cac:PartyLegalEntity><cbc:RegistrationName>Alıcı Limited Şirketi</cbc:RegistrationName></cac:PartyLegalEntity>',
    )
  })

  it('aracı alıcıyı alıcıdan sonra yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.KAMU,
        buyerCustomer: {
          taxNumber: '3333333333',
          name: 'Kamu İhale Kurumu',
          address: { district: 'Çankaya', city: 'Ankara' },
        },
      }),
    )
    const sira = kokSirasi(xml)
    expect(sira.indexOf('BuyerCustomerParty')).toBe(sira.indexOf('AccountingCustomerParty') + 1)
  })

  it('WebsiteURI’yi taraf sırasının başına yazar', () => {
    // UBL 2.1 `cac:Party` sequence'ında `cbc:WebsiteURI` İLK öğedir.
    // Sona koymak belgeyi şema dışı bırakır — ilk hâlde bu hata vardı.
    const xml = buildInvoiceXml(
      girdi({ supplier: { ...satici, website: 'https://ornek.example' } }),
    )
    expect(xml).toContain(
      '<cac:Party><cbc:WebsiteURI>https://ornek.example</cbc:WebsiteURI><cac:PartyIdentification>',
    )
  })
})

describe('teslim ve ihracat', () => {
  it('teslim bilgisini satır içinde ve doğru sırada yazar', () => {
    // UBL `cac:InvoiceLineType` sequence'ında `cac:Delivery`,
    // `cac:AllowanceCharge` ve `cac:TaxTotal`'dan ÖNCE gelir.
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.ISTISNA,
        lines: [
          {
            name: 'İhraç ürünü',
            quantity: 1,
            unitPrice: 1000,
            vatRate: 0,
            exemptionCode: '301',
            delivery: {
              address: { street: 'Ambarlı Limanı', district: 'Avcılar', city: 'İstanbul' },
              deliveryTermCode: 'FOB',
              customsTariffNumber: '620342000010',
            },
          },
        ],
      }),
    )
    expect(xml).toContain('<cac:DeliveryAddress>')
    expect(xml).toContain('<cbc:ID schemeID="INCOTERMS">FOB</cbc:ID>')
    expect(xml).toContain('<cbc:RequiredCustomsID>620342000010</cbc:RequiredCustomsID>')
    // Sıra SATIR İÇİNDE denetlenir: belgede kök düzeyinde de bir
    // `cac:TaxTotal` vardır ve metin üzerinde arama onu yakalar.
    const kok = parseDocument(xml).root
    const satir =
      kok.kind === 'container' ? kok.children.find((c) => c.name === 'InvoiceLine') : undefined
    const satirSirasi = satir?.kind === 'container' ? satir.children.map((c) => c.name) : []
    expect(satirSirasi.indexOf('Delivery')).toBeGreaterThan(-1)
    expect(satirSirasi.indexOf('Delivery')).toBeLessThan(satirSirasi.indexOf('TaxTotal'))
    expect(satirSirasi.indexOf('Delivery')).toBeGreaterThan(
      satirSirasi.indexOf('LineExtensionAmount'),
    )
  })

  it('gümrük beyannamesini düzenleyeni sarmalamadan yazar', () => {
    // REGRESYON — `cac:IssuerParty` bir PartyType'tır: içeriği doğrudan
    // taraf alanlarıdır. Ayrıca `cac:Party` ile sarmalamak fazladan bir
    // seviye ekler ve belgeyi şema dışı bırakır.
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.IHRAC_KAYITLI,
        lines: [
          {
            name: 'x',
            quantity: 1,
            unitPrice: 100,
            vatRate: 0,
            exemptionCode: '701',
            delivery: {
              customsTariffNumber: '620342000010',
              customsDeclaration: {
                issuerParty: {
                  taxNumber: '12345678901',
                  identificationSchemeId: 'ALICIDIBSATIRKOD',
                  name: 'İhracat Aracı Kurumu A.Ş.',
                  address: { district: 'Kadıköy', city: 'İstanbul' },
                },
              },
            },
          },
        ],
      }),
    )
    expect(xml).toContain('<cac:IssuerParty><cac:PartyIdentification>')
    expect(xml).not.toContain('<cac:IssuerParty><cac:Party>')
    // Açık şema verildiğinde on bir hane gerçek kişi sayılmaz:
    // PartyName yazılır, Person türetilmez.
    expect(xml).toContain('<cbc:Name>İhracat Aracı Kurumu A.Ş.</cbc:Name>')
    expect(xml).toContain('<cbc:ID schemeID="ALICIDIBSATIRKOD">12345678901</cbc:ID>')
  })

  it('belge düzeyinde teslim ve taşıyıcı yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.EARSIV,
        delivery: {
          actualDeliveryDate: '2026-04-25',
          carrierParty: {
            taxNumber: '5555555555',
            name: 'Hızlı Kargo A.Ş.',
            address: { district: 'Sultangazi', city: 'İstanbul' },
          },
        },
      }),
    )
    expect(xml).toContain('<cbc:ActualDeliveryDate>2026-04-25</cbc:ActualDeliveryDate>')
    expect(xml).toContain('<cac:CarrierParty><cac:PartyIdentification>')
  })
})

describe('belge atıfları ve kalem ayrıntıları', () => {
  it('genel belge atıflarını sırayla yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        accountingCost: 'SAGLIK_ECZ',
        additionalDocuments: [
          {
            id: '.',
            issueDate: '2026-04-23',
            documentTypeCode: 'DOSYA_NO',
            documentType: 'SGK-1',
            description: 'Döküm No',
          },
          {
            id: '.',
            issueDate: '2026-04-23',
            documentTypeCode: 'SGK_COMPANY_CODE',
            documentType: 'C-42',
          },
        ],
      }),
    )
    expect(xml).toContain('<cbc:AccountingCost>SAGLIK_ECZ</cbc:AccountingCost>')
    expect(xml).toContain('<cbc:DocumentTypeCode>DOSYA_NO</cbc:DocumentTypeCode>')
    expect(xml).toContain('<cbc:DocumentDescription>Döküm No</cbc:DocumentDescription>')
    expect(xml.match(/<cac:AdditionalDocumentReference>/g)).toHaveLength(2)
    // `cbc:AccountingCost` UBL sırasında `cbc:LineCountNumeric`'ten ÖNCE gelir.
    expect(xml.indexOf('AccountingCost')).toBeLessThan(xml.indexOf('LineCountNumeric'))
  })

  it('sözleşme atfını şemasıyla yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.YATIRIM_TESVIK,
        contractDocument: { id: '123456', schemeId: 'YTBNO', issueDate: '2026-01-15' },
      }),
    )
    expect(xml).toContain('<cbc:ID schemeID="YTBNO">123456</cbc:ID>')
  })

  it('kalem marka, model, sınıflandırma ve seri bilgisini yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.YATIRIM_TESVIK,
        lines: [
          {
            name: 'Sanayi Tipi Kompresör',
            quantity: 1,
            unitPrice: 600,
            vatRate: 12,
            brandName: 'DemoMakine',
            modelName: 'DMK-2000',
            classificationCode: '01',
            productTraceId: 'KOMP-2026-0001',
            serialId: 'SN-2026-000001',
          },
        ],
      }),
    )
    expect(xml).toContain('<cbc:BrandName>DemoMakine</cbc:BrandName>')
    expect(xml).toContain('<cbc:ModelName>DMK-2000</cbc:ModelName>')
    expect(xml).toContain(
      '<cac:CommodityClassification><cbc:ItemClassificationCode>01</cbc:ItemClassificationCode></cac:CommodityClassification>',
    )
    expect(xml).toContain('<cbc:SerialID>SN-2026-000001</cbc:SerialID>')
  })

  it('kalem ayrıntısı yoksa boş kapsayıcı yazmaz', () => {
    expect(buildInvoiceXml(girdi())).not.toContain('ItemInstance')
  })
})

describe('fatura dönemi ve iade aracısı', () => {
  it('fatura dönemini yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.ENERJI,
        type: InvoiceType.SARJ,
        invoicePeriod: {
          startDate: '2026-04-01',
          startTime: '00:00:00',
          endDate: '2026-04-23',
          endTime: '15:00:00',
        },
      }),
    )
    expect(xml).toContain(
      '<cac:InvoicePeriod><cbc:StartDate>2026-04-01</cbc:StartDate><cbc:StartTime>00:00:00</cbc:StartTime><cbc:EndDate>2026-04-23</cbc:EndDate><cbc:EndTime>15:00:00</cbc:EndTime></cac:InvoicePeriod>',
    )
  })

  it('KDV iade aracısını özel şemalarla yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.YOLCU_BERABER,
        type: InvoiceType.ISTISNA,
        lines: [{ name: 'x', quantity: 1, unitPrice: 800, vatRate: 0, exemptionCode: '336' }],
        taxRepresentative: {
          taxNumber: '9876543210',
          name: 'Turizm KDV İade Aracı',
          label: 'TAXFREE_ARACI',
        },
      }),
    )
    expect(xml).toContain('<cbc:ID schemeID="ARACIKURUMVKN">9876543210</cbc:ID>')
    expect(xml).toContain('<cbc:ID schemeID="ARACIKURUMETIKET">TAXFREE_ARACI</cbc:ID>')
    // Aracı kurum adres taşımaz.
    expect(xml).not.toContain('<cac:TaxRepresentativeParty><cac:PostalAddress>')
  })

  it('uyruk ve pasaportu ad soyad olmadan da yazar', () => {
    // `cac:Person` ad-soyad OLMADAN da yazılabilir: alıcı tüzel kişi olsa
    // bile uyruk ve pasaport bilgisi bu blokta taşınır.
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.YOLCU_BERABER,
        type: InvoiceType.ISTISNA,
        lines: [{ name: 'x', quantity: 1, unitPrice: 800, vatRate: 0, exemptionCode: '336' }],
        customer: { ...alici, nationalityId: 'DE', identityDocumentId: 'N12345678' },
      }),
    )
    expect(xml).toContain(
      '<cac:Person><cbc:NationalityID>DE</cbc:NationalityID><cac:IdentityDocumentReference><cbc:ID>N12345678</cbc:ID></cac:IdentityDocumentReference></cac:Person>',
    )
  })
})

describe('belge atıfları', () => {
  it('irsaliye, makbuz ve sipariş kaynağı atıflarını UBL sırasında yazar', () => {
    // UBL sırası: BillingReference → Despatch → Receipt → Originator →
    // Contract → Additional. Doğru öğeleri yanlış sırada yazmak belgeyi
    // geçersiz kılar, bu yüzden sıranın kendisi doğrulanır.
    const sira = kokSirasi(
      buildInvoiceXml(
        girdi({
          type: InvoiceType.IADE,
          billingReference: { id: 'ABC2025000000009', issueDate: '2025-12-01' },
          despatchDocumentReferences: [{ id: 'IRS-1', issueDate: '2026-09-01' }],
          receiptDocumentReferences: [{ id: 'MKB-1' }],
          originatorDocumentReferences: [{ id: 'IHL-1' }],
          contractDocument: { id: 'SZL-1' },
          additionalDocuments: [{ id: 'EK-1' }],
        }),
      ),
    )
    expect(sira.slice(sira.indexOf('BillingReference'), sira.indexOf('Signature'))).toEqual([
      'BillingReference',
      'DespatchDocumentReference',
      'ReceiptDocumentReference',
      'OriginatorDocumentReference',
      'ContractDocumentReference',
      'AdditionalDocumentReference',
    ])
  })

  it('her atıf listesini birden çok kez yazabilir', () => {
    const xml = buildInvoiceXml(
      girdi({
        despatchDocumentReferences: [
          { id: 'IRS-1', issueDate: '2026-09-01' },
          { id: 'IRS-2', issueDate: '2026-09-02' },
        ],
      }),
    )
    expect(xml).toContain(
      '<cac:DespatchDocumentReference><cbc:ID>IRS-1</cbc:ID><cbc:IssueDate>2026-09-01</cbc:IssueDate></cac:DespatchDocumentReference>',
    )
    expect(xml).toContain(
      '<cac:DespatchDocumentReference><cbc:ID>IRS-2</cbc:ID><cbc:IssueDate>2026-09-02</cbc:IssueDate></cac:DespatchDocumentReference>',
    )
  })

  it('atıf verilmediğinde hiçbir öğe yazmaz', () => {
    const xml = buildInvoiceXml(girdi())
    expect(xml).not.toContain('DespatchDocumentReference')
    expect(xml).not.toContain('ReceiptDocumentReference')
    expect(xml).not.toContain('OriginatorDocumentReference')
  })
})

describe('ek dosya', () => {
  it('gömülü ikili dosyayı MIME türü ve dosya adıyla yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        additionalDocuments: [
          {
            id: 'EK-1',
            attachment: {
              embeddedBinary: {
                content: 'JVBERi0=',
                mimeCode: 'application/pdf',
                fileName: 'f.pdf',
              },
            },
          },
        ],
      }),
    )
    expect(xml).toContain(
      '<cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf" filename="f.pdf">JVBERi0=</cbc:EmbeddedDocumentBinaryObject></cac:Attachment>',
    )
  })

  it('dosya adı verilmediğinde filename özniteliğini atlar', () => {
    const xml = buildInvoiceXml(
      girdi({
        additionalDocuments: [
          {
            id: 'EK-1',
            attachment: { embeddedBinary: { content: 'AAA=', mimeCode: 'image/png' } },
          },
        ],
      }),
    )
    expect(xml).toContain('<cbc:EmbeddedDocumentBinaryObject mimeCode="image/png">AAA=</cbc:')
    expect(xml).not.toContain('filename=')
  })

  it('dış adresi yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        additionalDocuments: [
          {
            id: 'EK-1',
            attachment: {
              externalReference: {
                uri: 'https://ornek.test/f.pdf',
                mimeCode: 'application/pdf',
                fileName: 'f.pdf',
                description: 'Sözleşme',
              },
            },
          },
        ],
      }),
    )
    expect(xml).toContain(
      '<cac:ExternalReference><cbc:URI>https://ornek.test/f.pdf</cbc:URI><cbc:MimeCode>application/pdf</cbc:MimeCode><cbc:FileName>f.pdf</cbc:FileName><cbc:Description>Sözleşme</cbc:Description></cac:ExternalReference>',
    )
  })

  it('iki yolu birlikte de yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        additionalDocuments: [
          {
            id: 'EK-1',
            attachment: {
              embeddedBinary: { content: 'AAA=', mimeCode: 'image/png' },
              externalReference: { uri: 'https://ornek.test/f.png' },
            },
          },
        ],
      }),
    )
    // UBL sırası: gömülü dosya ÖNCE, dış adres SONRA.
    expect(xml).toContain('<cbc:EmbeddedDocumentBinaryObject')
    expect(xml.indexOf('EmbeddedDocumentBinaryObject')).toBeLessThan(
      xml.indexOf('ExternalReference'),
    )
  })

  it('boş dosya nesnesi için Attachment öğesi yazmaz', () => {
    // İkisi de yoksa boş bir `cac:Attachment` yazmak belgeyi geçersiz
    // kılar: UBL en az bir çocuk bekler.
    const xml = buildInvoiceXml(girdi({ additionalDocuments: [{ id: 'EK-1', attachment: {} }] }))
    expect(xml).not.toContain('Attachment')
  })
})

describe('ödeme koşulları', () => {
  it('not, gecikme faizi, tutar ve vadeyi UBL sırasında yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        paymentTerms: {
          note: '30 gün vadeli',
          penaltySurchargePercent: 2,
          amount: 1200,
          dueDate: '2026-10-06',
        },
      }),
    )
    expect(xml).toContain(
      '<cac:PaymentTerms><cbc:Note>30 gün vadeli</cbc:Note><cbc:PenaltySurchargePercent>2.00</cbc:PenaltySurchargePercent><cbc:Amount currencyID="TRY">1200.00</cbc:Amount><cbc:PaymentDueDate>2026-10-06</cbc:PaymentDueDate></cac:PaymentTerms>',
    )
  })

  it('gecikme faizini kesre ÇEVİRMEZ', () => {
    // İskonto oranı `MultiplierFactorNumeric` olarak kesre çevrilir
    // (10 → 0,1); gecikme faizi ise yüzde tipindedir ve olduğu gibi
    // yazılır. İkisini karıştırmak faizi yüz kat küçültür.
    const xml = buildInvoiceXml(girdi({ paymentTerms: { penaltySurchargePercent: 10 } }))
    expect(xml).toContain('<cbc:PenaltySurchargePercent>10.00</cbc:PenaltySurchargePercent>')
  })

  it('tutarı belgenin para biriminde yazar', () => {
    const xml = buildInvoiceXml(
      girdi({ currencyCode: 'USD', exchangeRate: { rate: 34.25 }, paymentTerms: { amount: 50 } }),
    )
    expect(xml).toContain('<cbc:Amount currencyID="USD">50.00</cbc:Amount>')
  })

  it('ödeme koşulunu PaymentMeans ile PricingExchangeRate arasına yazar', () => {
    const sira = kokSirasi(
      buildInvoiceXml(
        girdi({
          currencyCode: 'USD',
          exchangeRate: { rate: 34.25 },
          paymentMeans: { meansCode: '42' },
          paymentTerms: { note: 'peşin' },
        }),
      ),
    )
    expect(sira.indexOf('PaymentMeans')).toBeLessThan(sira.indexOf('PaymentTerms'))
    expect(sira.indexOf('PaymentTerms')).toBeLessThan(sira.indexOf('PricingExchangeRate'))
  })
})

describe('iskonto ve ek yük öğeleri', () => {
  it('belge düzeyindeki yükü gerekçesiyle yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        allowanceCharges: [
          { isCharge: true, amount: 75, reasonCode: 'NAKLIYE', reason: 'Kargo bedeli' },
        ],
      }),
    )
    expect(xml).toContain(
      '<cac:AllowanceCharge><cbc:ChargeIndicator>true</cbc:ChargeIndicator><cbc:AllowanceChargeReasonCode>NAKLIYE</cbc:AllowanceChargeReasonCode><cbc:AllowanceChargeReason>Kargo bedeli</cbc:AllowanceChargeReason><cbc:Amount currencyID="TRY">75.00</cbc:Amount></cac:AllowanceCharge>',
    )
  })

  it('çarpanı kesre çevirir ve baz tutarı yazar', () => {
    // Satır iskontosuyla aynı sözleşme: yüzde 10 belgeye 0,1 olarak girer.
    const xml = buildInvoiceXml(
      girdi({
        allowanceCharges: [
          { isCharge: false, amount: 100, multiplierFactor: 10, baseAmount: 1000 },
        ],
      }),
    )
    expect(xml).toContain('<cbc:MultiplierFactorNumeric>0.1</cbc:MultiplierFactorNumeric>')
    expect(xml).toContain('<cbc:BaseAmount currencyID="TRY">1000.00</cbc:BaseAmount>')
  })

  it('ek yük varken ChargeTotalAmount yazar', () => {
    const xml = buildInvoiceXml(girdi({ allowanceCharges: [{ isCharge: true, amount: 75 }] }))
    expect(xml).toContain(
      '<cbc:AllowanceTotalAmount currencyID="TRY">0.00</cbc:AllowanceTotalAmount><cbc:ChargeTotalAmount currencyID="TRY">75.00</cbc:ChargeTotalAmount>',
    )
    expect(xml).toContain('<cbc:PayableAmount currencyID="TRY">1275.00</cbc:PayableAmount>')
  })

  it('ek yük yokken ChargeTotalAmount YAZMAZ', () => {
    // Sıfır değerli bir öğe yazmak, yükü olmayan her belgenin çıktısını
    // gereksiz yere değiştirir.
    expect(buildInvoiceXml(girdi())).not.toContain('ChargeTotalAmount')
  })

  it('satır düzeyindeki yükü satır iskontosundan SONRA yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        lines: [
          {
            name: 'Ürün',
            quantity: 10,
            unitPrice: 100,
            vatRate: 20,
            discountRate: 10,
            allowanceCharges: [{ isCharge: true, amount: 30, reason: 'Montaj' }],
          },
        ],
      }),
    )
    const iskonto = xml.indexOf('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>')
    const yuk = xml.indexOf('<cbc:ChargeIndicator>true</cbc:ChargeIndicator>')
    expect(iskonto).toBeGreaterThan(-1)
    expect(yuk).toBeGreaterThan(iskonto)
    // Satır tutarı: 1000 − 100 iskonto + 30 yük
    expect(xml).toContain(
      '<cbc:LineExtensionAmount currencyID="TRY">930.00</cbc:LineExtensionAmount>',
    )
  })

  it('belge iskontosunu PaymentTerms ile PricingExchangeRate arasına yazar', () => {
    const sira = kokSirasi(
      buildInvoiceXml(
        girdi({
          currencyCode: 'USD',
          exchangeRate: { rate: 34.25 },
          paymentTerms: { note: 'peşin' },
          allowanceCharges: [{ isCharge: false, amount: 10 }],
        }),
      ),
    )
    expect(sira.indexOf('PaymentTerms')).toBeLessThan(sira.indexOf('AllowanceCharge'))
    expect(sira.indexOf('AllowanceCharge')).toBeLessThan(sira.indexOf('PricingExchangeRate'))
  })
})

describe('çoklu para birimi', () => {
  it('vergi, fiyatlandırma ve ödeme para birimi kodlarını sırayla yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        currencyCode: 'USD',
        exchangeRate: { rate: 34.25 },
        taxCurrencyCode: 'TRY',
        pricingCurrencyCode: 'EUR',
        paymentCurrencyCode: 'USD',
      }),
    )
    expect(xml).toContain(
      '<cbc:DocumentCurrencyCode>USD</cbc:DocumentCurrencyCode><cbc:TaxCurrencyCode>TRY</cbc:TaxCurrencyCode><cbc:PricingCurrencyCode>EUR</cbc:PricingCurrencyCode><cbc:PaymentCurrencyCode>USD</cbc:PaymentCurrencyCode>',
    )
  })

  it('vergi ve ödeme kurunu belge kurundan ayrı yazar', () => {
    // GİB vergiyi belgenin düzenlendiği günün kuruyla ister; bu kur
    // fiyatlandırma kurundan farklı olabilir.
    const xml = buildInvoiceXml(
      girdi({
        currencyCode: 'USD',
        exchangeRate: { rate: 34.25 },
        taxExchangeRate: { rate: 34.1 },
        paymentExchangeRate: { rate: 34.5 },
      }),
    )
    expect(xml).toContain(
      '<cac:TaxExchangeRate><cbc:SourceCurrencyCode>USD</cbc:SourceCurrencyCode><cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode><cbc:CalculationRate>34.100000</cbc:CalculationRate></cac:TaxExchangeRate>',
    )
    expect(xml).toContain('<cbc:CalculationRate>34.500000</cbc:CalculationRate>')
  })

  it('kurları UBL sırasında yazar', () => {
    const sira = kokSirasi(
      buildInvoiceXml(
        girdi({
          currencyCode: 'USD',
          exchangeRate: { rate: 34.25 },
          taxExchangeRate: { rate: 34.1 },
          paymentExchangeRate: { rate: 34.5 },
        }),
      ),
    )
    expect(sira.filter((a) => a.endsWith('ExchangeRate'))).toEqual([
      'TaxExchangeRate',
      'PricingExchangeRate',
      'PaymentExchangeRate',
    ])
  })
})

describe('imza bilgisi', () => {
  it('bilgi verilmediğinde satıcıdan doldurur', () => {
    expect(buildInvoiceXml(girdi())).toContain(
      '<cac:Signature><cbc:ID schemeID="VKN_TCKN">1234567890</cbc:ID><cac:SignatoryParty><cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification></cac:SignatoryParty></cac:Signature>',
    )
  })

  it('imzalayan taraf verildiğinde tam taraf bloğu yazar', () => {
    // Entegratör mührüyle imzalanan belgelerde imzalayan satıcıdan
    // farklıdır ve adıyla birlikte bildirilir.
    const xml = buildInvoiceXml(
      girdi({
        signature: {
          id: '5555555555',
          signatoryParty: {
            taxNumber: '5555555555',
            name: 'Özel Entegratör A.Ş.',
            address: { district: 'Çankaya', city: 'Ankara' },
          },
        },
      }),
    )
    expect(xml).toContain('<cbc:ID schemeID="VKN_TCKN">5555555555</cbc:ID>')
    expect(xml).toContain('<cac:SignatoryParty><cac:PartyIdentification>')
    expect(xml).toContain('<cbc:Name>Özel Entegratör A.Ş.</cbc:Name>')
  })

  it('imza dosyasının adresini yazar', () => {
    const xml = buildInvoiceXml(
      girdi({ signature: { digitalSignatureUri: 'https://ornek.test/imza.xml' } }),
    )
    expect(xml).toContain(
      '<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>https://ornek.test/imza.xml</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>',
    )
  })

  it('şema kimliği değiştirilebilir', () => {
    const xml = buildInvoiceXml(girdi({ signature: { schemeId: 'VKN' } }))
    expect(xml).toContain('<cbc:ID schemeID="VKN">1234567890</cbc:ID>')
  })
})

describe('çoğul iade atfı', () => {
  it('birden çok asıl faturaya atıf yazar', () => {
    // Bir iade faturası birden çok asıl faturayı kapsayabilir; UBL öğeyi
    // tekrarlı tanımlar.
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.IADE,
        billingReference: { id: 'ABC2025000000001', issueDate: '2025-12-01' },
        billingReferences: [
          { id: 'ABC2025000000002', issueDate: '2025-12-02' },
          { id: 'ABC2025000000003', issueDate: '2025-12-03', uuid: 'u-3' },
        ],
      }),
    )
    const adet = xml.split('<cac:BillingReference>').length - 1
    expect(adet).toBe(3)
    // Tekil alan önce yazılır.
    expect(xml.indexOf('ABC2025000000001')).toBeLessThan(xml.indexOf('ABC2025000000002'))
    expect(xml).toContain('<cbc:UUID>u-3</cbc:UUID>')
  })

  it('iade tipinde belge tipi kodunu her atıfa yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.IADE,
        billingReferences: [
          { id: 'ABC2025000000002', issueDate: '2025-12-02' },
          { id: 'ABC2025000000003', issueDate: '2025-12-03' },
        ],
      }),
    )
    expect(xml.split('<cbc:DocumentTypeCode>IADE</cbc:DocumentTypeCode>').length - 1).toBe(2)
  })

  it('yalnızca çoğul alan verildiğinde zorunluluk karşılanır', () => {
    // Kullanıcı atfı çoğul alanda vermişse atıf VARDIR; yalnızca tekil
    // alana bakan bir denetim doğru belgeyi reddederdi.
    expect(() =>
      buildInvoiceXml(
        girdi({
          type: InvoiceType.IADE,
          billingReferences: [{ id: 'ABC2025000000002', issueDate: '2025-12-02' }],
        }),
      ),
    ).not.toThrow()
  })

  it('hiçbir atıf yokken iade faturasını reddeder', () => {
    expect(() => buildInvoiceXml(girdi({ type: InvoiceType.IADE }))).toThrow(/billingReference/)
  })
})

describe('özel matrah belgesi', () => {
  it('matrahı hem satır hem belge alt toplamına yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        type: InvoiceType.OZEL_MATRAH,
        lines: [{ name: 'Kontör', quantity: 1, unitPrice: 100, vatRate: 20, vatBaseAmount: 20 }],
      }),
    )
    // İki TaxSubtotal (satır ve belge) da 20 matrahı taşır.
    expect(
      xml.split('<cbc:TaxableAmount currencyID="TRY">20.00</cbc:TaxableAmount>').length - 1,
    ).toBe(2)
    expect(xml).toContain(
      '<cbc:LineExtensionAmount currencyID="TRY">100.00</cbc:LineExtensionAmount>',
    )
  })
})

describe('e-Arşiv bilgileri', () => {
  const earsiv = { profile: InvoiceProfile.EARSIV, type: InvoiceType.SATIS } as const

  it('gönderim şeklini ek belgeye çevirir', () => {
    const xml = buildInvoiceXml(girdi({ ...earsiv, eArchive: { sendType: 'ELEKTRONIK' } }))
    expect(xml).toContain(
      '<cac:AdditionalDocumentReference><cbc:ID>ELEKTRONIK</cbc:ID><cbc:IssueDate>2026-09-06</cbc:IssueDate><cbc:DocumentTypeCode>EXT_SEND_METHOD</cbc:DocumentTypeCode></cac:AdditionalDocumentReference>',
    )
  })

  it('kâğıt gönderimde ek belge YAZMAZ', () => {
    // GİB kâğıt gönderimi varsayılan sayar; alanı yalnızca elektronik
    // gönderimde bekler.
    const xml = buildInvoiceXml(girdi({ ...earsiv, eArchive: { sendType: 'KAGIT' } }))
    expect(xml).not.toContain('EXT_SEND_METHOD')
  })

  it('internet satışının dört ek belgesini yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        ...earsiv,
        eArchive: {
          onlineSale: {
            storeUrl: 'https://magaza.test',
            paymentMethod: 'KREDIKARTI/BANKAKARTI',
            paymentDate: '2026-09-05',
          },
        },
      }),
    )
    expect(xml).toContain('<cbc:DocumentTypeCode>EXT_IS_ONLINE_SALE</cbc:DocumentTypeCode>')
    expect(xml).toContain('<cbc:ID>https://magaza.test</cbc:ID>')
    expect(xml).toContain('<cbc:DocumentTypeCode>EXT_ONLINE_STORE_URL</cbc:DocumentTypeCode>')
    expect(xml).toContain('<cbc:DocumentTypeCode>EXT_PAYMENT_METHOD</cbc:DocumentTypeCode>')
    expect(xml).toContain('<cbc:DocumentTypeCode>EXT_PAYMENT_DATE</cbc:DocumentTypeCode>')
  })

  it('internet satışının teslim bilgisini Delivery bloğuna yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        ...earsiv,
        eArchive: {
          onlineSale: {
            storeUrl: 'https://magaza.test',
            paymentMethod: 'HAVALE',
            paymentDate: '2026-09-05',
            deliveryDate: '2026-09-07',
            carrier: {
              taxNumber: '5555555555',
              name: 'Kargo A.Ş.',
              address: { district: 'Çankaya', city: 'Ankara' },
            },
          },
        },
      }),
    )
    expect(xml).toContain('<cbc:ActualDeliveryDate>2026-09-07</cbc:ActualDeliveryDate>')
    expect(xml).toContain('<cac:CarrierParty>')
    expect(xml).toContain('<cbc:Name>Kargo A.Ş.</cbc:Name>')
  })

  it('açıkça verilen teslim bilgisi satıştan gelene üstün gelir', () => {
    const xml = buildInvoiceXml(
      girdi({
        ...earsiv,
        delivery: { actualDeliveryDate: '2026-09-10' },
        eArchive: {
          onlineSale: {
            storeUrl: 'x',
            paymentMethod: 'y',
            paymentDate: '2026-09-05',
            deliveryDate: '2026-09-07',
          },
        },
      }),
    )
    expect(xml).toContain('<cbc:ActualDeliveryDate>2026-09-10</cbc:ActualDeliveryDate>')
    expect(xml).not.toContain('2026-09-07')
  })

  it('SGK bilgisini üç ek belgeye çevirir ve türün adını kullanır', () => {
    const xml = buildInvoiceXml(
      girdi({
        ...earsiv,
        type: InvoiceType.SGK,
        accountingCost: 'SAGLIK_ECZ',
        eArchive: {
          sgk: {
            type: 'SAGLIK_ECZ',
            documentNo: 'D-1',
            companyName: 'Örnek Eczanesi',
            companyCode: 'S-9',
          },
        },
      }),
    )
    expect(xml).toContain(
      '<cbc:DocumentTypeCode>DOSYA_NO</cbc:DocumentTypeCode><cbc:DocumentType>D-1</cbc:DocumentType><cbc:DocumentDescription>Döküm No</cbc:DocumentDescription>',
    )
    expect(xml).toContain('<cbc:DocumentDescription>Eczane Adı</cbc:DocumentDescription>')
    expect(xml).toContain(
      '<cbc:DocumentDescription>Eczane Sicil Numarası</cbc:DocumentDescription>',
    )
  })

  it('bilinmeyen SGK türünde kodun kendisini kullanır', () => {
    const xml = buildInvoiceXml(
      girdi({
        ...earsiv,
        eArchive: { sgk: { type: 'YENITUR', documentNo: 'D', companyName: 'A', companyCode: 'K' } },
      }),
    )
    expect(xml).toContain('<cbc:DocumentDescription>YENITUR Adı</cbc:DocumentDescription>')
  })

  it('görüntüleme şablonunu gömülü dosya olarak iliştirir', () => {
    const xml = buildInvoiceXml(girdi({ ...earsiv, eArchive: { xsltTemplate: 'PHhzbDo=' } }))
    expect(xml).toContain(
      '<cbc:EmbeddedDocumentBinaryObject mimeCode="application/xslt+xml" filename="1a2b3c4d-0001-4000-8001-000000000001.xslt">PHhzbDo=</cbc:EmbeddedDocumentBinaryObject>',
    )
  })

  it('e-Arşiv belgelerini kullanıcının ek belgelerinden ÖNCE yazar', () => {
    const xml = buildInvoiceXml(
      girdi({
        ...earsiv,
        eArchive: { sendType: 'ELEKTRONIK' },
        additionalDocuments: [{ id: 'KULLANICI-1' }],
      }),
    )
    expect(xml.indexOf('EXT_SEND_METHOD')).toBeLessThan(xml.indexOf('KULLANICI-1'))
  })
})
