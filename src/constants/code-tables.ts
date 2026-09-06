import type { CurrencyDefinition } from './currency.js'
import type { ExemptionDefinition } from './exemption.js'
import type { TaxDefinition } from './tax.js'
import type { UnitDefinition } from './unit.js'
import type { WithholdingDefinition } from './withholding.js'

/**
 * Gömülü GİB kod tablolarının üzerine yazılan ek tanımlar.
 *
 * GİB kod listelerini kendi takvimine göre günceller: yeni bir muafiyet
 * kodu, yeni bir tevkifat oranı, yeni bir birim kodu. Bir kütüphane
 * sürümünü beklemek zorunda kalmak, sahada gerçek bir engeldir — kod
 * tanınmadığı için belge **hiç üretilemez**.
 *
 * Bu tip o boşluğu kapatır: verdiğiniz tanımlar gömülü tablonun **önüne**
 * geçer, yani hem yeni kod eklenebilir hem de var olan bir tanım
 * düzeltilebilir.
 *
 * Rakip paketler bu işi süreç genelinde değişebilen bir tekil nesneyle
 * (singleton) yapıyor. Burada tercih başka: tablo **çağrı başına** verilir.
 * Sebebi üç tane —
 *
 * 1. Aynı süreçte birden çok kiracıya hizmet eden bir uygulama, her biri
 *    için farklı tablo kullanabilir; genel değişebilir durum buna izin
 *    vermez.
 * 2. Arama işlevleri saf kalır: `withholdingDefinition('603')` her zaman
 *    aynı sonucu verir, süreç ömrü boyunca değişmez.
 * 3. `EventEmitter` gerekmez; kütüphanenin tarayıcıda çalışması korunur.
 *
 * @example Yeni yayımlanan bir muafiyet kodunu eklemek
 * ```ts
 * const tablolar: CodeTables = {
 *   exemptions: [
 *     { code: '999', name: 'Yeni istisna', taxType: 'KDV', documentType: 'ISTISNA' },
 *   ],
 * }
 * buildInvoiceXml(girdi, { codeTables: tablolar })
 * ```
 *
 * @example Var olan bir tevkifat oranını düzeltmek
 * ```ts
 * // Gömülü tanımın önüne geçer; oran koddan hesaplanır.
 * const tablolar: CodeTables = {
 *   withholdings: [{ code: '603', name: 'Temizlik hizmeti', rate: 90 }],
 * }
 * ```
 */
export interface CodeTables {
  /** Ek ya da düzeltilmiş vergi türü tanımları. */
  readonly taxes?: readonly TaxDefinition[]
  /** Ek ya da düzeltilmiş tevkifat tanımları. */
  readonly withholdings?: readonly WithholdingDefinition[]
  /** Ek ya da düzeltilmiş muafiyet tanımları. */
  readonly exemptions?: readonly ExemptionDefinition[]
  /** Ek ya da düzeltilmiş birim tanımları. */
  readonly units?: readonly UnitDefinition[]
  /** Ek ya da düzeltilmiş para birimi tanımları. */
  readonly currencies?: readonly CurrencyDefinition[]
}

/**
 * Bir kod listesinde koda göre arama yapar.
 *
 * Doğrusal tarama bilinçli: geçersiz kılma listeleri birkaç kayıtlıdır ve
 * bir harita kurmanın maliyeti aramanın maliyetinden yüksektir.
 */
export const findByCode = <T extends { readonly code: string }>(
  liste: readonly T[] | undefined,
  code: string,
): T | undefined => liste?.find((kayit) => kayit.code === code)
