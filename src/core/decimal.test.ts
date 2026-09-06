import { describe, expect, it } from 'vitest'

import {
  add,
  compare,
  decimal,
  isZero,
  multiply,
  negate,
  percentage,
  rescale,
  subtract,
  sum,
  toNumber,
  toStringValue,
} from './decimal.js'

const d = (value: string, scale?: number): ReturnType<typeof decimal> => decimal(value, scale)
const s = (value: ReturnType<typeof decimal>, scale?: number): string => toStringValue(value, scale)

describe('ayrıştırma', () => {
  it('metin ve sayıyı aynı sonuca çevirir', () => {
    expect(s(decimal('1.005', 3))).toBe('1.005')
    expect(s(decimal(1.005, 3))).toBe('1.005')
  })

  it('kayan nokta tuzağına düşmez', () => {
    // REGRESYON — `toFixed` tabanlı üreticilerde (1.005).toFixed(2) "1.00"
    // verir, çünkü 1.005 double olarak 1.00499999999999989…'dır. Bir kuruş
    // mükellefin aleyhine kaybolur. Basamak üzerinden ayrıştırma bunu
    // yaşamaz: çağıran "1.005" yazdıysa 1.005 alır.
    expect((1.005).toFixed(2)).toBe('1.00')
    expect(s(decimal(1.005, 2))).toBe('1.01')
  })

  it('üstel gösterimi düz ondalığa çevirir', () => {
    // REGRESYON — (1e21).toFixed(2) "1e+21" verir ve XSD `decimal` üstel
    // gösterim kabul etmez; belge şema doğrulamasında düşer.
    expect((1e21).toFixed(2)).toBe('1e+21')
    expect(s(decimal('1e21', 2))).toBe('1000000000000000000000.00')
    expect(s(decimal('1.5e-3', 6))).toBe('0.001500')
  })

  it('işareti ve eksik parçaları kabul eder', () => {
    expect(s(d('-5.5', 2))).toBe('-5.50')
    expect(s(d('+5.5', 2))).toBe('5.50')
    expect(s(d('.5', 2))).toBe('0.50')
    expect(s(d('5.', 2))).toBe('5.00')
  })

  it('ondalık olmayan girdiyi reddeder', () => {
    for (const bozuk of ['', 'abc', '1,5', '1.2.3', ' ']) {
      expect(() => decimal(bozuk)).toThrow(RangeError)
    }
  })

  it('bigint girdiyi kabul eder', () => {
    expect(s(decimal(12345678901234567890n, 2))).toBe('12345678901234567890.00')
  })
})

describe('yuvarlama', () => {
  it('yarımı sıfırdan uzağa yuvarlar', () => {
    // REGRESYON — Math.round(-2.5) === -2, yani yarımı her zaman +∞ yönüne
    // yuvarlar. İade faturası ve iskonto gibi negatif tutarlarda bu yanlış
    // sonuç verir.
    expect(Math.round(-2.5)).toBe(-2)
    expect(s(rescale(d('2.5'), 0))).toBe('3')
    expect(s(rescale(d('-2.5'), 0))).toBe('-3')
    expect(s(rescale(d('3.5'), 0))).toBe('4')
    expect(s(rescale(d('-3.5'), 0))).toBe('-4')
  })

  it('yarımın altını ve üstünü doğru yuvarlar', () => {
    expect(s(rescale(d('2.344'), 2))).toBe('2.34')
    expect(s(rescale(d('2.345'), 2))).toBe('2.35')
    expect(s(rescale(d('2.346'), 2))).toBe('2.35')
  })

  it('basamak artırmak kayıpsızdır', () => {
    expect(s(rescale(d('1.2'), 4))).toBe('1.2000')
    expect(compare(rescale(d('1.2'), 4), d('1.2'))).toBe(0)
  })
})

describe('aritmetik', () => {
  it('toplama tamdır', () => {
    // 0.1 + 0.2 === 0.30000000000000004 kayan noktada; burada değil.
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(s(add(d('0.1', 2), d('0.2', 2)))).toBe('0.30')
  })

  it('yüz satırlık faturada birikme olmaz', () => {
    const satirlar = Array.from({ length: 100 }, () => d('0.07', 2))
    expect(s(sum(satirlar))).toBe('7.00')
  })

  it('çarpım yuvarlanmaz, tam kalır', () => {
    // Miktar × birim fiyat ara sonucu tam kalmalı; önce yuvarlayıp sonra
    // toplamak, çok satırlı faturada LegalMonetaryTotal ile satır
    // toplamlarının tutmamasının en yaygın sebebidir.
    expect(s(multiply(d('0.125'), d('33.33')))).toBe('4.16625')
  })

  it('yüzde hesabı tamdır', () => {
    expect(s(percentage(d('1000.00'), d('20')), 2)).toBe('200.00')
    expect(s(percentage(d('1000.00'), d('1')), 2)).toBe('10.00')
    expect(s(percentage(d('33.33'), d('18')), 2)).toBe('6.00')
  })

  it('çıkarma, ters çevirme ve sıfır denetimi', () => {
    expect(s(subtract(d('1200.00'), d('200.00')))).toBe('1000.00')
    expect(s(negate(d('100.00')))).toBe('-100.00')
    expect(isZero(d('0.000'))).toBe(true)
    expect(isZero(d('0.001'))).toBe(false)
  })

  it('karşılaştırma basamak farkını yok sayar', () => {
    expect(compare(d('1.10'), d('1.1'))).toBe(0)
    expect(compare(d('1.10'), d('1.2'))).toBeLessThan(0)
    expect(compare(d('1.30'), d('1.2'))).toBeGreaterThan(0)
  })

  it('boş toplam sıfırdır', () => {
    expect(s(sum([]))).toBe('0.00')
    expect(s(sum([], 4))).toBe('0.0000')
  })
})

describe('metne çevirme', () => {
  it('istenen basamağı zorlar', () => {
    expect(s(d('1200'), 2)).toBe('1200.00')
    expect(s(d('0.125'))).toBe('0.125')
  })

  it('negatif sıfırı düz yazar', () => {
    expect(s(rescale(d('-0.004'), 2))).toBe('0.00')
  })

  it('çok büyük değerlerde bile üstel gösterim üretmez', () => {
    const buyuk = multiply(d('1e15'), d('1e15'))
    expect(s(buyuk, 2)).not.toContain('e')
    expect(s(buyuk, 2).startsWith('1000000000000000000000000000000')).toBe(true)
  })

  it('sayıya çevirir', () => {
    expect(toNumber(d('1200.00'))).toBe(1200)
  })
})
