import { assertValidXmlName, assertValidXmlText } from './escape.js'

/**
 * Bir XML özniteliği.
 *
 * Öznitelikler bu kütüphanede **ad alanısızdır**. UBL-TR'de kullanılan tüm
 * öznitelikler (`currencyID`, `unitCode`, `schemeID`, `listID`, …) ön eksiz
 * yazılır; ad alanlı öznitelik yalnızca `xsi:schemaLocation` gibi altyapı
 * alanlarında geçer ve onlar serileştirici tarafından ayrıca üretilir.
 */
export interface XmlAttribute {
  /** Öznitelik adı — ön eksiz yerel ad, `NCName` olmalı. */
  readonly name: string
  /** Kaçırılmamış ham değer. Serileştirici kaçırmayı kendi yapar. */
  readonly value: string
  /**
   * Öznitelik ad alanı URI'si.
   *
   * UBL-TR'de kullanılan öznitelikler (`currencyID`, `unitCode`, `schemeID`,
   * `listID`, …) ad alanısızdır ve bu alan `undefined` kalır. Yalnızca
   * altyapı öznitelikleri ön ekli gelir; pratikte tek örnek kök öğedeki
   * `xsi:schemaLocation`'dır. Gerçek belgeleri kayıpsız okuyabilmek için
   * bu durumun modellenmesi şart: ön eki atmak, gidiş-dönüşte özniteliğin
   * anlamını değiştirir.
   */
  readonly namespace?: string
}

/**
 * Metin içeriği taşıyan yaprak öğe.
 *
 * @see {@link leaf} — bunu oluşturmanın tek yolu
 */
export interface XmlLeaf {
  readonly kind: 'leaf'
  /** Öğenin ait olduğu ad alanı URI'si. */
  readonly namespace: string
  /** Ön eksiz yerel ad (ör. `UBLVersionID`). */
  readonly name: string
  readonly attributes: readonly XmlAttribute[]
  /** Kaçırılmamış ham metin. */
  readonly text: string
}

/**
 * Yalnızca alt öğe taşıyan kapsayıcı öğe.
 *
 * @see {@link container} — bunu oluşturmanın tek yolu
 */
export interface XmlContainer {
  readonly kind: 'container'
  /** Öğenin ait olduğu ad alanı URI'si. */
  readonly namespace: string
  /** Ön eksiz yerel ad (ör. `AccountingSupplierParty`). */
  readonly name: string
  readonly attributes: readonly XmlAttribute[]
  readonly children: readonly XmlElement[]
}

/**
 * Bir XML öğesi: ya metin taşır ya alt öğe taşır — **asla ikisi birden**.
 *
 * Bu ayrım bilinçlidir. XML "karışık içeriğe" (mixed content: aynı öğenin
 * içinde hem metin hem alt öğe) izin verir, ama UBL-TR'de karışık içerik
 * hiç kullanılmaz. Tip düzeyinde yasaklamak iki şey kazandırır:
 *
 * 1. Bir kapsayıcının içine yanlışlıkla metin sızması derleme hatası olur.
 * 2. Girintili yazdırma sırasında hangi öğelerin boşluk eklemenin anlamı
 *    değiştirmeyeceği kesin olarak bilinir — kapsayıcılar.
 */
export type XmlElement = XmlLeaf | XmlContainer

/**
 * Öznitelikleri doğrular ve dondurulmuş bir kopyasını döndürür.
 *
 * @param attributes - Ham öznitelik listesi
 * @param elementName - Hata mesajlarında görünecek öğe adı
 * @returns Doğrulanmış, değiştirilemez öznitelik listesi
 */
const normalizeAttributes = (
  attributes: readonly XmlAttribute[],
  elementName: string,
): readonly XmlAttribute[] => {
  const seen = new Set<string>()
  for (const attribute of attributes) {
    assertValidXmlName(attribute.name)
    assertValidXmlText(attribute.value, `${elementName}/@${attribute.name}`)
    // Benzersizlik ad alanıyla birlikte değerlendirilir: `schemeID` ile
    // `xsi:schemaLocation` çakışmaz, ama aynı ad alanındaki iki `schemeID`
    // çakışır (XML 1.0 §3.1 — Unique Att Spec).
    const key = `${attribute.namespace ?? ''}#${attribute.name}`
    if (seen.has(key)) {
      throw new Error(`"${elementName}" öğesinde "${attribute.name}" özniteliği iki kez verilmiş.`)
    }
    seen.add(key)
  }
  return Object.freeze([...attributes])
}

