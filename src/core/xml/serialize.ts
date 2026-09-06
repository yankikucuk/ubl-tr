import { UndeclaredNamespaceError } from '../errors.js'

import { escapeAttribute, escapeText } from './escape.js'
import type { XmlElement } from './node.js'

/** {@link serializeDocument} seçenekleri. */
export interface SerializeOptions {
  /**
   * Ön eksiz yazılacak ad alanı — kök öğede `xmlns="…"` olarak bildirilir.
   *
   * UBL belgelerinde bu her zaman belgenin kendi ad alanıdır (ör.
   * `urn:oasis:…:Invoice-2`). Bu ad alanındaki öğeler ön eksiz, diğerleri
   * {@link SerializeOptions.prefixes} haritasındaki ön ekle yazılır.
   */
  readonly defaultNamespace?: string

  /**
   * Ön ek → ad alanı URI'si haritası. Tümü kök öğede bildirilir.
   *
   * Ağaçta geçen ve ne burada ne de `defaultNamespace` içinde bulunan bir
   * ad alanı, sessizce varsayılana düşürülmez; hata fırlatılır.
   */
  readonly prefixes?: Readonly<Record<string, string>>

  /**
   * Çıktı biçimi. Varsayılan `'compact'`.
   *
   * - `'compact'` — hiç boşluk yok. Tek satır. **İmzalanacak belgeler için
   *   bunu kullanın.**
   * - `'indented'` — kapsayıcıların altına satır sonu ve girinti eklenir.
   *   Yalnızca insan gözüyle inceleme içindir.
   *
   * ⚠️ Girinti, kapsayıcıların içine boşluk metin düğümleri sokar. XAdES
   * gibi sarmalanmış (enveloped) imzalarda bu düğümler imzanın kapsamına
   * girer: belge sonradan yeniden biçimlendirilirse imza geçersiz olur.
   * Bu yüzden varsayılan `'compact'`'tir — incelenen rakip kütüphanelerin
   * en yaygını girintiyi varsayılan yapıyor ve bu tuzağı belgelemiyor.
   */
  readonly format?: 'compact' | 'indented'

  /** `'indented'` biçiminde bir seviyenin girintisi. Varsayılan iki boşluk. */
  readonly indent?: string

  /** Başa `<?xml …?>` bildirimi eklensin mi. Varsayılan `true`. */
  readonly xmlDeclaration?: boolean
}

/** Ad alanı URI'sinden ön eke çözümleme tablosu. */
type PrefixTable = ReadonlyMap<string, string | null>

/**
 * Ad alanı → ön ek tablosunu kurar.
 *
 * Aynı URI birden fazla ön eke bağlanmışsa alfabetik olarak ilki seçilir;
 * bu, çıktının girdi nesnesinin anahtar sırasından bağımsız ve dolayısıyla
 * deterministik olmasını sağlar.
 *
 * @param options - Serileştirme seçenekleri
 * @returns URI'den ön eke harita; `null` değer "ön eksiz yaz" demektir
 */
const buildPrefixTable = (options: SerializeOptions): PrefixTable => {
  const table = new Map<string, string | null>()
  if (options.defaultNamespace === undefined) {
    // Ad alanı olmayan öğeler ön eksiz yazılır ve bildirim gerektirmez.
    // Varsayılan ad alanı BİLDİRİLMİŞSE bu mümkün değildir: ön eksiz her
    // öğe varsayılana düşer, dolayısıyla "ad alanısız" öğe o belgede
    // ifade edilemez ve `qualifiedName` hata verir.
    table.set('', null)
  } else {
    table.set(options.defaultNamespace, null)
  }
  for (const prefix of Object.keys(options.prefixes ?? {}).sort()) {
    const uri = options.prefixes?.[prefix]
    if (uri !== undefined && !table.has(uri)) table.set(uri, prefix)
  }
  return table
}

