import { InvalidTaxIdentifierError } from '../errors.js'

/** Türkiye'deki iki vergi kimliği türü. */
export type TaxIdentifierKind = 'VKN' | 'TCKN'

/**
 * Yalnızca ASCII rakamlarından oluşan bir dizeyi rakam dizisine çevirir.
 *
 * `\d` JavaScript'te ASCII `0-9` ile sınırlıdır; Arap-Hint rakamları (٣)
 * ya da tam genişlikli rakamlar (３) eşleşmez. Vergi numarası alanında
 * istenen tam olarak budur — görsel olarak rakam gibi duran ama farklı kod
 * noktaları taşıyan bir değer, sessizce kabul edilmemeli.
 */
const toDigits = (value: string): number[] | undefined => {
  if (!/^\d+$/.test(value)) return undefined
  const digits: number[] = []
  for (let i = 0; i < value.length; i += 1) {
    // '0' kod noktası 48; ASCII rakam olduğu yukarıda garanti edildi.
    digits.push(value.charCodeAt(i) - 48)
  }
  return digits
}

/**
 * Bir T.C. Kimlik Numarasının kontrol basamaklarını doğrular.
 *
 * TCKN 11 hanedir, sıfırla başlayamaz ve son iki hanesi ilk dokuz haneden
 * türetilen kontrol basamaklarıdır:
 *
 * - **10. hane** = ((1., 3., 5., 7., 9. hanelerin toplamı × 7) − (2., 4.,
 *   6., 8. hanelerin toplamı)) mod 10
 * - **11. hane** = (ilk on hanenin toplamı) mod 10
 *
 * **Ne yakalar, ne yakalamaz** (bu depoda ölçüldü, testlerle sabitlendi):
 *
 * - Tek hane hatasının **tamamını** yakalar.
 * - Bitişik iki hanenin yer değiştirmesinin **%89,8'ini** yakalar. Kaçan tek
 *   durum, **veri haneleri arasında** yer değiştiren iki hanenin farkının
 *   tam olarak 5 olmasıdır (0↔5, 1↔6, 2↔7, 3↔8, 4↔9). Nedeni cebirsel:
 *   transpozisyon 11. haneyi hiç değiştirmez (hane toplamı sabit kalır) ve
 *   10. haneyi `8 × (a − b)` kadar kaydırır; bu değer `a − b` beşin katıyken
 *   mod 10'da sıfırdır. İki kontrol basamağının (10.–11. hane) kendi
 *   aralarındaki takas ise her zaman yakalanır.
 *
 * Yani doğrulama bir garanti değil, çok güçlü bir elektir. Numaranın gerçek
 * bir mükellefe ait olduğunu değil, yazım hatası içermediğini söyler.
 *
 * @param value - Denetlenecek numara; boşluk ya da tire içermemeli
 * @returns Numara geçerli bir TCKN ise `true`
 *
 * @example
 * ```ts
 * isValidTckn('10000000146') // true  — kontrol basamakları tutuyor
 * isValidTckn('10000000145') // false — son hane bozuk
 * isValidTckn('00000000146') // false — sıfırla başlayamaz
 * isValidTckn('1000000014')  // false — 11 hane değil
 * ```
 */
export const isValidTckn = (value: string): boolean => {
  if (value.length !== 11) return false
  const digits = toDigits(value)
  if (digits === undefined) return false
  if (digits[0] === 0) return false

  let tekler = 0
  let ciftler = 0
  for (let i = 0; i < 9; i += 1) {
    const digit = digits[i] ?? 0
    if (i % 2 === 0) tekler += digit
    else ciftler += digit
  }

  const onuncu = (tekler * 7 - ciftler) % 10
  if ((onuncu + 10) % 10 !== digits[9]) return false

  const ilkOn = digits.slice(0, 10).reduce((toplam, digit) => toplam + digit, 0)
  return ilkOn % 10 === digits[10]
}

/**
 * Bir Vergi Kimlik Numarasının kontrol basamağını doğrular.
 *
 * VKN 10 hanedir ve son hane, ilk dokuz haneden GİB'in tanımladığı ağırlıklı
 * algoritmayla türetilir. Her hane için sırasına bağlı bir dönüşüm uygulanır,
 * elde edilen değerler toplanır ve kontrol basamağı bu toplamın onluk
 * tümleyenidir.
 *
 * Sıfırla başlayan VKN geçerlidir — TCKN'den farkı budur ve bu yüzden
 * "sayıya çevirip karşılaştırmak" bu alanda çalışmaz.
 *
 * **Ne yakalar, ne yakalamaz** (bu depoda ölçüldü): tek hane hatasının
 * tamamını, bitişik transpozisyonun **%96,1'ini** yakalar. Tek kontrol
 * basamağı olduğu için rastgele bir on haneli sayının geçerli çıkma olasılığı
 * yaklaşık %10'dur; TCKN'de bu oran %1'dir.
 *
 * @param value - Denetlenecek numara; boşluk ya da tire içermemeli
 * @returns Numara geçerli bir VKN ise `true`
 *
 * @example
 * ```ts
 * isValidVkn('0123456789')  // sıfırla başlayan VKN kabul edilir
 * isValidVkn('123456789')   // false — 10 hane değil
 * isValidVkn('12345678AB')  // false — rakam dışı karakter
 * ```
 */