/**
 * Metin içerikli bir yaprak öğe oluşturur.
 *
 * Ad, metin ve tüm öznitelik değerleri **oluşturma anında** doğrulanır.
 * Böylece geçersiz bir değer, belge serileştirilirken değil, o değerin
 * koda girdiği satırda hata verir — yığın izi doğrudan kaynağı gösterir.
 *
 * Metin kaçırma işini çağıran yapmaz; serileştirici yapar. Bu, kaçırmayı
 * unutmanın mümkün olmadığı anlamına gelir. İncelenen rakip kütüphanelerde
 * kaçırma çağıranın sorumluluğundaydı ve tek bir unutulmuş çağrı, bozuk
 * ya da enjekte edilebilir XML üretiyordu.
 *
 * @param namespace - Öğenin ad alanı URI'si (ör. `Namespace.COMMON_BASIC`)
 * @param name - Ön eksiz yerel ad (ör. `UBLVersionID`)
 * @param text - Ham metin; kaçırılmamış hâliyle verilir
 * @param attributes - Ön eksiz öznitelikler; varsayılan olarak boş
 * @returns Değiştirilemez yaprak öğe
 * @throws {InvalidXmlNameError} Ad ya da bir öznitelik adı geçersizse
 * @throws {InvalidXmlCharacterError} Metin ya da bir değer XML dışı karakter içeriyorsa
 *
 * @example Basit alan
 * ```ts
 * leaf(Namespace.COMMON_BASIC, 'UBLVersionID', '2.1')
 * // → <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
 * ```
 *
 * @example Öznitelikli parasal alan
 * ```ts
 * leaf(Namespace.COMMON_BASIC, 'PayableAmount', '1200.00', [
 *   { name: 'currencyID', value: 'TRY' },
 * ])
 * // → <cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount>
 * ```
 *
 * @example Kaçırma otomatiktir
 * ```ts
 * leaf(Namespace.COMMON_BASIC, 'Name', 'A & B <Ltd>')
 * // → <cbc:Name>A &amp; B &lt;Ltd&gt;</cbc:Name>
 * ```
 */
export const leaf = (
  namespace: string,
  name: string,
  text: string,
  attributes: readonly XmlAttribute[] = [],
): XmlLeaf => {
  assertValidXmlName(name)
  assertValidXmlText(text, name)
  return Object.freeze({
    kind: 'leaf' as const,
    namespace,
    name,
    attributes: normalizeAttributes(attributes, name),
    text,
  })
}

/**
 * Alt öğe taşıyan bir kapsayıcı öğe oluşturur.
 *
 * Kapsayıcılar metin taşıyamaz; tip sistemi buna izin vermez.
 *
 * @param namespace - Öğenin ad alanı URI'si (ör. `Namespace.COMMON_AGGREGATE`)
 * @param name - Ön eksiz yerel ad (ör. `AccountingSupplierParty`)
 * @param children - Alt öğeler; `undefined` girdiler ayıklanır
 * @param attributes - Ön eksiz öznitelikler; varsayılan olarak boş
 * @returns Değiştirilemez kapsayıcı öğe
 * @throws {InvalidXmlNameError} Ad ya da bir öznitelik adı geçersizse
 *
 * @example İç içe yapı
 * ```ts
 * container(Namespace.COMMON_AGGREGATE, 'Party', [
 *   container(Namespace.COMMON_AGGREGATE, 'PartyName', [
 *     leaf(Namespace.COMMON_BASIC, 'Name', 'Acme Ltd. Şti.'),
 *   ]),
 * ])
 * ```
 *
 * @example İsteğe bağlı alanları koşullu ekleme
 * ```ts
 * // `undefined` girdiler sessizce atılır; koşullu alanlar için
 * // `...(kosul ? [oge] : [])` yazmaya gerek kalmaz.
 * container(Namespace.COMMON_AGGREGATE, 'PostalAddress', [
 *   leaf(Namespace.COMMON_BASIC, 'CityName', 'İstanbul'),
 *   postaKodu ? leaf(Namespace.COMMON_BASIC, 'PostalZone', postaKodu) : undefined,
 * ])
 * ```
 */
