/**
 * Ayrıştırıcının katmanlar arası testleri.
 *
 * `builders` ile `parsers` kardeş katmanlardır ve birbirini import edemez;
 * "üret, sonra oku" özelliğini sınayan testler bu yüzden burada durur.
 */
import { describe, expect, it } from 'vitest'

import { buildDespatchAdviceXml } from '../src/builders/despatch.js'
import { buildInvoiceXml, type InvoiceInput } from '../src/builders/invoice.js'
import { InvoiceProfile, InvoiceType } from '../src/constants/index.js'
import { parseDocument, toStringValue } from '../src/core/index.js'
import { parseDespatchAdvice } from '../src/parsers/despatch.js'
import { parseInvoice } from '../src/parsers/invoice.js'

const oku = (xml: string): ReturnType<typeof parseInvoice> => parseInvoice(parseDocument(xml).root)

const num = (
  d: { readonly units: bigint; readonly scale: number } | undefined,
): string | undefined => (d === undefined ? undefined : toStringValue(d, 2))

const girdi = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  id: 'ABC2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  issueTime: '10:00:00',
  profile: InvoiceProfile.TEMEL,
  type: InvoiceType.SATIS,
  supplier: {
    taxNumber: '7857313547',
    name: 'Satıcı A.Ş.',
    taxOffice: 'Üsküdar',
    phone: '+902161234567',
    email: 'info@ornek.example',
    address: { street: 'Cadde 1', district: 'Üsküdar', city: 'İstanbul', postalCode: '34664' },
  },
  customer: {
    taxNumber: '0149537825',
    name: 'Alıcı Ltd.',
    address: { district: 'Kadıköy', city: 'İstanbul' },
  },
  lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
  ...over,
})

describe('üret, sonra oku', () => {
  it('başlık alanlarını geri verir', () => {
    const f = oku(buildInvoiceXml(girdi()))
    expect(f.id).toBe('ABC2026000000001')
    expect(f.uuid).toBe('1a2b3c4d-0001-4000-8001-000000000001')
    expect(f.issueDate).toBe('2026-09-06')
    expect(f.issueTime).toBe('10:00:00')
    expect(f.profile).toBe('TEMELFATURA')
    expect(f.type).toBe('SATIS')
    expect(f.currencyCode).toBe('TRY')
  })

  it('tarafları geri verir', () => {
    const f = oku(buildInvoiceXml(girdi()))
    expect(f.supplier?.taxNumber).toBe('7857313547')
    expect(f.supplier?.taxNumberScheme).toBe('VKN')
    expect(f.supplier?.name).toBe('Satıcı A.Ş.')
    expect(f.supplier?.taxOffice).toBe('Üsküdar')
    expect(f.supplier?.address?.city).toBe('İstanbul')
    expect(f.supplier?.address?.postalCode).toBe('34664')
    expect(f.supplier?.email).toBe('info@ornek.example')
    expect(f.customer?.taxNumber).toBe('0149537825')
  })

  it('tutarları tam olarak geri verir', () => {
    const f = oku(buildInvoiceXml(girdi()))
    expect(num(f.totals.lineExtensionAmount)).toBe('1000.00')
    expect(num(f.totals.taxExclusiveAmount)).toBe('1000.00')
    expect(num(f.totals.taxInclusiveAmount)).toBe('1200.00')
    expect(num(f.totals.payableAmount)).toBe('1200.00')
    expect(num(f.taxAmount)).toBe('200.00')
  })

  it('satırları geri verir', () => {
    const f = oku(
      buildInvoiceXml(
        girdi({
          lines: [
            { name: 'Ceviz', quantity: '0.125', unitPrice: '33.33', vatRate: 1, unitCode: 'KGM' },
            { name: 'Ürün', quantity: 2, unitPrice: 50, vatRate: 20, discountRate: 10 },
          ],
        }),
      ),
    )
    expect(f.lines).toHaveLength(2)
    expect(f.lines[0]?.itemName).toBe('Ceviz')
    expect(f.lines[0]?.unitCode).toBe('KGM')
    // Hassasiyet korunur: 0,125 kırpılmaz.
    expect(toStringValue(f.lines[0]?.quantity ?? { units: 0n, scale: 0 })).toBe('0.125')
    expect(num(f.lines[1]?.discountAmount)).toBe('10.00')
  })

  it('tevkifatı geri verir', () => {
    const f = oku(
      buildInvoiceXml(
        girdi({
          type: InvoiceType.TEVKIFAT,
          lines: [
            { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
          ],
        }),
      ),
    )
    expect(num(f.withholdingTaxAmount)).toBe('140.00')
    expect(f.withholdingSubtotals[0]?.code).toBe('603')
    expect(num(f.withholdingSubtotals[0]?.rate)).toBe('70.00')
    expect(num(f.totals.payableAmount)).toBe('1060.00')
  })

  it('muafiyet, atıf, ödeme ve kuru geri verir', () => {
    const f = oku(
      buildInvoiceXml(
        girdi({
          type: InvoiceType.IADE,
          currencyCode: 'EUR',
          exchangeRate: { rate: 36.75 },
          billingReference: { id: 'ABC2026000000000', issueDate: '2026-08-01' },
          orderReference: { id: 'PO-1', issueDate: '2026-08-01' },
          paymentMeans: {
            meansCode: '42',
            dueDate: '2026-10-01',
            accountNumber: 'TR33',
            note: 'n',
          },
          additionalDocuments: [{ id: 'X', documentTypeCode: 'K', documentType: 'T' }],
          lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0, exemptionCode: '301' }],
        }),
      ),
    )
    expect(f.billingReference?.id).toBe('ABC2026000000000')
    expect(f.billingReference?.documentTypeCode).toBe('IADE')
    expect(f.orderReference?.id).toBe('PO-1')
    expect(f.paymentMeans?.accountNumber).toBe('TR33')
    expect(f.exchangeRate?.sourceCurrencyCode).toBe('EUR')
    expect(toStringValue(f.exchangeRate?.rate ?? { units: 0n, scale: 0 })).toBe('36.750000')
    expect(f.additionalDocuments[0]?.documentTypeCode).toBe('K')
    expect(f.taxSubtotals[0]?.exemptionCode).toBe('301')
    expect(f.taxSubtotals[0]?.exemptionReason).toBeDefined()
  })

  it('gerçek kişi ve kalem ayrıntılarını geri verir', () => {
    const f = oku(
      buildInvoiceXml(
        girdi({
          customer: {
            taxNumber: '52040077498',
            name: 'Ayşe Yılmaz',
            nationalityId: 'DE',
            identityDocumentId: 'N1',
            address: { district: 'Beşiktaş', city: 'İstanbul' },
          },
          lines: [
            {
              name: 'Kompresör',
              quantity: 1,
              unitPrice: 600,
              vatRate: 20,
              brandName: 'DemoMakine',
              modelName: 'DMK-2000',
              additionalIdentifications: [{ schemeId: 'KUNYENO', value: 'K1' }],
            },
          ],
        }),
      ),
    )
    expect(f.customer?.person?.firstName).toBe('Ayşe')
    expect(f.customer?.person?.familyName).toBe('Yılmaz')
    expect(f.customer?.person?.nationalityId).toBe('DE')
    expect(f.customer?.person?.identityDocumentId).toBe('N1')
    expect(f.lines[0]?.brandName).toBe('DemoMakine')
    expect(f.lines[0]?.identifications[0]).toEqual({ schemeId: 'KUNYENO', value: 'K1' })
  })

  it('yazıyla tutar notunu geri verir', () => {
    expect(oku(buildInvoiceXml(girdi())).notes[0]).toBe('YALNIZ #Bin İki Yüz Türk Lirası#')
  })
})

