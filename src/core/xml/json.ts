import { container, leaf, type XmlAttribute, type XmlElement } from './node.js'
import { parseDocument, type ParseOptions } from './parse.js'
import { serializeDocument, type SerializeOptions } from './serialize.js'

/**
 * Bir öğenin JSON karşılığı — {@link XmlElement} ile birebir eşleşir.
 *
 * Şekil bilerek sadıktır: ad alanı korunur, alt öğeler her zaman dizidir,
 * hiçbir değer türü tahmin edilmez. Bu üç seçim, yaygın XML→JSON
 * dönüştürücülerinin üç bilinen tuzağını ortadan kaldırır:
 *
 * - **Ad alanı silme.** `removeNSPrefix` kullanan dönüştürücülerde `cbc:ID`
 *   ile `cac:ID` aynı anahtara düşer ve ayırt edilemez.
 * - **Değişken çokluk.** Alt öğeleri ada göre nesneye toplayan
 *   dönüştürücülerde tek `InvoiceLine` bir nesne, iki tanesi dizi olur;
 *   tüketici kodu satır sayısına göre patlar. Sabit "hangi etiketler her
 *   zaman dizidir" listeleriyle yamanmaya çalışılır ve liste hiç tamamlanmaz.
 * - **Tür tahmini.** `1234567890` VKN'si sayıya, `0123456789` VKN'si dizeye
 *   dönüşür; aynı alanın tipi değere göre değişir.
 */
export interface XmlJsonBase {
  /** Ön eksiz yerel ad. */
  readonly name: string
  /** Öğenin ad alanı URI'si. */
  readonly ns: string
  /**
   * Öznitelikler. Anahtar sırası korunur.
   *
   * Ad alanlı öznitelikler James Clark gösterimiyle anahtarlanır:
   * `{ad-alanı-uri}yerelAd`. Pratikte tek örnek kök öğedeki
   * `{http://www.w3.org/2001/XMLSchema-instance}schemaLocation`'dır.
   */
  readonly attrs?: Readonly<Record<string, string>>
}

/** Metin içerikli yaprak öğenin JSON karşılığı. */
export interface XmlJsonLeaf extends XmlJsonBase {
  /** Kaçırılmamış metin içeriği. Her zaman `string`; asla sayıya çevrilmez. */
  readonly text: string
}

/** Alt öğe taşıyan kapsayıcının JSON karşılığı. */
export interface XmlJsonContainer extends XmlJsonBase {
  /** Alt öğeler. Tek alt öğe olsa bile **her zaman dizi**. */
  readonly children: readonly XmlJson[]
}

/** Bir XML öğesinin JSON karşılığı. */
export type XmlJson = XmlJsonLeaf | XmlJsonContainer

/** Bir XML belgesinin tam JSON karşılığı; kayıpsız geri çevrilebilir. */
export interface XmlDocumentJson {
  /** Varsayılan ad alanı (`xmlns="…"`). */
  readonly defaultNamespace?: string
  /** Ön ek → ad alanı eşlemesi. */
  readonly prefixes: Readonly<Record<string, string>>
  /** Kök öğe. */
  readonly root: XmlJson
}

/** Öznitelik dizisini James Clark anahtarlı nesneye çevirir. */
const attributesToJson = (
  attributes: readonly XmlAttribute[],
): Readonly<Record<string, string>> | undefined => {
  if (attributes.length === 0) return undefined
  const sonuc: Record<string, string> = {}
  for (const attribute of attributes) {
    const key =
      attribute.namespace === undefined
        ? attribute.name
        : `{${attribute.namespace}}${attribute.name}`
    sonuc[key] = attribute.value
  }
  return sonuc
}

/** James Clark anahtarlı nesneyi öznitelik dizisine çevirir. */
const attributesFromJson = (
  attrs: Readonly<Record<string, string>> | undefined,
): XmlAttribute[] => {
  if (attrs === undefined) return []
  return Object.entries(attrs).map(([key, value]) => {
    if (!key.startsWith('{')) return { name: key, value }
    const kapanis = key.indexOf('}')
    if (kapanis === -1) return { name: key, value }
    return { name: key.slice(kapanis + 1), value, namespace: key.slice(1, kapanis) }
  })
}