/**
 * Bir öğenin nitelikli adını (`cbc:ID` ya da `Invoice`) üretir.
 *
 * @param element - Adı üretilecek öğe
 * @param table - Ad alanı çözümleme tablosu
 * @returns Ön ekli ya da ön eksiz nitelikli ad
 * @throws {UndeclaredNamespaceError} Öğenin ad alanı bildirilmemişse. Ad
 * alanısız (`''`) bir öğe yalnızca `defaultNamespace` verilmediğinde
 * yazılabilir; verildiğinde ön eksiz yazılan her öğe varsayılana düşeceği
 * için ad alanısız öğe o belgede ifade edilemez.
 */
const qualifiedName = (element: XmlElement, table: PrefixTable): string => {
  if (!table.has(element.namespace)) {
    throw new UndeclaredNamespaceError(element.namespace, element.name)
  }
  const prefix = table.get(element.namespace)
  return prefix === null || prefix === undefined ? element.name : `${prefix}:${element.name}`
}

/**
 * Bir öğenin öznitelik dizesini üretir (baştaki boşluk dâhil).
 *
 * @param element - Öznitelikleri yazılacak öğe
 * @param table - Ad alanı çözümleme tablosu; ön ekli öznitelikler için
 * @returns `' currencyID="TRY"'` biçiminde dize; öznitelik yoksa boş dize
 * @throws {UndeclaredNamespaceError} Ön ekli bir özniteliğin ad alanı bildirilmemişse
 */
const serializeAttributes = (element: XmlElement, table: PrefixTable): string =>
  element.attributes
    .map((attribute) => {
      if (attribute.namespace === undefined) {
        return ` ${attribute.name}="${escapeAttribute(attribute.value)}"`
      }
      if (!table.has(attribute.namespace)) {
        throw new UndeclaredNamespaceError(attribute.namespace, attribute.name)
      }
      const prefix = table.get(attribute.namespace)
      // Ön eksiz bir öznitelik ad alanı YOKTUR (Namespaces in XML 1.0 §6.2):
      // varsayılan ad alanı bildirimi özniteliklere uygulanmaz. Bu yüzden
      // ad alanlı bir öznitelik her zaman ön ekli yazılır.
      const qname =
        prefix === null || prefix === undefined ? attribute.name : `${prefix}:${attribute.name}`
      return ` ${qname}="${escapeAttribute(attribute.value)}"`
    })
    .join('')

/**
 * Kök öğede yazılacak ad alanı bildirimlerini üretir.
 *
 * Sıra sabittir — önce `xmlns`, sonra ön ekler alfabetik — böylece aynı
 * girdi her zaman aynı baytları verir.
 *
 * @param options - Serileştirme seçenekleri
 * @returns `' xmlns="…" xmlns:cac="…"'` biçiminde dize
 */
const serializeNamespaceDeclarations = (options: SerializeOptions): string => {
  const parts: string[] = []
  if (options.defaultNamespace !== undefined) {
    parts.push(` xmlns="${escapeAttribute(options.defaultNamespace)}"`)
  }
  for (const prefix of Object.keys(options.prefixes ?? {}).sort()) {
    const uri = options.prefixes?.[prefix]
    if (uri !== undefined) parts.push(` xmlns:${prefix}="${escapeAttribute(uri)}"`)
  }
  return parts.join('')
}

/**
 * Bir öğeyi ve altındaki her şeyi özyinelemeli olarak yazar.
 *
 * @param element - Yazılacak öğe
 * @param table - Ad alanı çözümleme tablosu
 * @param extraRootAttributes - Yalnızca kökte eklenecek dize (ad alanı bildirimleri)
 * @param indent - Girinti dizesi; boşsa girintisiz yazılır
 * @param depth - Bulunulan derinlik; girinti tekrarı için
 * @returns Öğenin XML gösterimi
 */