describe('e-İrsaliye okuma', () => {
  it('sevkiyat, sürücü ve plakaları geri verir', () => {
    const xml = buildDespatchAdviceXml({
      id: 'IRS2026000000001',
      uuid: '1a2b3c4d-0001-4000-8001-000000000001',
      issueDate: '2026-09-06',
      supplier: {
        taxNumber: '7857313547',
        name: 'Gönderen',
        address: { district: 'Üsküdar', city: 'İstanbul' },
      },
      customer: {
        taxNumber: '0149537825',
        name: 'Alıcı',
        address: { district: 'Kadıköy', city: 'İstanbul' },
      },
      shipment: {
        actualDespatchDate: '2026-09-06',
        actualDespatchTime: '14:00:00',
        carrierParty: { taxNumber: '0580438389', name: 'Kargo A.Ş.' },
        drivers: [
          { firstName: 'Mehmet', familyName: 'Birinci', nationalityId: '52040077498' },
          { firstName: 'Ali', familyName: 'İkinci' },
        ],
        licensePlates: [
          { plateNumber: '34ABC123' },
          { plateNumber: '34DEF456', schemeId: 'DORSE' },
        ],
      },
      lines: [
        {
          quantity: '0.125',
          unitCode: 'KGM',
          itemName: 'Ceviz',
          additionalIdentifications: [{ schemeId: 'ETIKETNO', value: 'E1' }],
        },
      ],
    })
    const i = parseDespatchAdvice(parseDocument(xml).root)
    expect(i.id).toBe('IRS2026000000001')
    expect(i.type).toBe('SEVK')
    expect(i.shipment?.actualDespatchDate).toBe('2026-09-06')
    expect(i.shipment?.carrierParty?.name).toBe('Kargo A.Ş.')
    expect(i.shipment?.drivers).toHaveLength(2)
    expect(i.shipment?.drivers[0]?.familyName).toBe('Birinci')
    expect(i.shipment?.licensePlates[1]).toEqual({ plateNumber: '34DEF456', schemeId: 'DORSE' })
    expect(i.lines[0]?.identifications[0]?.value).toBe('E1')
    expect(toStringValue(i.lines[0]?.quantity ?? { units: 0n, scale: 0 })).toBe('0.125')
  })
})

describe('hoşgörülü okuma', () => {
  it('eksik alanları undefined bırakır, çökmez', () => {
    // Bozuk bir alan yüzünden belgenin tamamının okunamaz hâle gelmesi,
    // o alanı boş bırakmaktan kötüdür. Geçerliliği söylemek doğrulayıcının
    // işidir; ayrıştırıcının işi okumaktır.
    const { root } = parseDocument(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
        ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">' +
        '<cbc:ID>ABC2026000000001</cbc:ID></Invoice>',
    )
    const f = parseInvoice(root)
    expect(f.id).toBe('ABC2026000000001')
    expect(f.supplier).toBeUndefined()
    expect(f.lines).toEqual([])
    expect(f.totals).toEqual({})
    expect(f.notes).toEqual([])
  })

  it('okunamayan sayıyı undefined bırakır', () => {
    const { root } = parseDocument(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
        ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"' +
        ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">' +
        '<cac:LegalMonetaryTotal><cbc:PayableAmount>abc</cbc:PayableAmount></cac:LegalMonetaryTotal>' +
        '</Invoice>',
    )
    expect(parseInvoice(root).totals.payableAmount).toBeUndefined()
  })
})
