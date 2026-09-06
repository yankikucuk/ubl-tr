import { describe, expect, it } from 'vitest'

import { decimal } from '../../core/index.js'

import {
  amountInWords,
  isAmountInWordsNote,
  amountInWordsNote,
  formatAmount,
  integerToWords,
} from './amount-in-words.js'

const d = (value: string): ReturnType<typeof decimal> => decimal(value)

describe('tam sayıyı yazıya çevirme', () => {
  it('birler, onlar ve yüzler', () => {
    const beklenen: [bigint, string][] = [
      [0n, 'Sıfır'],
      [1n, 'Bir'],
      [9n, 'Dokuz'],
      [10n, 'On'],
      [11n, 'On Bir'],
      [20n, 'Yirmi'],
      [90n, 'Doksan'],
      [99n, 'Doksan Dokuz'],
      [100n, 'Yüz'],
      [101n, 'Yüz Bir'],
      [200n, 'İki Yüz'],
      [999n, 'Dokuz Yüz Doksan Dokuz'],
    ]
    for (const [sayi, metin] of beklenen) expect(integerToWords(sayi)).toBe(metin)
  })

  it('yüzler basamağında "Bir" söylenmez', () => {
    expect(integerToWords(100n)).toBe('Yüz')
    expect(integerToWords(100n)).not.toContain('Bir Yüz')
  })

  it('"Bin" tek başına söylenir ama "Bir Milyon" söylenir', () => {
    // Türkçedeki tek istisna bin grubudur: 1.000 "Bin"dir, 1.000.000
    // "Bir Milyon"dur. Kuralı bütün gruplara yaymak "Milyon" üretirdi.
    expect(integerToWords(1_000n)).toBe('Bin')
    expect(integerToWords(2_000n)).toBe('İki Bin')
    expect(integerToWords(1_000_000n)).toBe('Bir Milyon')
    expect(integerToWords(1_001_000n)).toBe('Bir Milyon Bin')
  })

  it('büyük sayılar', () => {
    expect(integerToWords(10_500n)).toBe('On Bin Beş Yüz')
    expect(integerToWords(123_456_789n)).toBe(
      'Yüz Yirmi Üç Milyon Dört Yüz Elli Altı Bin Yedi Yüz Seksen Dokuz',
    )
    expect(integerToWords(1_000_000_000n)).toBe('Bir Milyar')
  })

  it('negatif değeri reddeder', () => {
    expect(() => integerToWords(-1n)).toThrow(RangeError)
  })
})

describe('tutarı yazıya çevirme', () => {
  it('ana ve alt birimi birlikte yazar', () => {
    expect(amountInWords(d('1200.00'))).toBe('Bin İki Yüz Türk Lirası')
    expect(amountInWords(d('10500.75'))).toBe('On Bin Beş Yüz Türk Lirası Yetmiş Beş Kuruş')
  })

  it('önce yuvarlar, sonra ayırır', () => {
    // REGRESYON — incelenen bir paket önce ayırıp sonra yuvarlıyor ve
    // 1,999 TL için "Bir Türk Lirası Yüz Kuruş" üretiyor. Yüz kuruş diye
    // bir şey yoktur; yasal belgede tutar yanlış yazılmış olur.
    expect(amountInWords(d('1.999'))).toBe('İki Türk Lirası')
    expect(amountInWords(d('1.999'))).not.toContain('Yüz Kuruş')
    expect(amountInWords(d('0.999'))).toBe('Bir Türk Lirası')
  })

  it('ana birim sıfır olduğunda alt birimi düşürmez', () => {
    // REGRESYON — aynı paket, tam kısım sıfırsa erken dönüyor ve kuruşu
    // sessizce atıyor: 0,50 TL için "Sıfır Türk Lirası" üretiyor.
    expect(amountInWords(d('0.50'))).toBe('Sıfır Türk Lirası Elli Kuruş')
    expect(amountInWords(d('0.01'))).toBe('Sıfır Türk Lirası Bir Kuruş')
    expect(amountInWords(d('0.00'))).toBe('Sıfır Türk Lirası')
  })

  it('para birimini ve alt birimini doğru adlandırır', () => {
    // REGRESYON — aynı paket para birimi ne olursa olsun "Türk Lirası"
    // yazıyor ve alt birime her zaman "Kuruş" diyor. Kuruş yalnızca Türk
    // lirasının alt birimidir.
    expect(amountInWords(d('100.25'), 'USD')).toBe('Yüz Amerikan Doları Yirmi Beş Sent')
    expect(amountInWords(d('0.50'), 'USD')).toBe('Sıfır Amerikan Doları Elli Sent')
    expect(amountInWords(d('5.00'), 'GBP')).toBe('Beş İngiliz Sterlini')
    expect(amountInWords(d('100.25'), 'USD')).not.toContain('Kuruş')
  })

  it('para biriminin ondalık basamağına uyar', () => {
    // Yenin alt birimi yoktur; dinar üç basamaklıdır.
    expect(amountInWords(d('5000.60'), 'JPY')).toBe('Beş Bin Bir Japon Yeni')
    expect(amountInWords(d('1.500'), 'KWD')).toBe('Bir Kuveyt Dinarı Beş Yüz Fils')
  })

  it('bilinmeyen para biriminde kodu kullanır', () => {
    expect(amountInWords(d('5.00'), 'XYZ')).toBe('Beş XYZ')
  })

  it('negatif tutarı işaretler', () => {
    expect(amountInWords(d('-100.00'))).toBe('Eksi Yüz Türk Lirası')
  })

  it('Türkçe büyük harf dönüşümü yapar', () => {
    // REGRESYON — incelenen paket `toUpperCase()` kullanıyor ve ürettiği
    // HER faturanın yazıyla tutar alanında "TÜRK LIRASI" (noktasız I)
    // yazıyor. Doğrusu "TÜRK LİRASI"dır.
    expect('Lirası'.toUpperCase()).toBe('LIRASI')
    expect(amountInWords(d('1200.00'), 'TRY', { case: 'upper' })).toBe('BİN İKİ YÜZ TÜRK LİRASI')
    expect(amountInWords(d('1200.00'), 'TRY', { case: 'upper' })).not.toContain('LIRASI')
  })
})

