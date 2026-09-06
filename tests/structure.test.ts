/**
 * Katmanlar arası testler.
 *
 * Bu dosya hem `builders` hem `validators` katmanını kullanır. İkisi
 * kardeş katmandır ve birbirini import EDEMEZ; bu yüzden testleri de bir
 * katmanın içinde duramaz. Mimari sınır ESLint tarafından zorlanıyor ve
 * bu dosyanın buraya taşınmasının sebebi tam olarak o sınırdır.
 */
import { describe, expect, it } from 'vitest'

import { buildDespatchAdviceXml } from '../src/builders/despatch.js'
import { buildInvoiceXml } from '../src/builders/invoice.js'
import { InvoiceProfile, InvoiceType, Namespace } from '../src/constants/index.js'
import { container, leaf, parseDocument } from '../src/core/index.js'
import { validateStructure } from '../src/validators/structure.js'

const INVOICE_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

const fatura = buildInvoiceXml({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.SATIS,
  supplier: {
    taxNumber: '1234567890',
    name: 'Satıcı A.Ş.',
    taxOffice: 'Üsküdar',
    address: { district: 'Üsküdar', city: 'İstanbul' },
  },
  customer: {
    taxNumber: '9876543210',
    name: 'Alıcı Ltd.',
    address: { district: 'Kadıköy', city: 'İstanbul' },
  },
  lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
})

