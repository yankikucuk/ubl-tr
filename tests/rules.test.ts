/**
 * İş kuralı doğrulayıcısının katmanlar arası testleri.
 *
 * `builders` ile `validators` kardeş katmanlardır ve birbirini import
 * edemez; ikisini birlikte kullanan testler bu yüzden burada durur.
 */
import { describe, expect, it } from 'vitest'

import { buildInvoiceXml, type InvoiceInput } from '../src/builders/invoice.js'
import type { PartyInput } from '../src/builders/party.js'
import { InvoiceProfile, InvoiceType, Namespace } from '../src/constants/index.js'
import { container, leaf, parseDocument, type XmlElement } from '../src/core/index.js'
import { validateInvoiceRules } from '../src/validators/rules.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE
const INVOICE_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'

/** Kontrol basamağı tutan, uydurulmuş numaralar. */
const SATICI_VKN = '7857313547'
const ALICI_VKN = '0149537825'

const satici: PartyInput = {
  taxNumber: SATICI_VKN,
  name: 'Satıcı A.Ş.',
  taxOffice: 'Üsküdar',
  address: { district: 'Üsküdar', city: 'İstanbul' },
}
const alici: PartyInput = {
  taxNumber: ALICI_VKN,
  name: 'Alıcı Ltd.',
  address: { district: 'Kadıköy', city: 'İstanbul' },
}

const girdi = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.SATIS,
  supplier: satici,
  customer: alici,
  lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
  ...over,
})

const kurallar = (input: InvoiceInput): ReturnType<typeof validateInvoiceRules> =>
  validateInvoiceRules(parseDocument(buildInvoiceXml(input)).root)

const kodlar = (input: InvoiceInput): string[] => kurallar(input).issues.map((i) => i.code)

describe('kendi ürettiğimiz belgeler', () => {
  it('temiz geçer', () => {
    expect(kurallar(girdi())).toEqual({ valid: true, issues: [] })
  })

  it('tevkifatlı fatura temiz geçer', () => {
    expect(
      kodlar(
        girdi({
          type: InvoiceType.TEVKIFAT,
          lines: [
            { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
          ],
        }),
      ),
    ).toEqual([])
  })

  it('istisna faturası temiz geçer', () => {
    expect(
      kodlar(
        girdi({
          type: InvoiceType.ISTISNA,
          lines: [
            { name: 'İhracat', quantity: 1, unitPrice: 1000, vatRate: 0, exemptionCode: '301' },
          ],
        }),
      ),
    ).toEqual([])
  })

  it('yabancı para faturası temiz geçer', () => {
    expect(kodlar(girdi({ currencyCode: 'EUR', exchangeRate: { rate: 36.75 } }))).toEqual([])
  })
})

describe('belge numarası kuralları', () => {
  it('16 hane olmayan numarayı yakalar', () => {
    // odoo/odoo#270638 — kök `cbc:ID` alanına 16 haneli numara yerine kısa
    // bir sıra kodu yazılıyordu. Belge XSD'den geçiyor, GİB reddediyordu.
    expect(kodlar(girdi({ id: 'OUT' }))).toContain('INVALID_DOCUMENT_NUMBER')
  })

  it('numaradaki yıl ile düzenleme tarihini karşılaştırır', () => {
    expect(kodlar(girdi({ id: 'ABC2025000000001' }))).toContain('DOCUMENT_NUMBER_YEAR_MISMATCH')
  })
})

describe('profil, tip ve zorunlu bloklar', () => {
  it('profil-tip uyumsuzluğunu yakalar', () => {
    // Üretici bunu zaten reddediyor; denetim kapatılınca kural yakalamalı.
    const xml = buildInvoiceXml(
      girdi({
        profile: InvoiceProfile.TICARI,
        type: InvoiceType.IADE,
        billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
      }),
      { validateProfileType: false },
    )
    expect(validateInvoiceRules(parseDocument(xml).root).issues.map((i) => i.code)).toContain(
      'PROFILE_TYPE_MISMATCH',
    )
  })

  it('iade faturasında eksik atfı yakalar', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'ProfileID', 'TEMELFATURA'),
      leaf(CBC, 'ID', 'ABC2026000000001'),
      leaf(CBC, 'IssueDate', '2026-09-06'),
      leaf(CBC, 'InvoiceTypeCode', 'IADE'),
      leaf(CBC, 'DocumentCurrencyCode', 'TRY'),
    ])
    expect(validateInvoiceRules(bozuk).issues.map((i) => i.code)).toContain(
      'MISSING_BILLING_REFERENCE',
    )
  })

  it('istisna faturasında eksik muafiyet kodunu yakalar', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'ProfileID', 'TEMELFATURA'),
      leaf(CBC, 'ID', 'ABC2026000000001'),
      leaf(CBC, 'IssueDate', '2026-09-06'),
      leaf(CBC, 'InvoiceTypeCode', 'ISTISNA'),
      leaf(CBC, 'DocumentCurrencyCode', 'TRY'),
      container(CAC, 'TaxTotal', [
        leaf(CBC, 'TaxAmount', '0.00'),
        container(CAC, 'TaxSubtotal', [
          leaf(CBC, 'TaxableAmount', '100.00'),
          leaf(CBC, 'TaxAmount', '0.00'),
          container(CAC, 'TaxCategory', [
            container(CAC, 'TaxScheme', [leaf(CBC, 'TaxTypeCode', '0015')]),
          ]),
        ]),
      ]),
    ])
    expect(validateInvoiceRules(bozuk).issues.map((i) => i.code)).toContain(
      'MISSING_EXEMPTION_CODE',
    )
  })
})