/**
 * Bir öğe ağacını JSON'a çevirir.
 *
 * @param element - Çevrilecek öğe
 * @returns Öğenin JSON karşılığı
 *
 * @example
 * ```ts
 * toJson(leaf(Namespace.COMMON_BASIC, 'PayableAmount', '1200.00', [
 *   { name: 'currencyID', value: 'TRY' },
 * ]))
 * // {
 * //   name: 'PayableAmount',
 * //   ns: 'urn:oasis:…:CommonBasicComponents-2',
 * //   attrs: { currencyID: 'TRY' },
 * //   text: '1200.00',
 * // }
 * ```
 */
export const toJson = (element: XmlElement): XmlJson => {
  const attrs = attributesToJson(element.attributes)
  const temel = { name: element.name, ns: element.namespace }
  if (element.kind === 'leaf') {
    return attrs === undefined
      ? { ...temel, text: element.text }
      : { ...temel, attrs, text: element.text }
  }
  const children = element.children.map(toJson)
  return attrs === undefined ? { ...temel, children } : { ...temel, attrs, children }
}

/**
 * JSON'dan öğe ağacı kurar.
 *
 * Ad ve metin doğrulaması {@link leaf} ve {@link container} tarafından
 * yapılır: JSON'dan gelen bozuk bir değer sessizce belgeye sızmaz.
 *
 * @param json - Öğenin JSON karşılığı
 * @returns Kurulan öğe
 * @throws {InvalidXmlNameError} Ad geçersizse
 * @throws {InvalidXmlCharacterError} Metin XML dışı karakter içeriyorsa
 *
 * @example
 * ```ts
 * fromJson({
 *   name: 'UBLVersionID',
 *   ns: 'urn:oasis:…:CommonBasicComponents-2',
 *   text: '2.1',
 * })
 * ```
 */
export const fromJson = (json: XmlJson): XmlElement => {
  const attributes = attributesFromJson(json.attrs)
  if ('text' in json) return leaf(json.ns, json.name, json.text, attributes)
  return container(json.ns, json.name, json.children.map(fromJson), attributes)
}

/**
 * Bir UBL-TR XML belgesini JSON'a çevirir.
 *
 * @param xml - Kaynak XML belgesi
 * @param options - Ayrıştırma sınırları
 * @returns Belgenin kayıpsız JSON karşılığı
 * @throws {XmlSyntaxError} Belge iyi-biçimli değilse
 * @throws {DoctypeNotAllowedError} Belgede DOCTYPE bildirimi varsa
 *
 * @example
 * ```ts
 * const belge = xmlToJson(faturaXml)
 * belge.root.name // 'Invoice'
 * JSON.stringify(belge, null, 2) // diske yazılabilir, sonra geri okunabilir
 * ```
 *
 * @example Gelen belgeye sınır koymak
 * ```ts
 * xmlToJson(partnerdenGelenXml, { maxSize: 2 * 1024 * 1024, maxDepth: 40 })
 * ```
 */
export const xmlToJson = (xml: string, options?: ParseOptions): XmlDocumentJson => {
  const parsed = parseDocument(xml, options)
  const temel = { prefixes: parsed.prefixes, root: toJson(parsed.root) }
  return parsed.defaultNamespace === undefined
    ? temel
    : { defaultNamespace: parsed.defaultNamespace, ...temel }
}

/**
 * JSON'dan UBL-TR XML belgesi üretir.
 *
 * Çıktı varsayılan olarak sıkışıktır (boşluksuz) ve deterministiktir; aynı
 * JSON her zaman bayt bayt aynı XML'i verir.
 *
 * @param document - Belgenin JSON karşılığı
 * @param options - Biçim seçenekleri; ad alanı bildirimleri `document`'tan gelir
 * @returns XML belgesi
 * @throws {UndeclaredNamespaceError} Ağaçta bildirilmemiş bir ad alanı varsa
 *
 * @example Gidiş-dönüş
 * ```ts
 * const belge = xmlToJson(xml)
 * jsonToXml(belge) === xml // sıkışık yazılmış bir belgede her zaman true
 * ```
 *
 * @example İnsan için okunabilir çıktı
 * ```ts
 * jsonToXml(belge, { format: 'indented' })
 * // İmzalanacak belgede KULLANMAYIN — boşluk metin düğümleri imzaya girer.
 * ```
 */
export const jsonToXml = (
  document: XmlDocumentJson,
  options: Omit<SerializeOptions, 'defaultNamespace' | 'prefixes'> = {},
): string => {
  const secenekler: SerializeOptions =
    document.defaultNamespace === undefined
      ? { ...options, prefixes: document.prefixes }
      : { ...options, defaultNamespace: document.defaultNamespace, prefixes: document.prefixes }
  return serializeDocument(fromJson(document.root), secenekler)
}