export const isValidVkn = (value: string): boolean => {
  if (value.length !== 10) return false
  const digits = toDigits(value)
  if (digits === undefined) return false

  let toplam = 0
  for (let i = 0; i < 9; i += 1) {
    const araDeger = ((digits[i] ?? 0) + 9 - i) % 10
    // `araDeger === 9` özel durumu: 9 × 2^k her zaman 9'un katıdır, mod 9
    // sıfır verir ve basamağın katkısı sessizce kaybolurdu. Algoritma bu
    // durumda değeri doğrudan ekler.
    toplam += araDeger === 9 ? araDeger : (araDeger * 2 ** (9 - i)) % 9
  }

  const kontrol = toplam % 10 === 0 ? 0 : 10 - (toplam % 10)
  return kontrol === digits[9]
}

/**
 * Bir numaranın türünü uzunluğundan belirler ve kontrol basamağını doğrular.
 *
 * @param value - Denetlenecek numara
 * @returns Geçerliyse `'VKN'` ya da `'TCKN'`; değilse `undefined`
 *
 * @example
 * ```ts
 * detectTaxIdentifierKind('10000000146') // 'TCKN'
 * detectTaxIdentifierKind('1234567890')  // VKN ise 'VKN', değilse undefined
 * detectTaxIdentifierKind('123')         // undefined
 * ```
 *
 * @example UBL `schemeID` özniteliğini doğru doldurmak
 * ```ts
 * const kind = detectTaxIdentifierKind(taraf.vergiNo)
 * if (kind === undefined) throw new Error('Geçersiz vergi numarası')
 * leaf(Namespace.COMMON_BASIC, 'ID', taraf.vergiNo, [
 *   { name: 'schemeID', value: kind },
 * ])
 * ```
 */
export const detectTaxIdentifierKind = (value: string): TaxIdentifierKind | undefined => {
  if (isValidVkn(value)) return 'VKN'
  if (isValidTckn(value)) return 'TCKN'
  return undefined
}

/**
 * Bir VKN ya da TCKN'yi doğrular; geçersizse nedenini söyleyen hata fırlatır.
 *
 * Uzunluk denetimiyle yetinmez. İncelenen üç UBL-TR paketinin hiçbiri
 * kontrol basamağına bakmıyordu; ikisi de yalnızca `length === 10` ya da
 * `length === 11` denetimi yapıyordu. Bu, iki rakamı yer değiştirmiş bir
 * numaranın belgeye yazılmasına ve hatanın GİB tarafında ortaya çıkmasına
 * izin verir.
 *
 * @param value - Denetlenecek numara
 * @param location - Hata mesajında görünecek alan yolu (ör. `supplier.vkn`)
 * @returns Numaranın türü
 * @throws {InvalidTaxIdentifierError} Numara geçersizse; `reason` alanı nedeni söyler
 *
 * @example
 * ```ts
 * const kind = assertValidTaxIdentifier(girdi.vergiNo, 'supplier.vkn')
 * // kind: 'VKN' | 'TCKN'
 * ```
 *
 * @example Hatayı nedene göre ele almak
 * ```ts
 * try {
 *   assertValidTaxIdentifier(girdi.vergiNo, 'customer.vkn')
 * } catch (hata) {
 *   if (hata instanceof InvalidTaxIdentifierError && hata.reason === 'checksum') {
 *     // Biçim doğru, rakamlar yanlış — kullanıcıya "kontrol edin" demek anlamlı
 *   }
 * }
 * ```
 */
export const assertValidTaxIdentifier = (value: string, location: string): TaxIdentifierKind => {
  const kind = value.length === 11 ? 'TCKN' : value.length === 10 ? 'VKN' : undefined
  if (kind === undefined) {
    throw new InvalidTaxIdentifierError(value, location, 'length', undefined)
  }
  if (!/^\d+$/.test(value)) {
    throw new InvalidTaxIdentifierError(value, location, 'digits', kind)
  }
  if (kind === 'TCKN' && value.startsWith('0')) {
    throw new InvalidTaxIdentifierError(value, location, 'leading-zero', kind)
  }
  const gecerli = kind === 'TCKN' ? isValidTckn(value) : isValidVkn(value)
  if (!gecerli) {
    throw new InvalidTaxIdentifierError(value, location, 'checksum', kind)
  }
  return kind
}