describe('kod listeleri', () => {
  const ileKod = (kod: string, deger: string): XmlElement =>
    container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'InvoiceTypeCode', 'SATIS'),
      container(CAC, 'InvoiceLine', [
        leaf(CBC, 'ID', '1'),
        leaf(CBC, 'InvoicedQuantity', '1.00', [
          { name: 'unitCode', value: kod === 'unit' ? deger : 'C62' },
        ]),
        container(CAC, 'TaxTotal', [
          container(CAC, 'TaxSubtotal', [
            container(CAC, 'TaxCategory', [
              kod === 'exemption'
                ? leaf(CBC, 'TaxExemptionReasonCode', deger)
                : leaf(CBC, 'TaxExemptionReasonCode', '301'),
              container(CAC, 'TaxScheme', [
                leaf(CBC, 'TaxTypeCode', kod === 'tax' ? deger : '0015'),
              ]),
            ]),
          ]),
        ]),
      ]),
    ])

  it('birim kodunu kod listesine karşı denetler', () => {
    // En sık hata, insan tarafından okunabilir adı kod alanına yazmaktır.
    expect(validateInvoiceRules(ileKod('unit', 'Adet')).issues.map((i) => i.code)).toContain(
      'UNKNOWN_UNIT_CODE',
    )
    expect(validateInvoiceRules(ileKod('unit', 'C62')).issues.map((i) => i.code)).not.toContain(
      'UNKNOWN_UNIT_CODE',
    )
  })

  it('vergi türü kodunu denetler', () => {
    expect(validateInvoiceRules(ileKod('tax', '9999')).issues.map((i) => i.code)).toContain(
      'UNKNOWN_TAX_TYPE_CODE',
    )
  })

  it('muafiyet kodunu denetler', () => {
    expect(validateInvoiceRules(ileKod('exemption', '999')).issues.map((i) => i.code)).toContain(
      'UNKNOWN_EXEMPTION_CODE',
    )
  })
})

describe('tutar tutarlılığı', () => {
  it('satır sayısı uyumsuzluğunu yakalar', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'LineCountNumeric', '5'),
      container(CAC, 'InvoiceLine', [leaf(CBC, 'ID', '1')]),
    ])
    expect(validateInvoiceRules(bozuk).issues.map((i) => i.code)).toContain('LINE_COUNT_MISMATCH')
  })

  it('satır toplamı ile bildirilen toplamın uyuşmamasını yakalar', () => {
    // GİB bu çapraz denetimi yapar; kayan nokta tabanlı bir motorda
    // toplamlar bir kuruş kayabilir ve belge reddedilir.
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'LegalMonetaryTotal', [leaf(CBC, 'LineExtensionAmount', '999.00')]),
      container(CAC, 'InvoiceLine', [
        leaf(CBC, 'ID', '1'),
        leaf(CBC, 'LineExtensionAmount', '100.00'),
      ]),
    ])
    expect(validateInvoiceRules(bozuk).issues.map((i) => i.code)).toContain(
      'MONETARY_TOTAL_MISMATCH',
    )
  })

  it('parasal alanda ikiden fazla ondalık basamağı yakalar', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'LegalMonetaryTotal', [leaf(CBC, 'PayableAmount', '100.12345')]),
    ])
    expect(validateInvoiceRules(bozuk).issues.map((i) => i.code)).toContain('DECIMAL_PRECISION')
  })
})

