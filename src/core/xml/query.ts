import { Namespace } from '../../constants/index.js'

import type { XmlElement } from './node.js'

/**
 * Bir öğenin doğrudan alt öğelerinden ada göre eşleşenleri döndürür.
 *
 * @param element - İçinde aranacak öğe
 * @param namespace - Aranan ad alanı URI'si
 * @param name - Aranan yerel ad
 * @returns Eşleşen alt öğeler; sıraları korunur
 *
 * @example
 * ```ts
 * children(invoice, Namespace.COMMON_AGGREGATE, 'InvoiceLine') // tüm satırlar
 * ```
 */
export const children = (
  element: XmlElement,
  namespace: string,
  name: string,
): readonly XmlElement[] =>
  element.kind === 'container'
    ? element.children.filter((c) => c.namespace === namespace && c.name === name)
    : []

/**
 * Bir öğenin doğrudan alt öğelerinden ada göre ilk eşleşeni döndürür.
 *
 * @param element - İçinde aranacak öğe
 * @param namespace - Aranan ad alanı URI'si
 * @param name - Aranan yerel ad
 * @returns İlk eşleşen alt öğe; yoksa `undefined`
 *
 * @example
 * ```ts
 * child(invoice, Namespace.COMMON_BASIC, 'ID')?.kind // 'leaf'
 * ```
 */
export const child = (
  element: XmlElement,
  namespace: string,
  name: string,
): XmlElement | undefined => children(element, namespace, name)[0]

/**
 * Bir `cbc:` alt öğesinin metnini döndürür.
 *
 * @param element - İçinde aranacak öğe
 * @param name - Aranan yerel ad
 * @returns Metin; öğe yoksa ya da kapsayıcıysa `undefined`
 *
 * @example
 * ```ts
 * text(invoice, 'InvoiceTypeCode') // 'SATIS'
 * ```
 */
export const text = (element: XmlElement, name: string): string | undefined => {
  const bulunan = child(element, Namespace.COMMON_BASIC, name)
  return bulunan?.kind === 'leaf' ? bulunan.text : undefined
}

/**
 * Ağaçtaki tüm öğeleri, belge sırasında dolaşır.
 *
 * @param element - Kök öğe
 * @param yol - Başlangıç yolu
 * @returns Öğe ve yol çiftlerinden oluşan üreteç
 *
 * @example
 * ```ts
 * for (const [oge, yol] of walk(root, 'Invoice')) {
 *   if (oge.name === 'PayableAmount') console.log(yol)
 * }
 * ```
 */
export function* walk(element: XmlElement, yol: string): Generator<readonly [XmlElement, string]> {
  yield [element, yol]
  if (element.kind !== 'container') return
  const sayac = new Map<string, number>()
  for (const cocuk of element.children) {
    const n = (sayac.get(cocuk.name) ?? 0) + 1
    sayac.set(cocuk.name, n)
    yield* walk(cocuk, `${yol}/${cocuk.name}[${String(n)}]`)
  }
}

/**
 * Bir öğenin öznitelik değerini döndürür.
 *
 * @param element - Özniteliği okunacak öğe
 * @param name - Öznitelik adı
 * @returns Değer; öznitelik yoksa `undefined`
 *
 * @example
 * ```ts
 * attribute(payableAmount, 'currencyID') // 'TRY'
 * ```
 */
export const attribute = (element: XmlElement, name: string): string | undefined =>
  element.attributes.find((a) => a.name === name && a.namespace === undefined)?.value
