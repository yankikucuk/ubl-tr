import { NamespacePrefix } from '../constants/index.js'
import type { XmlElement } from '../core/index.js'

import { toResult, type ValidationIssue, type ValidationResult } from './result.js'
import { type ChildRule, structureModel } from './structure-model.js'

/** Bir öğenin okunabilir nitelikli adını üretir. */
const qname = (element: { readonly namespace: string; readonly name: string }): string => {
  const onEk = (NamespacePrefix as Record<string, string | undefined>)[element.namespace]
  return onEk === undefined ? element.name : `${onEk}:${element.name}`
}

/** Bir kuralın okunabilir nitelikli adını üretir. */
const ruleName = (rule: ChildRule): string => qname(rule)

/**
 * Bir UBL belgesini sıra ve zorunluluk modeline karşı doğrular.
 *
 * **XSD doğrulaması değildir.** Gerçek şema doğrulaması bir XML şema motoru
 * ister; bu paketin çalışma zamanı bağımlılığı yoktur. Burada XSD'nin
 * yakaladığı hataların en sık görülen sınıfı denetlenir: **alt öğe sırası ve
 * zorunluluk.** UBL `xsd:sequence` kullanır — doğru öğeleri yanlış sırada
 * yazmak belgeyi geçersiz kılar ve elle üretimde en sık yapılan hata budur.
 *
 * Modelde tanımlı olmayan bir öğe tipinin altı **denetlenmez**. Bu bilinçli:
 * eksik bir modelle yanlış hata üretmek, sessiz kalmaktan kötüdür. Hangi
 * tiplerin modellendiği {@link STRUCTURE_MODELS} içinde görülebilir.
 *
 * @param root - Doğrulanacak belgenin kök öğesi
 * @returns Bulgular ve geçerlilik
 *
 * @example Geçerli belge
 * ```ts
 * const { root } = buildInvoice(girdi)
 * validateStructure(root).valid // true
 * ```
 *
 * @example Gelen bir belgeyi denetlemek
 * ```ts
 * const { root } = parseDocument(partnerdenGelenXml)
 * const sonuc = validateStructure(root)
 * for (const bulgu of sonuc.issues) {
 *   console.error(`${bulgu.path}: ${bulgu.message}`)
 * }
 * ```
 *
 * @example Sıra hatası
 * ```ts
 * // `cbc:Note` UBL sırasında `cbc:InvoiceTypeCode`'dan SONRA gelir.
 * validateStructure(notuOnceYazanBelge).issues[0]?.code // 'ELEMENT_OUT_OF_ORDER'
 * ```
 */
export const validateStructure = (root: XmlElement): ValidationResult => {
  const issues: ValidationIssue[] = []

  const dogrula = (element: XmlElement, path: string): void => {
    if (element.kind !== 'container') return
    const model = structureModel(element.namespace, element.name)

    if (model === undefined) {
      // Model yoksa altı denetlenmez, ama alt ağaç yine gezilir: içeride
      // modellenmiş bir tip olabilir.
      for (const [i, child] of element.children.entries()) {
        dogrula(child, `${path}/${qname(child)}[${String(i + 1)}]`)
      }
      return
    }

    const sayilar = new Map<string, number>()
    let kuralIndeksi = 0

    for (const [i, child] of element.children.entries()) {
      const cocukYolu = `${path}/${qname(child)}[${String(i + 1)}]`
      const anahtar = `${child.namespace}#${child.name}`
      sayilar.set(anahtar, (sayilar.get(anahtar) ?? 0) + 1)

      const kuralYeri = model.children.findIndex(
        (r) => r.namespace === child.namespace && r.name === child.name,
      )

      if (kuralYeri === -1) {
        issues.push({
          code: 'UNKNOWN_ELEMENT',
          path: cocukYolu,
          severity: 'error',
          message:
            `"${qname(element)}" içinde "${qname(child)}" öğesi tanımlı değil. ` +
            'Yazım hatası ya da yanlış ad alanı olabilir.',
        })
      } else if (kuralYeri < kuralIndeksi) {
        const beklenen = model.children[kuralIndeksi]
        issues.push({
          code: 'ELEMENT_OUT_OF_ORDER',
          path: cocukYolu,
          severity: 'error',
          message:
            `"${qname(child)}" öğesi sırada geç kalmış. UBL \`xsd:sequence\` kullanır; ` +
            `bu öğe ${beklenen === undefined ? 'daha önce' : `"${ruleName(beklenen)}" öğesinden önce`} gelmelidir.`,
        })
      } else {
        kuralIndeksi = kuralYeri
      }
    }

    for (const kural of model.children) {
      const adet = sayilar.get(`${kural.namespace}#${kural.name}`) ?? 0
      if (adet < kural.min) {
        issues.push({
          code: 'MISSING_REQUIRED_ELEMENT',
          path: `${path}/${ruleName(kural)}`,
          severity: 'error',
          message: `"${qname(element)}" içinde "${ruleName(kural)}" öğesi zorunludur.`,
        })
      } else if (adet > kural.max) {
        issues.push({
          code: 'TOO_MANY_ELEMENTS',
          path: `${path}/${ruleName(kural)}`,
          severity: 'error',
          message:
            `"${ruleName(kural)}" öğesi en fazla ${String(kural.max)} kez yazılabilir, ` +
            `${String(adet)} kez yazılmış.`,
        })
      }
    }

    for (const [i, child] of element.children.entries()) {
      dogrula(child, `${path}/${qname(child)}[${String(i + 1)}]`)
    }
  }

  dogrula(root, root.name)
  return toResult(issues)
}