describe('tevkifat kodu ve oranı', () => {
  const tevkifatli = (kod: string, oran: string): XmlElement =>
    container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'WithholdingTaxTotal', [
        leaf(CBC, 'TaxAmount', '140.00'),
        container(CAC, 'TaxSubtotal', [
          leaf(CBC, 'TaxAmount', '140.00'),
          leaf(CBC, 'Percent', oran),
          container(CAC, 'TaxCategory', [
            container(CAC, 'TaxScheme', [leaf(CBC, 'TaxTypeCode', kod)]),
          ]),
        ]),
      ]),
    ])

  it('kod ile oranın uyuşmamasını yakalar', () => {
    // GİB'in kuralı kodu ve yüzdeyi TEK bir dize olarak sabit listede arar;
    // kod doğru ama oran farklıysa belge reddedilir.
    expect(validateInvoiceRules(tevkifatli('603', '50.00')).issues.map((i) => i.code)).toContain(
      'WITHHOLDING_RATE_MISMATCH',
    )
    expect(
      validateInvoiceRules(tevkifatli('603', '70.00')).issues.map((i) => i.code),
    ).not.toContain('WITHHOLDING_RATE_MISMATCH')
  })

  it('bilinmeyen tevkifat kodunu yakalar', () => {
    expect(validateInvoiceRules(tevkifatli('999', '70')).issues.map((i) => i.code)).toContain(
      'UNKNOWN_WITHHOLDING_CODE',
    )
  })
})

describe('vergi numarası kontrol basamağı', () => {
  it('yurt içi tarafta uyarır, reddetmez', () => {
    // GİB kontrol basamağını denetlemez; belge reddedilmez. Ama tutmayan
    // bir numara neredeyse her zaman yazım hatasıdır.
    const sonuc = kurallar(girdi({ customer: { ...alici, taxNumber: '1234567891' } }))
    expect(sonuc.valid).toBe(true)
    const bulgu = sonuc.issues.find((i) => i.code === 'INVALID_TAX_IDENTIFIER')
    expect(bulgu?.severity).toBe('warning')
  })

  it('yabancı tarafta hiç uyarmaz', () => {
    // REGRESYON — ihracat faturalarında alıcı yurt dışındadır ve numarası
    // Türk VKN algoritmasına uymaz. Ülke ayrımı yapılmazsa her ihracat
    // faturası yanlış uyarı üretir; referans belgelerinde canlı görüldü.
    const sonuc = kurallar(
      girdi({
        type: InvoiceType.ISTISNA,
        profile: InvoiceProfile.IHRACAT,
        lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0, exemptionCode: '301' }],
        customer: {
          taxNumber: '2222222222',
          name: 'Global Trade GmbH',
          address: { district: 'Munich', city: 'Bayern', country: 'Almanya' },
        },
      }),
    )
    expect(sonuc.issues.map((i) => i.code)).not.toContain('INVALID_TAX_IDENTIFIER')
  })
})

describe('HKS künye numarası', () => {
  it('eksik künye numarasını yakalar', () => {
    expect(
      kodlar(
        girdi({
          profile: InvoiceProfile.HKS,
          type: InvoiceType.HKS_SATIS,
          lines: [{ name: 'Domates', quantity: 500, unitPrice: 20, vatRate: 10, unitCode: 'KGM' }],
        }),
      ),
    ).toContain('HKS_MISSING_KUNYENO')
  })

  it('künye numarası varsa geçer', () => {
    expect(
      kodlar(
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
      ),
    ).not.toContain('HKS_MISSING_KUNYENO')
  })
})