describe('not biçimi', () => {
  it('varsayılan etiketle üretir', () => {
    expect(amountInWordsNote(d('1200.00'))).toBe('YALNIZ #Bin İki Yüz Türk Lirası#')
  })

  it('etiket ve harf biçimi seçilebilir', () => {
    expect(amountInWordsNote(d('1200.00'), 'TRY', { label: 'YAZIYLA:', case: 'upper' })).toBe(
      'YAZIYLA:#BİN İKİ YÜZ TÜRK LİRASI#',
    )
  })
})

describe('tutar biçimlendirme', () => {
  it('para biriminin basamak sayısını uygular', () => {
    expect(formatAmount(d('1200'), 'TRY')).toBe('1200.00')
    expect(formatAmount(d('1200'), 'JPY')).toBe('1200')
    expect(formatAmount(d('1.5'), 'KWD')).toBe('1.500')
  })
})

describe('yazıyla tutar notunu tanıma', () => {
  it('kendi ürettiği notu tanır', () => {
    expect(isAmountInWordsNote(amountInWordsNote(decimal('1200.00')))).toBe(true)
  })

  it('diğer yaygın etiketi de tanır', () => {
    expect(
      isAmountInWordsNote(amountInWordsNote(decimal('1200.00'), 'TRY', { label: 'YAZIYLA:' })),
    ).toBe(true)
  })

  it('küçük harfli ve Türkçe karakterli etiketi tanır', () => {
    expect(isAmountInWordsNote('Yazıyla:#BİN İKİ YÜZ TÜRK LİRASI#')).toBe(true)
    expect(isAmountInWordsNote('yalnız #Bin İki Yüz Türk Lirası#')).toBe(true)
  })

  it('özel etiketle üretilmiş notu etiket verilerek tanır', () => {
    const not = amountInWordsNote(decimal('1200.00'), 'TRY', { label: 'Tutar Yazıyla' })
    // Etiket verilmeden varsayılan desenle tanınmaz.
    expect(isAmountInWordsNote(not)).toBe(false)
    expect(isAmountInWordsNote(not, 'Tutar Yazıyla')).toBe(true)
    expect(isAmountInWordsNote(not, 'Başka Etiket')).toBe(false)
  })

  it('kullanıcının yazdığı notu tanımaz', () => {
    expect(isAmountInWordsNote('Sevkiyat 3 gün içinde yapılacak')).toBe(false)
    expect(isAmountInWordsNote('')).toBe(false)
    // Etiketle başlamayan, içinde geçen metin de not sayılmaz.
    expect(isAmountInWordsNote('Tutar YALNIZ nakit ödenir')).toBe(false)
  })
})