const serializeElement = (
  element: XmlElement,
  table: PrefixTable,
  extraRootAttributes: string,
  indent: string,
  depth: number,
): string => {
  const qname = qualifiedName(element, table)
  const open = `<${qname}${extraRootAttributes}${serializeAttributes(element, table)}>`
  const close = `</${qname}>`

  // Kanonik XML (C14N 1.0 §2.3) boş öğeleri de açılış/kapanış çifti olarak
  // yazar, `<a/>` biçimini hiç kullanmaz. İmzalanacak belgede kanonik
  // biçime baştan uymak, imzalayıcının belgeyi yeniden yazma ihtiyacını
  // ortadan kaldırır.
  if (element.kind === 'leaf') return `${open}${escapeText(element.text)}${close}`
  if (element.children.length === 0) return `${open}${close}`

  if (indent === '') {
    const inner = element.children
      .map((child) => serializeElement(child, table, '', '', depth + 1))
      .join('')
    return `${open}${inner}${close}`
  }

  const childIndent = indent.repeat(depth + 1)
  const inner = element.children
    .map((child) => `\n${childIndent}${serializeElement(child, table, '', indent, depth + 1)}`)
    .join('')
  return `${open}${inner}\n${indent.repeat(depth)}${close}`
}

/**
 * Bir öğe ağacını XML belgesine çevirir.
 *
 * Çıktı **deterministiktir**: aynı ağaç ve aynı seçenekler her zaman bayt
 * bayt aynı dizeyi verir. Bu, altın dosya testlerini mümkün kılar ve
 * imzalamanın ön koşuludur.
 *
 * Serileştirici üç şeyi yapısal olarak garanti eder:
 *
 * 1. **Her öğe doğru ad alanında yazılır.** Ön ek bildirimi kök öğededir ve
 *    bildirilmemiş bir ad alanı hata verir. İncelenen rakiplerden birinde
 *    `cbc`/`cac` ön ekleri kökte bildiriliyor ama hiç kullanılmıyordu:
 *    öğeler ön eksiz yazıldığı için hepsi varsayılan ad alanına düşüyor ve
 *    belge XSD doğrulamasından geçemiyordu.
 * 2. **Kaçırma unutulamaz.** Metin ve öznitelik değerleri ham verilir,
 *    kaçırmayı serileştirici yapar.
 * 3. **Varsayılan çıktı imzalanmaya elverişlidir.** Girinti açıkça
 *    istenmedikçe hiç boşluk üretilmez.
 *
 * @param root - Belgenin kök öğesi
 * @param options - Ad alanı bildirimleri ve biçim seçenekleri
 * @returns Tam XML belgesi
 * @throws {UndeclaredNamespaceError} Ağaçta bildirilmemiş bir ad alanı varsa
 *
 * @example Küçük bir belge
 * ```ts
 * const INVOICE_NS = documentNamespace(DocumentType.INVOICE)
 *
 * const belge = container(INVOICE_NS, 'Invoice', [
 *   leaf(Namespace.COMMON_BASIC, 'UBLVersionID', '2.1'),
 *   leaf(Namespace.COMMON_BASIC, 'CustomizationID', 'TR1.2'),
 * ])
 *
 * serializeDocument(belge, {
 *   defaultNamespace: INVOICE_NS,
 *   prefixes: { cbc: Namespace.COMMON_BASIC },
 * })
 * // <?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:…:Invoice-2"
 * //   xmlns:cbc="urn:…:CommonBasicComponents-2"><cbc:UBLVersionID>2.1</cbc:UBLVersionID>
 * //   <cbc:CustomizationID>TR1.2</cbc:CustomizationID></Invoice>
 * // (tek satır — yukarıdaki satır sonları yalnızca okunabilirlik içindir)
 * ```
 *
 * @example İnceleme için girintili çıktı
 * ```ts
 * serializeDocument(belge, {
 *   defaultNamespace: INVOICE_NS,
 *   prefixes: { cbc: Namespace.COMMON_BASIC },
 *   format: 'indented',
 * })
 * // Okunabilir, ama imzalanacak belgede KULLANMAYIN.
 * ```
 *
 * @example Determinizmi doğrulamak
 * ```ts
 * const a = serializeDocument(belge, secenekler)
 * const b = serializeDocument(belge, secenekler)
 * a === b // her zaman true
 * ```
 */
export const serializeDocument = (root: XmlElement, options: SerializeOptions = {}): string => {
  const table = buildPrefixTable(options)
  const indent = options.format === 'indented' ? (options.indent ?? '  ') : ''
  const body = serializeElement(root, table, serializeNamespaceDeclarations(options), indent, 0)
  return options.xmlDeclaration === false ? body : `<?xml version="1.0" encoding="UTF-8"?>${body}`
}