describe('profil bazlı zorunluluklar', () => {
  it('gerçek kişide vergi dairesi bloğunu reddeder', () => {
    // gorkem-bwl/atlas#39 — GİB paketine karşı XSD doğrulaması yapan bir
    // ekip, gerçek kişide `cac:PartyTaxScheme` bulunmaması gerektiğini
    // bildirdi. Üretici artık yazmıyor; kural elle kurulmuş belgeyi yakalar.
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'AccountingCustomerParty', [
        container(CAC, 'Party', [
          container(CAC, 'PostalAddress', [
            leaf(CBC, 'CitySubdivisionName', 'Kadıköy'),
            leaf(CBC, 'CityName', 'İstanbul'),
            container(CAC, 'Country', [leaf(CBC, 'Name', 'Türkiye')]),
          ]),
          container(CAC, 'PartyTaxScheme', [
            container(CAC, 'TaxScheme', [leaf(CBC, 'Name', 'Kadıköy')]),
          ]),
          container(CAC, 'Person', [leaf(CBC, 'FirstName', 'Ayşe')]),
        ]),
      ]),
    ])
    expect(validateInvoiceRules(bozuk).issues.map((i) => i.code)).toContain(
      'NATURAL_PERSON_TAX_SCHEME',
    )
  })

  it('üretici gerçek kişide vergi dairesi bloğu yazmaz', () => {
    const xml = buildInvoiceXml(
      girdi({
        customer: {
          taxNumber: '52040077498',
          name: 'Ayşe Yılmaz',
          taxOffice: 'Kadıköy',
          address: { district: 'Kadıköy', city: 'İstanbul' },
        },
      }),
    )
    // Denetim ALICIYA kapsamlandırılır: satıcı tüzel kişidir ve onda
    // vergi dairesi bloğu doğru olarak bulunur.
    const alan = xml.slice(
      xml.indexOf('<cac:AccountingCustomerParty>'),
      xml.indexOf('</cac:AccountingCustomerParty>'),
    )
    expect(alan).toContain('<cac:Person>')
    expect(alan).not.toContain('<cac:PartyTaxScheme>')
    expect(xml).toContain('<cac:PartyTaxScheme>')
  })

  it('adresin zorunlu alanlarını denetler', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'AccountingSupplierParty', [
        container(CAC, 'Party', [
          container(CAC, 'PostalAddress', [leaf(CBC, 'StreetName', 'Cadde 1')]),
        ]),
      ]),
    ])
    const kod = validateInvoiceRules(bozuk).issues.map((i) => i.code)
    expect(kod.filter((c) => c === 'MISSING_MANDATORY_ADDRESS_FIELD')).toHaveLength(3)
  })

  it('kamu profilinde aracı alıcıyı zorunlu tutar', () => {
    expect(kodlar(girdi({ profile: InvoiceProfile.KAMU }))).toContain('KAMU_MISSING_BUYER_CUSTOMER')
    expect(
      kodlar(
        girdi({
          profile: InvoiceProfile.KAMU,
          buyerCustomer: {
            taxNumber: '0580438389',
            name: 'Kurum',
            address: { district: 'Çankaya', city: 'Ankara' },
          },
        }),
      ),
    ).not.toContain('KAMU_MISSING_BUYER_CUSTOMER')
  })
})

describe('ihraç kayıtlı 702', () => {
  const ihrac = (over: Partial<Parameters<typeof girdi>[0]> = {}): string[] =>
    kodlar(
      girdi({
        type: InvoiceType.IHRAC_KAYITLI,
        lines: [
          {
            name: 'x',
            quantity: 1,
            unitPrice: 100,
            vatRate: 0,
            exemptionCode: '702',
            ...(over.lines?.[0] ?? {}),
          },
        ],
        ...over,
      }),
    )

  it('GTİP ve alıcı satır kodu yoksa yakalar', () => {
    const kod = ihrac()
    expect(kod).toContain('IHRACKAYITLI_MISSING_CUSTOMS_ID')
    expect(kod).toContain('IHRACKAYITLI_MISSING_BUYER_LINE_CODE')
  })

  it('ikisi de varsa geçer', () => {
    const kod = kodlar(
      girdi({
        type: InvoiceType.IHRAC_KAYITLI,
        lines: [
          {
            name: 'x',
            quantity: 1,
            unitPrice: 100,
            vatRate: 0,
            exemptionCode: '702',
            delivery: {
              customsTariffNumber: '620342000010',
              customsDeclaration: {
                issuerParty: {
                  taxNumber: '12345678901',
                  identificationSchemeId: 'ALICIDIBSATIRKOD',
                  name: 'Aracı',
                  address: { district: 'Kadıköy', city: 'İstanbul' },
                },
              },
            },
          },
        ],
      }),
    )
    expect(kod).not.toContain('IHRACKAYITLI_MISSING_CUSTOMS_ID')
    expect(kod).not.toContain('IHRACKAYITLI_MISSING_BUYER_LINE_CODE')
  })

  it('GTİP 12 hane değilse yakalar', () => {
    expect(
      kodlar(
        girdi({
          type: InvoiceType.IHRAC_KAYITLI,
          lines: [
            {
              name: 'x',
              quantity: 1,
              unitPrice: 100,
              vatRate: 0,
              exemptionCode: '702',
              delivery: { customsTariffNumber: '6203420000' },
            },
          ],
        }),
      ),
    ).toContain('IHRACKAYITLI_MISSING_CUSTOMS_ID')
  })
})

