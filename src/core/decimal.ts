/**
 * Sabit noktalı ondalık sayı: `units / 10 ** scale`.
 *
 * Değer `bigint` olarak taşınır; kayan nokta **hiç kullanılmaz**. Bunun
 * sebebi teorik değil, ölçülmüş: incelenen UBL-TR paketlerinin tamamı
 * tutarları `number` üzerinde tutup `toFixed(2)` ile yazıyor. O yolda üç
 * ayrı hata sınıfı doğar:
 *
 * - `(1.005).toFixed(2)` `"1.00"` verir — çünkü 1.005 double olarak
 *   1.00499999999999989…'dır. Bir kuruş, mükellefin aleyhine kaybolur.
 * - Çok satırlı bir faturada toplama hataları birikir ve `LegalMonetaryTotal`
 *   satır toplamlarıyla tutmaz; GİB bunu çapraz denetler.
 * - `(1e21).toFixed(2)` `"1e+21"` verir; XSD `decimal` üstel gösterim kabul
 *   etmez ve belge şema doğrulamasında düşer.
 *
 * `bigint` bu üçünü birden imkânsız kılar ve taşma sınırı da yoktur.
 */
export interface Decimal {
  /** Ölçeklenmiş tam sayı değer. */
  readonly units: bigint
  /** Ondalık basamak sayısı. Negatif olamaz. */
  readonly scale: number
}

/** Onun kuvvetlerini `bigint` olarak üretir. */
const pow10 = (exponent: number): bigint => 10n ** BigInt(exponent)

/** Ondalık gösterimi parçalarına ayıran desen; üstel gösterimi de kabul eder. */
const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/

/**
 * Metin ya da sayıdan sabit noktalı ondalık üretir.
 *
 * **Sayı verildiğinde bile ara işlem kayan noktada yapılmaz:** değer önce
 * `String(value)` ile en kısa gidiş-dönüş gösterimine çevrilir, sonra
 * basamaklar üzerinden ayrıştırılır. Böylece `1.005` yazan bir çağıran
 * `1.005` alır — `Math.round(1.005 * 100)` yolunun verdiği `1.00` değil.
 *
 * @param value - Ondalık değer; metin, sayı ya da `bigint`
 * @param scale - İstenen ondalık basamak sayısı; verilmezse girdideki kadar
 * @returns Sabit noktalı ondalık
 * @throws {RangeError} Değer ondalık sayı olarak ayrıştırılamıyorsa
 *
 * @example
 * ```ts
 * decimal('1.005', 2)  // 1.01 — yarım yukarı, sıfırdan uzağa
 * decimal(1.005, 2)    // 1.01 — sayı girdide de aynı sonuç
 * decimal('0.0035', 6) // 0.003500 — hassas birim fiyat korunur
 * decimal('1e21', 2)   // üstel gösterim çözülür, tam sayıya döner
 * ```
 */
export const decimal = (value: string | number | bigint, scale?: number): Decimal => {
  if (typeof value === 'bigint') {
    return rescale({ units: value, scale: 0 }, scale ?? 0)
  }
  const metin = typeof value === 'number' ? String(value) : value.trim()
  const eslesme = DECIMAL.exec(metin)
  if (eslesme === null || (eslesme[2] ?? '') + (eslesme[3] ?? '') === '') {
    throw new RangeError(`"${metin}" bir ondalık sayı olarak okunamadı.`)
  }
  const [, isaret = '', tamKisim = '', kesirKisim = '', ustel] = eslesme
  const basamaklar = `${tamKisim}${kesirKisim}`
  // Nokta konumu: tam kısmın uzunluğu, üstel kadar kaydırılmış.
  const noktaKonumu = tamKisim.length + Number(ustel ?? '0')
  const girdiScale = basamaklar.length - noktaKonumu
  const negatif = isaret === '-'
  const ham: Decimal = {
    units: (negatif ? -1n : 1n) * BigInt(basamaklar === '' ? '0' : basamaklar),
    scale: girdiScale,
  }
  // `scale` negatif olabilir (ör. "1e21" → scale -19); rescale bunu düzeltir.
  return rescale(ham, scale ?? Math.max(girdiScale, 0))
}

/**
 * Bir ondalığı hedef basamak sayısına çevirir.
 *
 * Basamak azaltılırken **sıfırdan uzağa yarım yukarı** (half away from zero)
 * yuvarlanır: `2,5 → 3` ve `−2,5 → −3`. Türk vergi uygulamasında beklenen
 * budur. JavaScript'in `Math.round` işlevi bunu yapmaz — `Math.round(-2.5)`
 * `-2` verir, yani yarımı her zaman `+∞` yönüne yuvarlar ve negatif tutarlarda
 * (iade faturası, iskonto) yanlış sonuç üretir.
 *
 * @param value - Çevrilecek ondalık
 * @param scale - Hedef basamak sayısı
 * @returns Hedef basamaktaki ondalık
 *
 * @example
 * ```ts
 * rescale(decimal('2.345'), 2)  // 2.35
 * rescale(decimal('2.5'), 0)    // 3
 * rescale(decimal('-2.5'), 0)   // -3  (Math.round(-2.5) === -2 olurdu)
 * rescale(decimal('1.20'), 4)   // 1.2000 — basamak artırmak kayıpsızdır
 * ```
 */