describe('kendi ürettiğimiz belgeler', () => {
  it('fatura modelden geçer', () => {
    expect(validateStructure(parseDocument(fatura).root)).toEqual({ valid: true, issues: [] })
  })

  it('tam donanımlı fatura modelden geçer', () => {
    const xml = buildInvoiceXml({
      id: 'ABC2026000000002',
      uuid: '1a2b3c4d-0002-4000-8002-000000000002',
      issueDate: '2026-09-06',
      issueTime: '10:00:00',
      profile: InvoiceProfile.KAMU,
      type: InvoiceType.TEVKIFAT,
      currencyCode: 'EUR',
      accountingCost: 'X',
      exchangeRate: { rate: 36.75 },
      orderReference: { id: 'PO-1', issueDate: '2026-08-01' },
      contractDocument: { id: '123', schemeId: 'YTBNO' },
      additionalDocuments: [{ id: '.', documentTypeCode: 'X', documentType: 'Y' }],
      invoicePeriod: { startDate: '2026-08-01', endDate: '2026-08-31' },
      taxRepresentative: { taxNumber: '1234567890', name: 'Aracı', label: 'L' },
      paymentMeans: { meansCode: '42', dueDate: '2026-10-01', accountNumber: 'TR33', note: 'n' },
      delivery: {
        actualDeliveryDate: '2026-09-07',
        carrierParty: { taxNumber: '5555555555', name: 'Kargo' },
      },
      supplier: {
        taxNumber: '1234567890',
        name: 'Satıcı A.Ş.',
        taxOffice: 'Üsküdar',
        website: 'https://x.example',
        phone: '+900000000000',
        email: 'a@b.example',
        legalRegistrationName: 'Satıcı Anonim Şirketi',
        identifications: [{ schemeId: 'MERSISNO', value: '1' }],
        address: { street: 'S', district: 'Üsküdar', city: 'İstanbul', postalCode: '34664' },
      },
      customer: {
        taxNumber: '52040077498',
        name: 'Ayşe Yılmaz',
        nationalityId: 'DE',
        identityDocumentId: 'N1',
        address: { district: 'Kadıköy', city: 'İstanbul', subDistrict: 'Fenerbahçe' },
      },
      buyerCustomer: {
        taxNumber: '3333333333',
        name: 'Aracı Kurum',
        address: { district: 'Çankaya', city: 'Ankara' },
      },
      lines: [
        {
          name: 'Bakım',
          quantity: 10,
          unitPrice: 100,
          vatRate: 20,
          discountRate: 5,
          withholdingCode: '603',
          exemptionCode: '351',
          taxes: [{ code: '0071', rate: 10 }],
          brandName: 'M',
          modelName: 'N',
          classificationCode: '01',
          productTraceId: 'P',
          serialId: 'S',
          additionalIdentifications: [{ schemeId: 'KUNYENO', value: 'K' }],
          delivery: {
            address: { district: 'Avcılar', city: 'İstanbul' },
            deliveryTermCode: 'FOB',
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
    })
    expect(validateStructure(parseDocument(xml).root).issues).toEqual([])
  })

  it('e-İrsaliye modelden geçer', () => {
    const xml = buildDespatchAdviceXml({
      id: 'IRS2026000000001',
      uuid: '1a2b3c4d-0001-4000-8001-000000000001',
      issueDate: '2026-09-06',
      supplier: {
        taxNumber: '1234567890',
        name: 'Gönderen',
        address: { district: 'Üsküdar', city: 'İstanbul' },
      },
      customer: {
        taxNumber: '9876543210',
        name: 'Alıcı',
        address: { district: 'Kadıköy', city: 'İstanbul' },
      },
      shipment: {
        actualDespatchDate: '2026-09-06',
        deliveryAddress: { district: 'Kadıköy', city: 'İstanbul' },
        carrierParty: { taxNumber: '5555555555', name: 'Kargo' },
        drivers: [{ firstName: 'M', familyName: 'S', nationalityId: '1' }],
        licensePlates: [{ plateNumber: '34ABC123' }],
        transportEquipment: [{ id: '34DEF456', schemeId: 'DORSEPLAKA' }],
      },
      additionalDocuments: [{ id: 'M-1', documentType: 'MATBU' }],
      lines: [
        {
          quantity: 10,
          itemName: 'Ürün',
          additionalIdentifications: [{ schemeId: 'ETIKETNO', value: 'E1' }],
        },
      ],
    })
    expect(validateStructure(parseDocument(xml).root).issues).toEqual([])
  })
})

describe('hata yakalama', () => {
  it('yanlış sıradaki öğeyi yakalar', () => {
    // `cbc:Note` UBL sırasında `cbc:InvoiceTypeCode`'dan SONRA gelir.
    // Doğru öğeleri yanlış sırada yazmak belgeyi geçersiz kılar ve elle
    // üretimde en sık yapılan hata budur.
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'ProfileID', 'TEMELFATURA'),
      leaf(CBC, 'ID', 'ABC2026000000001'),
      leaf(CBC, 'Note', 'erken not'),
      leaf(CBC, 'IssueDate', '2026-09-06'),
      leaf(CBC, 'InvoiceTypeCode', 'SATIS'),
      leaf(CBC, 'DocumentCurrencyCode', 'TRY'),
    ])
    const sonuc = validateStructure(bozuk)
    expect(sonuc.valid).toBe(false)
    expect(sonuc.issues.some((i) => i.code === 'ELEMENT_OUT_OF_ORDER')).toBe(true)
  })

  it('eksik zorunlu öğeyi yakalar', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'ProfileID', 'TEMELFATURA'),
      leaf(CBC, 'ID', 'ABC2026000000001'),
      leaf(CBC, 'IssueDate', '2026-09-06'),
      leaf(CBC, 'InvoiceTypeCode', 'SATIS'),
      leaf(CBC, 'DocumentCurrencyCode', 'TRY'),
    ])
    const eksikler = validateStructure(bozuk).issues.filter(
      (i) => i.code === 'MISSING_REQUIRED_ELEMENT',
    )
    // Taraflar, toplam ve en az bir satır zorunludur.
    expect(eksikler.map((i) => i.path.split('/').pop())).toEqual(
      expect.arrayContaining([
        'cac:AccountingSupplierParty',
        'cac:AccountingCustomerParty',
        'cac:LegalMonetaryTotal',
        'cac:InvoiceLine',
      ]),
    )
  })

  it('tanınmayan öğeyi yakalar', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      leaf(CBC, 'Uydurma', 'x'),
    ])
    const bulgu = validateStructure(bozuk).issues.find((i) => i.code === 'UNKNOWN_ELEMENT')
    expect(bulgu?.path).toContain('cbc:Uydurma')
  })

  it('yanlış ad alanındaki öğeyi tanınmayan sayar', () => {
    // `cbc:ProfileID` ile `cac:ProfileID` aynı şey değildir; ad alanını
    // silen bir ayrıştırıcıda bu ayrım kaybolur.
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'ProfileID', [leaf(CBC, 'ID', 'x')]),
    ])
    expect(validateStructure(bozuk).issues.some((i) => i.code === 'UNKNOWN_ELEMENT')).toBe(true)
  })

  it('tekrar sınırını aşan öğeyi yakalar', () => {
    const bozuk = container(CAC, 'LegalMonetaryTotal', [
      leaf(CBC, 'LineExtensionAmount', '1'),
      leaf(CBC, 'TaxExclusiveAmount', '1'),
      leaf(CBC, 'TaxInclusiveAmount', '1'),
      leaf(CBC, 'PayableAmount', '1'),
      leaf(CBC, 'PayableAmount', '2'),
    ])
    const bulgu = validateStructure(bozuk).issues.find((i) => i.code === 'TOO_MANY_ELEMENTS')
    expect(bulgu?.message).toContain('en fazla 1 kez')
  })

  it('iç içe öğelerdeki hatayı da bulur ve yolunu bildirir', () => {
    const bozuk = container(INVOICE_NS, 'Invoice', [
      leaf(CBC, 'CustomizationID', 'TR1.2'),
      container(CAC, 'LegalMonetaryTotal', [leaf(CBC, 'PayableAmount', '1')]),
    ])
    const bulgu = validateStructure(bozuk).issues.find(
      (i) => i.code === 'MISSING_REQUIRED_ELEMENT' && i.path.includes('LegalMonetaryTotal'),
    )
    expect(bulgu?.path).toContain('cac:LegalMonetaryTotal[2]/cbc:LineExtensionAmount')
  })

  it('modellenmemiş öğenin altını denetlemez', () => {
    // Eksik bir modelle yanlış hata üretmektense sessiz kalmak yeğdir.
    const bilinmeyen = container(CAC, 'ModellenmemisTip', [leaf(CBC, 'Herhangi', 'x')])
    expect(validateStructure(bilinmeyen).issues).toEqual([])
  })
})