export const container = (
  namespace: string,
  name: string,
  children: readonly (XmlElement | undefined)[],
  attributes: readonly XmlAttribute[] = [],
): XmlContainer => {
  assertValidXmlName(name)
  return Object.freeze({
    kind: 'container' as const,
    namespace,
    name,
    attributes: normalizeAttributes(attributes, name),
    children: Object.freeze(children.filter((child): child is XmlElement => child !== undefined)),
  })
}

/**
 * Değer varsa yaprak öğe üretir, yoksa `undefined` döndürür.
 *
 * UBL-TR'de isteğe bağlı alanların çoğu "varsa yaz, yoksa hiç yazma"
 * kuralına tabidir. Boş bir `<cbc:PostalZone></cbc:PostalZone>` yazmak,
 * alanı hiç yazmamakla aynı şey **değildir**: şema bazı alanlarda boş
 * içeriği reddeder, bazılarında ise boş değer "bilinmiyor" değil "boş"
 * anlamına gelir.
 *
 * İncelenen rakiplerden birinde bu ayrım yapılmıyordu ve tek bir küçük
 * fatura on adet boş öğeyle üretiliyordu.
 *
 * @param namespace - Öğenin ad alanı URI'si
 * @param name - Ön eksiz yerel ad
 * @param text - Değer; `undefined`, `null` ya da yalnızca boşluksa öğe üretilmez
 * @param attributes - Ön eksiz öznitelikler
 * @returns Yaprak öğe ya da `undefined`
 *
 * @example
 * ```ts
 * container(Namespace.COMMON_AGGREGATE, 'PostalAddress', [
 *   leaf(Namespace.COMMON_BASIC, 'CityName', 'İstanbul'),
 *   optionalLeaf(Namespace.COMMON_BASIC, 'PostalZone', adres.postaKodu),
 *   optionalLeaf(Namespace.COMMON_BASIC, 'Region', adres.bolge),
 * ])
 * // Posta kodu ve bölge yoksa yalnızca CityName yazılır — boş öğe kalmaz.
 * ```
 */
export const optionalLeaf = (
  namespace: string,
  name: string,
  text: string | undefined | null,
  attributes: readonly XmlAttribute[] = [],
): XmlLeaf | undefined => {
  if (text === undefined || text === null || text.trim() === '') return undefined
  return leaf(namespace, name, text, attributes)
}

/**
 * En az bir alt öğe kalırsa kapsayıcı üretir, aksi hâlde `undefined`
 * döndürür.
 *
 * İsteğe bağlı bir kapsayıcının (ör. `cac:Contact`) içindeki alanların
 * hepsi boşsa, kapsayıcının kendisi de yazılmamalıdır. Bunu elle yapmak
 * her seferinde bir koşul yazmayı gerektirir ve bir kez unutulduğunda boş
 * kapsayıcı belgeye sızar.
 *
 * @param namespace - Öğenin ad alanı URI'si
 * @param name - Ön eksiz yerel ad
 * @param children - Alt öğeler; `undefined` girdiler ayıklanır
 * @param attributes - Ön eksiz öznitelikler
 * @returns Kapsayıcı öğe ya da `undefined`
 *
 * @example
 * ```ts
 * // İletişim bilgisi tamamen boşsa cac:Contact hiç yazılmaz.
 * optionalContainer(Namespace.COMMON_AGGREGATE, 'Contact', [
 *   optionalLeaf(Namespace.COMMON_BASIC, 'Telephone', taraf.telefon),
 *   optionalLeaf(Namespace.COMMON_BASIC, 'ElectronicMail', taraf.eposta),
 * ])
 * ```
 */
export const optionalContainer = (
  namespace: string,
  name: string,
  children: readonly (XmlElement | undefined)[],
  attributes: readonly XmlAttribute[] = [],
): XmlContainer | undefined => {
  const kept = children.filter((child): child is XmlElement => child !== undefined)

  if (kept.length === 0) return undefined
  return container(namespace, name, kept, attributes)
}