export const rescale = (value: Decimal, scale: number): Decimal => {
  if (scale === value.scale) return value
  if (scale > value.scale) {
    return { units: value.units * pow10(scale - value.scale), scale }
  }
  const bolen = pow10(value.scale - scale)
  const negatif = value.units < 0n
  const mutlak = negatif ? -value.units : value.units
  const bolum = mutlak / bolen
  const kalan = mutlak % bolen
  // Yarım ve üzeri sıfırdan uzağa yuvarlanır.
  const yuvarli = kalan * 2n >= bolen ? bolum + 1n : bolum
  return { units: negatif ? -yuvarli : yuvarli, scale }
}

/** İki ondalığı ortak (daha büyük) basamağa hizalar. */
const align = (a: Decimal, b: Decimal): [Decimal, Decimal, number] => {
  const scale = Math.max(a.scale, b.scale)
  return [rescale(a, scale), rescale(b, scale), scale]
}

/**
 * İki ondalığı toplar. Sonuç, ikisinin en büyük basamağında ve **tamdır**.
 *
 * @param a - Birinci değer
 * @param b - İkinci değer
 * @returns Toplam
 *
 * @example
 * ```ts
 * add(decimal('0.1', 2), decimal('0.2', 2)) // tam olarak 0.30
 * ```
 */
export const add = (a: Decimal, b: Decimal): Decimal => {
  const [x, y, scale] = align(a, b)
  return { units: x.units + y.units, scale }
}

/**
 * Birinci ondalıktan ikinciyi çıkarır.
 *
 * @param a - Eksilen
 * @param b - Çıkan
 * @returns Fark
 *
 * @example
 * ```ts
 * subtract(decimal('1200.00'), decimal('200.00')) // 1000.00
 * ```
 */
export const subtract = (a: Decimal, b: Decimal): Decimal => {
  const [x, y, scale] = align(a, b)
  return { units: x.units - y.units, scale }
}

/**
 * İki ondalığı çarpar. Sonucun basamağı ikisinin **toplamıdır** ve çarpım
 * tamdır; yuvarlama yapılmaz.
 *
 * Bu bilinçlidir: miktar × birim fiyat ara sonucu, tutara yuvarlanmadan
 * önce tam kalmalıdır. Önce yuvarlayıp sonra toplamak, çok satırlı
 * faturalarda `LegalMonetaryTotal` ile satır toplamlarının tutmamasının
 * en yaygın sebebidir.
 *
 * @param a - Birinci çarpan
 * @param b - İkinci çarpan
 * @returns Tam çarpım
 *
 * @example
 * ```ts
 * // 0,125 kg × 33,33 TL — ara sonuç tam, yuvarlama tutar aşamasında yapılır
 * multiply(decimal('0.125'), decimal('33.33')) // 4.16625
 * ```
 */
export const multiply = (a: Decimal, b: Decimal): Decimal => ({
  units: a.units * b.units,
  scale: a.scale + b.scale,
})

/**
 * Bir ondalığın belirtilen yüzdesini hesaplar. Sonuç tamdır.
 *
 * @param value - Üzerinden yüzde alınacak değer
 * @param rate - Yüzde oranı (KDV %20 için `20`)
 * @returns Tam sonuç
 *
 * @example
 * ```ts
 * percentage(decimal('1000.00'), decimal('20')) // 200.0000
 * percentage(decimal('1000.00'), decimal('1'))  // 10.0000
 * ```
 */
export const percentage = (value: Decimal, rate: Decimal): Decimal => {
  const carpim = multiply(value, rate)
  return { units: carpim.units, scale: carpim.scale + 2 }
}

/**
 * Bir ondalık dizisini toplar. Boş dizide sıfır döner.
 *
 * @param values - Toplanacak değerler
 * @param scale - Boş dizide dönecek sıfırın basamağı; varsayılan 2
 * @returns Toplam
 *
 * @example
 * ```ts
 * sum([decimal('10.00'), decimal('20.50'), decimal('0.125')]) // 30.625
 * sum([]) // 0.00
 * ```
 */
export const sum = (values: readonly Decimal[], scale = 2): Decimal =>
  values.reduce<Decimal>((toplam, deger) => add(toplam, deger), { units: 0n, scale })

/**
 * İki ondalığı karşılaştırır.
 *
 * @param a - Birinci değer
 * @param b - İkinci değer
 * @returns `a < b` ise negatif, eşitse 0, `a > b` ise pozitif
 *
 * @example
 * ```ts
 * compare(decimal('1.10'), decimal('1.1')) // 0 — basamak farkı önemsiz
 * ```
 */