describe('şarj hizmeti', () => {
  const sarj = (over: Partial<Parameters<typeof girdi>[0]> = {}): string[] =>
    kodlar(
      girdi({
        profile: InvoiceProfile.ENERJI,
        type: InvoiceType.SARJ,
        lines: [{ name: 'Şarj', quantity: 1, unitPrice: 360, vatRate: 20 }],
        ...over,
      }),
    )

  it('dönem, plaka ve ESU raporunu zorunlu tutar', () => {
    const kod = sarj()
    expect(kod).toContain('ENERJI_MISSING_INVOICE_PERIOD')
    expect(kod).toContain('ENERJI_MISSING_PLATE')
    expect(kod).toContain('ENERJI_MISSING_ESU_REPORT')
  })

  it('hepsi varsa geçer', () => {
    const kod = sarj({
      invoicePeriod: {
        startDate: '2026-04-01',
        startTime: '00:00:00',
        endDate: '2026-04-23',
        endTime: '15:00:00',
      },
      additionalDocuments: [{ id: 'ESU-1', schemeId: 'ESURaporID' }],
      customer: { ...alici, identifications: [{ schemeId: 'PLAKA', value: '34ABC123' }] },
    })
    expect(kod).not.toContain('ENERJI_MISSING_INVOICE_PERIOD')
    expect(kod).not.toContain('ENERJI_MISSING_PLATE')
    expect(kod).not.toContain('ENERJI_MISSING_ESU_REPORT')
  })

  it('eksik dönem alanını yakalar', () => {
    expect(sarj({ invoicePeriod: { startDate: '2026-04-01' } })).toContain(
      'ENERJI_INCOMPLETE_INVOICE_PERIOD',
    )
  })

  it('SARJANLIK ESU raporu istemez', () => {
    // Kural yalnız SARJ'ı kapsar; SARJANLIK kapsam dışıdır.
    expect(sarj({ type: InvoiceType.SARJ_ANLIK })).not.toContain('ENERJI_MISSING_ESU_REPORT')
  })
})

describe('yatırım teşvik ve demirbaş KDV', () => {
  it('sıfır KDV oranını reddeder', () => {
    // Teşvik "vazgeçilen KDV" olarak gösterilir; hesap yine yapılır.
    expect(
      kodlar(
        girdi({
          profile: InvoiceProfile.YATIRIM_TESVIK,
          contractDocument: { id: '123456', schemeId: 'YTBNO' },
          lines: [{ name: 'x', quantity: 1, unitPrice: 600, vatRate: 0 }],
        }),
      ),
    ).toContain('YTB_ZERO_VAT')
  })

  it('harcama tipi 01 kaleminde marka ve model zorunludur', () => {
    const eksik = kodlar(
      girdi({
        profile: InvoiceProfile.YATIRIM_TESVIK,
        lines: [
          { name: 'Kompresör', quantity: 1, unitPrice: 600, vatRate: 12, classificationCode: '01' },
        ],
      }),
    )
    expect(eksik.filter((c) => c === 'YTB_MISSING_ITEM_DETAIL')).toHaveLength(2)

    expect(
      kodlar(
        girdi({
          profile: InvoiceProfile.YATIRIM_TESVIK,
          lines: [
            {
              name: 'Kompresör',
              quantity: 1,
              unitPrice: 600,
              vatRate: 12,
              classificationCode: '01',
              brandName: 'DemoMakine',
              modelName: 'DMK-2000',
            },
          ],
        }),
      ),
    ).not.toContain('YTB_MISSING_ITEM_DETAIL')
  })

  it('iade tiplerinde KDV kuralı uygulanmaz', () => {
    expect(
      kodlar(
        girdi({
          profile: InvoiceProfile.YATIRIM_TESVIK,
          type: InvoiceType.IADE,
          billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
          lines: [{ name: 'x', quantity: 1, unitPrice: 600, vatRate: 0 }],
        }),
      ),
    ).not.toContain('YTB_ZERO_VAT')
  })

  it('555 kodunu sıfır KDV ile reddeder', () => {
    expect(
      kodlar(
        girdi({
          lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0, exemptionCode: '555' }],
        }),
      ),
    ).toContain('DEMIRBAS_KDV_ZERO_RATE')
  })
})

describe('ödeme şekli ve plaka kod listeleri', () => {
  it('ödeme şekli kodunu kod listesine karşı denetler', () => {
    expect(kodlar(girdi({ paymentMeans: { meansCode: '42' } }))).not.toContain(
      'UNKNOWN_PAYMENT_MEANS_CODE',
    )
    // Adı yayımlanmamış ama GİB'in kabul ettiği kodlar geçerlidir.
    expect(kodlar(girdi({ paymentMeans: { meansCode: '97' } }))).not.toContain(
      'UNKNOWN_PAYMENT_MEANS_CODE',
    )
    expect(kodlar(girdi({ paymentMeans: { meansCode: 'HAVALE' } }))).toContain(
      'UNKNOWN_PAYMENT_MEANS_CODE',
    )
  })
})
