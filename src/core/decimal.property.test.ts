import { describe, expect, it } from 'vitest'

import {
  add,
  compare,
  decimal,
  multiply,
  negate,
  rescale,
  subtract,
  sum,
  toStringValue,
  type Decimal,
} from './decimal.js'

/**
 * Ondalık aritmetiğin özellik testleri.
 *
 * Örnek tabanlı testler seçilen değerleri doğrular; buradaki testler
 * **bağımsız bir referansa** karşı binlerce değeri doğruluyor. Referans aynı
 * kodu paylaşmıyor: kesirleri `bigint` çift olarak tutup elle hizalıyor.
 * İki uygulama ayrı ayrı yanlış olabilir, ama aynı yerde aynı biçimde
 * yanlış olmaları beklenmez — ayrıştıkları yer bir bulgudur.
 *
 * Tohum sabit: bir hata çıkarsa aynı değerlerle yeniden üretilebilir.
 */

/** Referans gösterim: `n / 10 ** s`. */
interface Ref {
  readonly n: bigint
  readonly s: number
}

const ref = (n: bigint, s: number): Ref => ({ n, s })

/** İki referansı ortak basamağa getirir. */
const hizala = (a: Ref, b: Ref): [bigint, bigint, number] => {
  const s = Math.max(a.s, b.s)
  return [a.n * 10n ** BigInt(s - a.s), b.n * 10n ** BigInt(s - b.s), s]
}

const refTopla = (a: Ref, b: Ref): Ref => {
  const [x, y, s] = hizala(a, b)
  return ref(x + y, s)
}

const refCikar = (a: Ref, b: Ref): Ref => {
  const [x, y, s] = hizala(a, b)
  return ref(x - y, s)
}

const refCarp = (a: Ref, b: Ref): Ref => ref(a.n * b.n, a.s + b.s)

/** Sıfırdan uzağa yarım yukarı — modülün söz verdiği kural. */
const refYuvarla = (v: Ref, scale: number): Ref => {
  if (scale >= v.s) return ref(v.n * 10n ** BigInt(scale - v.s), scale)
  const bolen = 10n ** BigInt(v.s - scale)
  const bolum = v.n / bolen
  const kalan = v.n % bolen
  const yarim = bolen / 2n
  const uzaga = kalan >= 0n ? (kalan >= yarim ? 1n : 0n) : -kalan >= yarim ? -1n : 0n
  return ref(bolum + uzaga, scale)
}

const refMetin = (v: Ref): string => {
  const negatif = v.n < 0n
  const basamaklar = (negatif ? -v.n : v.n).toString().padStart(v.s + 1, '0')
  const tam = v.s === 0 ? basamaklar : basamaklar.slice(0, basamaklar.length - v.s)
  const kesir = v.s === 0 ? '' : `.${basamaklar.slice(basamaklar.length - v.s)}`
  return `${negatif ? '-' : ''}${tam}${kesir}`
}

/** Yinelenebilir sözde rastgele üreteç. */
const uretec = (tohum: number): (() => number) => {
  let durum = tohum >>> 0
  return () => {
    durum = (durum * 1664525 + 1013904223) >>> 0
    return durum / 0x100000000
  }
}

const rastgele = uretec(20260908)
const sec = <T>(liste: readonly T[]): T => liste[Math.floor(rastgele() * liste.length)] as T
const BASAMAKLAR = [0, 2, 4, 6] as const

/** Rastgele bir ondalık ve onun referans karşılığı. */
const ornek = (): [Decimal, Ref] => {
  const scale = sec(BASAMAKLAR)
  const units = BigInt(Math.floor((rastgele() - 0.5) * 2e15))
  return [{ units, scale }, ref(units, scale)]
}

describe('ondalık aritmetiği referansla örtüşüyor', () => {
  it('toplama, çıkarma ve çarpma 2000 rastgele çiftte birebir aynı', () => {
    for (let i = 0; i < 2000; i += 1) {
      const [a, ra] = ornek()
      const [b, rb] = ornek()
      expect(toStringValue(add(a, b))).toBe(refMetin(refTopla(ra, rb)))
      expect(toStringValue(subtract(a, b))).toBe(refMetin(refCikar(ra, rb)))
      expect(toStringValue(multiply(a, b))).toBe(refMetin(refCarp(ra, rb)))
    }
  })

  it('sıralama referansla aynı', () => {
    for (let i = 0; i < 1000; i += 1) {
      const [a, ra] = ornek()
      const [b, rb] = ornek()
      const [x, y] = hizala(ra, rb)
      expect(Math.sign(compare(a, b))).toBe(x < y ? -1 : x > y ? 1 : 0)
    }
  })

  it('toplama değişmeli, çıkarma ters simetrik', () => {
    for (let i = 0; i < 1000; i += 1) {
      const [a] = ornek()
      const [b] = ornek()
      expect(toStringValue(add(a, b))).toBe(toStringValue(add(b, a)))
      expect(compare(subtract(a, b), negate(subtract(b, a)))).toBe(0)
    }
  })
})

describe('yuvarlama sıfırdan uzağa', () => {
  /**
   * Tam yarımın iki yanı da taranıyor. `Math.round` bu testi geçemez:
   * `-2.5` değerini `-2`ye yuvarlar, yani iade faturasında kuruş kaybettirir.
   */
  it('üçüncü basamağı tam yarım olan 801 değerde doğru yuvarlıyor', () => {
    for (let i = -400; i <= 400; i += 1) {
      const metin = `${(i / 100).toFixed(2)}5`
      const beklenen = refYuvarla(
        ref(
          BigInt(metin.replace('.', '').replace('-', '')) * (metin.startsWith('-') ? -1n : 1n),
          3,
        ),
        2,
      )
      expect(rescale(decimal(metin), 2).units).toBe(beklenen.n)
    }
  })
})

describe('toplam ara yuvarlama yapmıyor', () => {
  /**
   * `sum` bilerek tam hassasiyet koruyor: yuvarlama en sonda yapılır. Ara
   * yuvarlama, çok satırlı faturada `LegalMonetaryTotal` ile satır
   * toplamlarının tutmamasına yol açar — GİB bunu çapraz denetler.
   */
  it('500 rastgele dizide katlanmış toplamla aynı', () => {
    for (let i = 0; i < 500; i += 1) {
      const adet = 1 + Math.floor(rastgele() * 12)
      const ciftler = Array.from({ length: adet }, () => ornek())
      const degerler = ciftler.map(([value]) => value)
      const katlanmis = ciftler.map(([, r]) => r).reduce(refTopla, ref(0n, 2))
      expect(toStringValue(sum(degerler, 2))).toBe(refMetin(katlanmis))
      expect(toStringValue(rescale(sum(degerler, 2), 2))).toBe(refMetin(refYuvarla(katlanmis, 2)))
    }
  })

  it('boş dizide verilen basamakta sıfır dönüyor', () => {
    expect(toStringValue(sum([], 4))).toBe('0.0000')
  })
})

describe('XSD decimal uyumu', () => {
  /** XSD `decimal` üstel gösterim kabul etmez; çıktıda asla `e` olmamalı. */
  it('büyük ve küçük değerler üstel gösterime kaçmıyor', () => {
    for (const metin of ['1e21', '1e-21', '1e30', '-1e25', '123456789012345678901234567890']) {
      expect(toStringValue(decimal(metin, 2))).not.toMatch(/[eE]/)
    }
  })
})
