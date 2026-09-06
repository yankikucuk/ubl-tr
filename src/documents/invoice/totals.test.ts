import { describe, expect, it } from 'vitest'

import { formatAmount } from '../amount/amount-in-words.js'

import { calculateInvoice, calculateLine, isVatFree, lineUnitCode } from './totals.js'

const f = (v: Parameters<typeof formatAmount>[0]): string => formatAmount(v)

describe('satır hesabı', () => {
  it('brüt, satır tutarı ve KDV', () => {
    const s = calculateLine({ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }, 1)
    expect(f(s.grossAmount)).toBe('1000.00')
    expect(f(s.lineExtensionAmount)).toBe('1000.00')
    expect(f(s.vatAmount)).toBe('200.00')
    expect(s.withholdingAmount).toBeUndefined()
  })

  it('iskonto oranını uygular', () => {
    const s = calculateLine(
      { name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20, discountRate: 10 },
      1,
    )
    expect(f(s.discountAmount)).toBe('100.00')
    expect(f(s.lineExtensionAmount)).toBe('900.00')
    expect(f(s.vatAmount)).toBe('180.00')
  })

  it('iskonto tutarını doğrudan kabul eder', () => {
    const s = calculateLine(
      { name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20, discountAmount: 250 },
      1,
    )
    expect(f(s.lineExtensionAmount)).toBe('750.00')
  })

  it('iskonto oranı ve tutarını birlikte reddeder', () => {
    expect(() =>
      calculateLine(
        { name: 'x', quantity: 1, unitPrice: 1, vatRate: 20, discountRate: 5, discountAmount: 5 },
        1,
      ),
    ).toThrow(RangeError)
  })

  it('tevkifatı KDV üzerinden hesaplar', () => {
    // 603 — makine bakım-onarım, 7/10. KDV 200 → tevkifat 140.
    const s = calculateLine(
      { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
      1,
    )
    expect(f(s.vatAmount)).toBe('200.00')
    expect(f(s.withholdingAmount ?? s.vatAmount)).toBe('140.00')
  })

  it('bilinmeyen tevkifat ve vergi kodunu reddeder', () => {
    expect(() =>
      calculateLine(
        { name: 'x', quantity: 1, unitPrice: 1, vatRate: 20, withholdingCode: '999' },
        1,
      ),
    ).toThrow(/tevkifat kodu/)
    expect(() =>
      calculateLine(
        { name: 'x', quantity: 1, unitPrice: 1, vatRate: 20, taxes: [{ code: '9999', rate: 5 }] },
        1,
      ),
    ).toThrow(/vergi türü kodu/)
  })

  it('ÖTV KDV matrahını artırır', () => {
    // ÖTV, KDV'den ÖNCE hesaplanır ve KDV matrahına eklenir: KDV, ÖTV dâhil
    // tutar üzerinden alınır. 1000 + %20 ÖTV = 1200 matrah, KDV 240.
    const s = calculateLine(
      {
        name: 'Akaryakıt',
        quantity: 10,
        unitPrice: 100,
        vatRate: 20,
        taxes: [{ code: '0071', rate: 20 }],
      },
      1,
    )
    expect(f(s.lineExtensionAmount)).toBe('1000.00')
    expect(f(s.vatBase)).toBe('1200.00')
    expect(f(s.vatAmount)).toBe('240.00')
  })

  it('damga vergisi KDV matrahını azaltır', () => {
    // Bu testin ilk hâli matrahın değişmediğini varsayıyordu; referans
    // senaryolara karşı çalıştırınca varsayımın yanlış olduğu görüldü.
    // GİB'in vergi tanımlarında üç ayrı etki var — artıran (ÖTV), azaltan
    // (damga vergisi, ÖİV, borsa tescil) ve nötr (stopaj).
    const s = calculateLine(
      { name: 'x', quantity: 10, unitPrice: 100, vatRate: 20, taxes: [{ code: '1047', rate: 1 }] },
      1,
    )
    expect(f(s.vatBase)).toBe('990.00')
    expect(f(s.vatAmount)).toBe('198.00')
    expect(f(s.taxes[0]?.taxAmount ?? s.vatAmount)).toBe('10.00')
  })

  it('varsayılan birim adettir', () => {
    expect(lineUnitCode({ name: 'x', quantity: 1, unitPrice: 1, vatRate: 20 })).toBe('C62')
    expect(
      lineUnitCode({ name: 'x', quantity: 1, unitPrice: 1, vatRate: 20, unitCode: 'KGM' }),
    ).toBe('KGM')
  })
})

describe('fatura toplamı', () => {
  it('tek satırlık satış', () => {
    const t = calculateInvoice({
      lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
    })
    expect(f(t.lineExtensionAmount)).toBe('1000.00')
    expect(f(t.taxExclusiveAmount)).toBe('1000.00')
    expect(f(t.vatTotalAmount)).toBe('200.00')
    expect(f(t.taxInclusiveAmount)).toBe('1200.00')
    expect(f(t.payableAmount)).toBe('1200.00')
  })

  it('çoklu KDV oranında her oran ayrı alt toplam olur', () => {
    // UBL-TR'de her (vergi kodu, oran) çifti için TEK bir cac:TaxSubtotal
    // bulunur; aynı orandaki satırlar birleştirilir.
    const t = calculateInvoice({
      lines: [
        { name: 'Temel gıda', quantity: 10, unitPrice: 10, vatRate: 1 },
        { name: 'İndirimli', quantity: 10, unitPrice: 20, vatRate: 10 },
        { name: 'Standart', quantity: 10, unitPrice: 30, vatRate: 20 },
        { name: 'Standart 2', quantity: 10, unitPrice: 40, vatRate: 20 },
      ],
    })
    expect(t.vatSubtotals).toHaveLength(3)
    const yirmi = t.vatSubtotals.find((s) => f(s.rate) === '20.00')
    expect(f(yirmi?.taxableAmount ?? t.vatTotalAmount)).toBe('700.00')
    expect(f(yirmi?.taxAmount ?? t.vatTotalAmount)).toBe('140.00')
    expect(f(t.lineExtensionAmount)).toBe('1000.00')
    expect(f(t.vatTotalAmount)).toBe('161.00')
  })

  it('tevkifat ödenecek tutardan düşer', () => {
    const t = calculateInvoice({
      lines: [{ name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' }],
    })
    expect(f(t.vatTotalAmount)).toBe('200.00')
    expect(f(t.withholdingTotalAmount)).toBe('140.00')
    expect(f(t.payableAmount)).toBe('1060.00')
    expect(t.withholdingSubtotals).toHaveLength(1)
    expect(t.withholdingSubtotals[0]?.code).toBe('603')
  })

  it('tam tevkifatta KDV’nin tamamı düşer', () => {
    const t = calculateInvoice({
      lines: [{ name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '803' }],
    })
    expect(f(t.withholdingTotalAmount)).toBe('200.00')
    expect(f(t.payableAmount)).toBe('1000.00')
  })

  it('istisna faturada KDV sıfırdır', () => {
    const t = calculateInvoice({
      lines: [{ name: 'İhracat', quantity: 1, unitPrice: 5000, vatRate: 0, exemptionCode: '301' }],
    })
    expect(f(t.vatTotalAmount)).toBe('0.00')
    expect(f(t.payableAmount)).toBe('5000.00')
    expect(isVatFree(t)).toBe(true)
  })

  it('iskonto toplamı ayrı raporlanır', () => {
    const t = calculateInvoice({
      lines: [
        { name: 'A', quantity: 10, unitPrice: 100, vatRate: 20, discountRate: 10 },
        { name: 'B', quantity: 10, unitPrice: 100, vatRate: 20, discountAmount: 50 },
      ],
    })
    expect(f(t.allowanceTotalAmount)).toBe('150.00')
    expect(f(t.lineExtensionAmount)).toBe('1850.00')
  })

  it('boş satır listesini reddeder', () => {
    expect(() => calculateInvoice({ lines: [] })).toThrow(RangeError)
  })
})

describe('aritmetik doğruluğu', () => {
  it('yüz satırlık faturada kuruş kaymaz', () => {
    // Kayan noktalı bir motorda bu toplam 6.999999999999995 olur ve
    // LegalMonetaryTotal satır toplamlarıyla tutmayabilir.
    const t = calculateInvoice({
      lines: Array.from({ length: 100 }, (_, i) => ({
        name: `Satır ${String(i + 1)}`,
        quantity: 1,
        unitPrice: '0.07',
        vatRate: 20,
      })),
    })
    expect(f(t.lineExtensionAmount)).toBe('7.00')
    expect(f(t.vatTotalAmount)).toBe('1.40')
    expect(f(t.payableAmount)).toBe('8.40')
  })

  it('hassas birim fiyatta ara sonuç yuvarlanmaz', () => {
    // 0,0035 TL bir kuruşun altındadır; satır bazında yuvarlanırsa tutar
    // sıfırlanır. Ara sonuç tam kalmalı, yuvarlama toplamda yapılmalıdır.
    const t = calculateInvoice({
      lines: Array.from({ length: 1000 }, () => ({
        name: 'Hassas',
        quantity: 1,
        unitPrice: '0.0035',
        vatRate: 0,
      })),
    })
    expect(f(t.lineExtensionAmount)).toBe('3.50')
  })

  it('kesirli miktarda tam çarpım yapar', () => {
    const t = calculateInvoice({
      lines: [{ name: 'Ceviz', quantity: '0.125', unitPrice: '33.33', vatRate: 1 }],
    })
    // 0,125 × 33,33 = 4,16625 → 4,17
    expect(f(t.lineExtensionAmount)).toBe('4.17')
  })

  it('para biriminin ondalık basamağına uyar', () => {
    const t = calculateInvoice({
      currencyCode: 'JPY',
      lines: [{ name: 'x', quantity: 3, unitPrice: '1000.5', vatRate: 0 }],
    })
    expect(formatAmount(t.lineExtensionAmount, 'JPY')).toBe('3002')
  })
})

describe('ek vergilerin toplama etkisi', () => {
  it('gelir stopajı ödenecek tutardan düşer', () => {
    // REGRESYON — 15.000 TL, KDV %20 = 3.000, gelir stopajı %23 = 3.450.
    // Stopajı toplamdan DÜŞMEK yerine EKLEMEK, ödenecek tutarı iki kat
    // stopaj kadar yanlış gösterir: 14.550 yerine 21.450. Bu hata
    // referans senaryolara karşı çalıştırınca ortaya çıktı.
    const t = calculateInvoice({
      lines: [
        {
          name: 'Danışmanlık',
          quantity: 10,
          unitPrice: 1500,
          vatRate: 20,
          taxes: [{ code: '0003', rate: 23 }],
        },
      ],
    })
    expect(f(t.lineExtensionAmount)).toBe('15000.00')
    expect(f(t.taxExclusiveAmount)).toBe('15000.00')
    expect(f(t.vatTotalAmount)).toBe('3000.00')
    expect(f(t.otherTaxTotalAmount)).toBe('3450.00')
    expect(f(t.taxInclusiveAmount)).toBe('14550.00')
    expect(f(t.payableAmount)).toBe('14550.00')
  })

  it('kurumlar stopajı da aynı biçimde düşer', () => {
    const t = calculateInvoice({
      lines: [
        {
          name: 'Hizmet',
          quantity: 10,
          unitPrice: 1500,
          vatRate: 20,
          taxes: [{ code: '0011', rate: 32 }],
        },
      ],
    })
    expect(f(t.payableAmount)).toBe('13200.00')
  })

  it('vergi hariç toplam satır toplamına eşittir, ek vergi eklenmez', () => {
    // REGRESYON — ÖTV KDV matrahını artırır ama `cbc:TaxExclusiveAmount`
    // vergi HARİÇ tutardır; ÖTV'yi buraya eklemek onu ÖTV kadar şişirir.
    // Referans çıktı 400 verirken bizimki 600 veriyordu.
    const t = calculateInvoice({
      lines: [
        {
          name: 'Motorin',
          quantity: 10,
          unitPrice: 40,
          vatRate: 20,
          taxes: [{ code: '4171', rate: 50 }],
        },
      ],
    })
    expect(f(t.lineExtensionAmount)).toBe('400.00')
    expect(f(t.taxExclusiveAmount)).toBe('400.00')
    // KDV matrahı ÖTV dâhil: 400 + 200 = 600, KDV %20 = 120
    expect(f(t.vatSubtotals[0]?.taxableAmount ?? t.vatTotalAmount)).toBe('600.00')
    expect(f(t.vatTotalAmount)).toBe('120.00')
    expect(f(t.taxInclusiveAmount)).toBe('720.00')
  })

  it('ÖTV ve tevkifat birlikte', () => {
    const t = calculateInvoice({
      lines: [
        {
          name: 'Motorin',
          quantity: 10,
          unitPrice: 40,
          vatRate: 20,
          withholdingCode: '606',
          taxes: [{ code: '4171', rate: 50 }],
        },
      ],
    })
    expect(f(t.withholdingTotalAmount)).toBe('108.00')
    expect(f(t.payableAmount)).toBe('612.00')
  })

  it('matrahı azaltan vergi KDV’yi düşürür', () => {
    // Damga vergisi grubundaki kodlar matrahtan DÜŞER; matrahı artıran
    // ÖTV grubuyla karıştırmak KDV'yi ters yönde kaydırır.
    const t = calculateInvoice({
      lines: [
        {
          name: 'x',
          quantity: 1,
          unitPrice: 1000,
          vatRate: 20,
          taxes: [{ code: '1047', rate: 10 }],
        },
      ],
    })
    expect(f(t.vatSubtotals[0]?.taxableAmount ?? t.vatTotalAmount)).toBe('900.00')
    expect(f(t.vatTotalAmount)).toBe('180.00')
  })
})
