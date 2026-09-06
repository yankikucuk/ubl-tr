/** Bir SGK fatura türünün tanımı. */
export interface SgkTypeDefinition {
  /** GİB'in SGK fatura türü kodu. */
  readonly code: string
  /** Türün Türkçe adı; ek belge açıklamasında kullanılır. */
  readonly name: string
}

/**
 * SGK fatura türleri.
 *
 * SGK'ya düzenlenen faturalarda türün kodu `cbc:AccountingCost` alanına
 * yazılır; adı ise mükellef adı ve kodu ek belgelerinin açıklamasında
 * geçer ("Eczane Adı", "Eczane Sicil Numarası" gibi).
 */
export const SGK_TYPE_DEFINITIONS: readonly SgkTypeDefinition[] = [
  { code: 'SAGLIK_ECZ', name: 'Eczane' },
  { code: 'SAGLIK_HAS', name: 'Hastane' },
  { code: 'SAGLIK_OPT', name: 'Optik' },
  { code: 'SAGLIK_MED', name: 'Medikal' },
  { code: 'ABONELIK', name: 'Abonelik' },
  { code: 'MAL_HIZMET', name: 'Mal ve Hizmet Alımı' },
  { code: 'DIGER', name: 'Diğer' },
]

const SGK_MAP = new Map(SGK_TYPE_DEFINITIONS.map((t) => [t.code, t]))

/**
 * Bir SGK fatura türünün tanımını döndürür.
 *
 * @param code - SGK fatura türü kodu
 * @returns Tanım; bilinmeyen kod için `undefined`
 *
 * @example
 * ```ts
 * sgkTypeDefinition('SAGLIK_ECZ')?.name // 'Eczane'
 * ```
 */
export const sgkTypeDefinition = (code: string): SgkTypeDefinition | undefined => SGK_MAP.get(code)
