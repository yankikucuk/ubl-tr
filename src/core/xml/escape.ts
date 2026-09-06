import { InvalidXmlNameError, InvalidXmlCharacterError } from '../errors.js'

/**
 * Bir kod noktasının XML 1.0'ın char kümesi dışında olup olmadığını
 * söyler.
 *
 * XML 1.0 §2.2 `Char` üretimi şunlara izin verir:
 * `#x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]`.
 *
 * Dışarıda kalanlar — kontrol charlerinin neredeyse tamamı, tek başına
 * kalmış vekil (surrogate) kod noktaları ve U+FFFE/U+FFFF — **hiçbir
 * biçimde** yazılamaz. Sayısal char başvurusu (`&#1;`) da geçersizdir;
 * spesifikasyon bu charlerin belgede var olmasını yasaklar, gösterimini
 * değil.
 *
 * @param codePoint - Denetlenecek Unicode kod noktası
 * @returns Karakter XML 1.0 dışındaysa `true`
 *
 * @example
 * ```ts
 * isForbiddenXmlCharacter(0x41) // false — "A"
 * isForbiddenXmlCharacter(0x09) // false — sekme izinli
 * isForbiddenXmlCharacter(0x01) // true  — kontrol chari
 * isForbiddenXmlCharacter(0xd800) // true — tek başına vekil
 * ```
 */
export const isForbiddenXmlCharacter = (codePoint: number): boolean => {
  if (codePoint < 0x20) {
    return codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d
  }
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return true
  return codePoint === 0xfffe || codePoint === 0xffff
}

/**
 * Bir değerin tamamının XML 1.0'a yazılabilir olduğunu doğrular; değilse
 * hata fırlatır.
 *
 * Bu denetim **sessizce düzeltmez**. Rakip kütüphanelerin ortak davranışı,
 * kontrol charini olduğu gibi çıktıya geçirmek: sonuç, yerelde
 * ayrıştırılabilen ama karşı tarafın katı doğrulayıcısında reddedilen bir
 * belge oluyor — yani hatanın ortaya çıktığı yer kod değil, vergi dairesi.
 * Burada hata en erken noktada, değerin geldiği yerde fırlatılır.
 *
 * Değeri nasıl temizleyeceğine yalnızca çağıran karar verebilir: chari
 * silmek, boşlukla değiştirmek ya da kaydı tümden reddetmek — üçü de farklı
 * iş kararlarıdır.
 *
 * @param value - Denetlenecek metin
 * @param location - Hata mesajında görünecek öğe ya da öznitelik adı
 * @throws {InvalidXmlCharacterError} Değer XML dışı bir char içeriyorsa
 *
 * @example
 * ```ts
 * assertValidXmlText('Acme Ltd. Şti.', 'cbc:Name') // sorunsuz döner
 *
 * assertValidXmlText(`Acme${String.fromCharCode(1)} Ltd.`, 'cbc:Name')
 * // → InvalidXmlCharacterError { location: 'cbc:Name', offset: 4, codePoint: 1 }
 * ```
 */
export const assertValidXmlText = (value: string, location: string): void => {
  let offset = 0
  for (const char of value) {
    const codePoint = char.codePointAt(0)
    // `for...of` her zaman en az bir kod noktası verir; bu dal yalnızca
    // tip daraltması için var.
    if (codePoint !== undefined && isForbiddenXmlCharacter(codePoint)) {
      throw new InvalidXmlCharacterError(location, offset, codePoint)
    }
    offset += char.length
  }
}

/**
 * XML `NCName` üretimi (Namespaces in XML 1.0 §3) — iki nokta üst üste
 * içermeyen ad.
 *
 * Ön ek ve yerel ad ayrı ayrı doğrulandığı için burada `:` kabul edilmez;
 * nitelikli ad (`cbc:ID`) bu iki parçadan birleştirilir.
 */
const NCNAME = new RegExp(
  '^[A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D' +
    '\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF' +
    '\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD]' +
    '[-.0-9A-Z_a-z\\u00B7\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u037D' +
    '\\u037F-\\u1FFF\\u200C-\\u200D\\u203F-\\u2040\\u2070-\\u218F' +
    '\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD]*$',
  'u',
)