export const compare = (a: Decimal, b: Decimal): number => {
  const [x, y] = align(a, b)
  if (x.units < y.units) return -1
  return x.units > y.units ? 1 : 0
}

/**
 * Bir ondalığın sıfır olup olmadığını söyler.
 *
 * @param value - Denetlenecek değer
 * @returns Değer sıfırsa `true`
 *
 * @example
 * ```ts
 * isZero(decimal('0.000')) // true
 * ```
 */
export const isZero = (value: Decimal): boolean => value.units === 0n

/**
 * Bir ondalığın işaretini ters çevirir.
 *
 * @param value - Çevrilecek değer
 * @returns İşareti ters çevrilmiş değer
 *
 * @example
 * ```ts
 * negate(decimal('100.00')) // -100.00
 * ```
 */
export const negate = (value: Decimal): Decimal => ({ units: -value.units, scale: value.scale })

/**
 * Bir ondalığı XML'e yazılabilir metne çevirir.
 *
 * Çıktı her zaman düz ondalık gösterimdir; üstel gösterim **hiç
 * üretilmez**. XSD `decimal` üstel gösterim kabul etmez ve `toFixed`
 * tabanlı üreticiler büyük tutarlarda tam olarak bunu üretir.
 *
 * @param value - Yazılacak değer
 * @param scale - Zorunlu basamak sayısı; verilmezse değerin kendi basamağı
 * @returns Ondalık gösterim
 *
 * @example
 * ```ts
 * toStringValue(decimal('1200'), 2)    // '1200.00'
 * toStringValue(decimal('0.125'))      // '0.125'
 * toStringValue(decimal('-5.5'), 2)    // '-5.50'
 * toStringValue(decimal('1e21'), 2)    // '1000000000000000000000.00'
 * ```
 */
export const toStringValue = (value: Decimal, scale?: number): string => {
  const hedef = scale === undefined ? value : rescale(value, scale)
  const negatif = hedef.units < 0n
  const basamaklar = (negatif ? -hedef.units : hedef.units).toString()
  if (hedef.scale <= 0) {
    const tam = hedef.scale === 0 ? basamaklar : basamaklar + '0'.repeat(-hedef.scale)
    return `${negatif ? '-' : ''}${tam}`
  }
  const dolgulu = basamaklar.padStart(hedef.scale + 1, '0')
  const tamKisim = dolgulu.slice(0, dolgulu.length - hedef.scale)
  const kesirKisim = dolgulu.slice(dolgulu.length - hedef.scale)
  return `${negatif ? '-' : ''}${tamKisim}.${kesirKisim}`
}

/**
 * Bir ondalığı JavaScript sayısına çevirir.
 *
 * **Kayıplı olabilir** ve yalnızca gösterim ya da karşılaştırma amaçlıdır;
 * hesaplamada kullanılmamalıdır. Kütüphane bu işlevi kendi içinde hiçbir
 * yerde kullanmaz.
 *
 * @param value - Çevrilecek değer
 * @returns Yaklaşık sayı değeri
 *
 * @example
 * ```ts
 * toNumber(decimal('1200.00')) // 1200
 * ```
 */
export const toNumber = (value: Decimal): number => Number(toStringValue(value))

/**
 * Bir ondalığı en az `min`, en fazla `max` basamakla yazar; `min` üzerindeki
 * gereksiz sondaki sıfırlar atılır.
 *
 * Miktar ve birim fiyat alanları için gereklidir. Bu alanlar parasal
 * görünseler de GİB'in ondalık biçim kuralı onlara uygulanmaz; sabit iki
 * basamağa zorlamak gerçek veriyi imha eder: `0,125 kg` → `"0.13"`,
 * `0,0035 TL` → `"0.00"`.
 *
 * @param value - Yazılacak değer
 * @param min - En az basamak sayısı
 * @param max - En fazla basamak sayısı
 * @returns Ondalık gösterim
 *
 * @example
 * ```ts
 * toStringValueRange(decimal('1'), 2, 6)      // '1.00'
 * toStringValueRange(decimal('0.125'), 2, 6)  // '0.125'
 * toStringValueRange(decimal('0.0035'), 2, 6) // '0.0035'
 * toStringValueRange(decimal('1.500'), 2, 6)  // '1.50'
 * ```
 */
export const toStringValueRange = (value: Decimal, min: number, max: number): string => {
  const altSinir = Math.max(0, min)
  const ustSinir = Math.max(altSinir, max)
  const yazi = toStringValue(value, ustSinir)
  if (altSinir === ustSinir || !yazi.includes('.')) return yazi
  const [tam = '', kesir = ''] = yazi.split('.')
  let kirpilmis = kesir
  while (kirpilmis.length > altSinir && kirpilmis.endsWith('0')) {
    kirpilmis = kirpilmis.slice(0, -1)
  }
  return kirpilmis.length > 0 ? `${tam}.${kirpilmis}` : tam
}