/**
 * Bir öğe ya da öznitelik adının geçerli bir `NCName` olduğunu doğrular.
 *
 * @param name - Denetlenecek ad
 * @throws {InvalidXmlNameError} Ad `NCName` kurallarına uymuyorsa
 *
 * @example
 * ```ts
 * assertValidXmlName('UBLVersionID')  // sorunsuz
 * assertValidXmlName('Invoice Line')  // → InvalidXmlNameError (boşluk)
 * assertValidXmlName('cbc:ID')        // → InvalidXmlNameError (ön ek ayrı verilir)
 * assertValidXmlName('2ID')           // → InvalidXmlNameError (rakamla başlıyor)
 * ```
 */
export const assertValidXmlName = (name: string): void => {
  if (!NCNAME.test(name)) throw new InvalidXmlNameError(name)
}

/**
 * Bir metin düğümünü Kanonik XML (C14N 1.0 §2.3) kurallarına göre kaçırır.
 *
 * Kaçırılanlar: `&`, `<`, `>` ve satır başı (CR).
 *
 * **Neden C14N ve neden `>` de kaçırılıyor:** bu belgeler XAdES ile
 * imzalanır ve imza, belgenin kanonik biçimi üzerinden hesaplanır. Çıktıyı
 * baştan kanonik kaçış kurallarıyla üretmek, imzalayıcının belgeyi yeniden
 * yazmak zorunda kalmamasını sağlar — yeniden yazma, imza ile belgenin
 * ayrışabildiği tek noktadır.
 *
 * **Neden CR sayısal başvuruyla yazılır:** XML ayrıştırıcıları satır sonu
 * normalizasyonu yapar ve ham `\r` charini `\n`'e çevirir (XML 1.0
 * §2.11). Sayısal başvuru olarak yazılmazsa gidiş-dönüşte sessizce kaybolur.
 *
 * `'` ve `"` metin düğümünde kaçırılmaz; kaçırılmalarına gerek yoktur ve
 * kanonik biçim de kaçırmaz.
 *
 * @param value - Kaçırılacak ham metin
 * @returns XML metin düğümüne doğrudan yazılabilir hâli
 *
 * @example
 * ```ts
 * escapeText('A & B <Ltd>')  // 'A &amp; B &lt;Ltd&gt;'
 * escapeText('satır1\r\n')   // 'satır1&#xD;\n'
 * escapeText("O'Reilly")     // "O'Reilly" — tırnak kaçırılmaz
 * ```
 */
export const escapeText = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#xD;')

/**
 * Bir öznitelik değerini Kanonik XML (C14N 1.0 §2.3) kurallarına göre
 * kaçırır.
 *
 * Kaçırılanlar: `&`, `<`, `"` ve boşluk charleri sekme, satır sonu,
 * satır başı.
 *
 * **Neden sekme ve satır sonu sayısal başvuruyla yazılır:** XML
 * ayrıştırıcıları öznitelik değerlerinde *öznitelik değeri normalizasyonu*
 * uygular (XML 1.0 §3.3.3) ve ham sekme/satır sonu charlerini tek bir
 * boşluğa çevirir. Sayısal başvuru olarak yazılmazlarsa değer gidiş-dönüşte
 * sessizce değişir — bu, incelenen rakip kütüphanelerin ikisinde de
 * doğrulanan bir veri kaybı.
 *
 * `>` ve `'` öznitelik değerinde kaçırılmaz; değer çift tırnak içine
 * alındığı için ikisi de belirsizlik yaratmaz ve kanonik biçim de kaçırmaz.
 *
 * @param value - Kaçırılacak ham öznitelik değeri
 * @returns Çift tırnak içine yazılabilir hâli
 *
 * @example
 * ```ts
 * escapeAttribute('TRY')            // 'TRY'
 * escapeAttribute('A & B')          // 'A &amp; B'
 * escapeAttribute('20" ekran')      // '20&quot; ekran'
 * escapeAttribute('satır1\nsatır2') // 'satır1&#xA;satır2'
 * ```
 */
export const escapeAttribute = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\t', '&#x9;')
    .replaceAll('\n', '&#xA;')
    .replaceAll('\r', '&#xD;')
