import { type CodeTables, findByCode } from './code-tables.js'

/** Bir ambalaj (kap) cinsi kodunun tanımı. */
export interface PackagingTypeDefinition {
  /** UN/ECE Rec 21 iki harfli kod. */
  readonly code: string
  /** Kodun Türkçe karşılığı. */
  readonly name: string
}

/**
 * Ambalaj cinsi kodları — UN/ECE Rec 21, UBL-TR'nin kullandığı alt küme.
 *
 * `cac:TransportHandlingUnit/cac:ActualPackage/cbc:PackagingTypeCode`
 * alanında kullanılır: e-İrsaliyede malın kaç kap hâlinde ve hangi
 * ambalajla sevk edildiğini bildirir.
 */
export const PACKAGING_TYPE_DEFINITIONS: readonly PackagingTypeDefinition[] = [
  { code: 'BA', name: 'Varil' },
  { code: 'BE', name: 'Bohça' },
  { code: 'BG', name: 'Torba' },
  { code: 'BH', name: 'Demet' },
  { code: 'BI', name: 'Çöp kutusu' },
  { code: 'BJ', name: 'Kova' },
  { code: 'BK', name: 'Sepet' },
  { code: 'BX', name: 'Kutu' },
  { code: 'CB', name: 'Bira kasası' },
  { code: 'CH', name: 'Sandık' },
  { code: 'CI', name: 'Teneke kutu' },
  { code: 'CK', name: 'Fıçı' },
  { code: 'CN', name: 'Konteyner' },
  { code: 'CR', name: 'Kasa' },
  { code: 'DK', name: 'Karton kasa' },
  { code: 'DR', name: 'Bidon' },
  { code: 'EC', name: 'Plastik torba' },
  { code: 'FC', name: 'Meyve kasası' },
  { code: 'JR', name: 'Kavanoz' },
  { code: 'LV', name: 'Liftvan' },
  { code: 'NE', name: 'Ambalajsız' },
  { code: 'SA', name: 'Çuval' },
  { code: 'SU', name: 'Bavul' },
  { code: 'TN', name: 'Teneke' },
  { code: 'VG', name: 'Dökme gaz' },
  { code: 'VL', name: 'Dökme sıvı' },
  { code: 'VO', name: 'Dökme katı' },
]

const PACKAGING_MAP = new Map(PACKAGING_TYPE_DEFINITIONS.map((t) => [t.code, t]))

/**
 * Bir ambalaj cinsi kodunun tanımını döndürür.
 *
 * @param code - UN/ECE Rec 21 kodu
 * @param tables - Gömülü tablonun önüne geçen ek tanımlar
 * @returns Tanım; bilinmeyen kod için `undefined`
 *
 * @example
 * ```ts
 * packagingTypeDefinition('BX')?.name // 'Kutu'
 * packagingTypeDefinition('XX')       // undefined
 * ```
 */
export const packagingTypeDefinition = (
  code: string,
  tables?: CodeTables,
): PackagingTypeDefinition | undefined =>
  findByCode(tables?.packagingTypes, code) ?? PACKAGING_MAP.get(code)

/**
 * Bir ambalaj cinsi kodunun tabloda tanımlı olup olmadığını söyler.
 *
 * @param code - UN/ECE Rec 21 kodu
 * @param tables - Gömülü tablonun önüne geçen ek tanımlar
 * @returns Kod tanımlıysa `true`
 *
 * @example
 * ```ts
 * isValidPackagingTypeCode('BX') // true
 * isValidPackagingTypeCode('XX') // false
 * ```
 */
export const isValidPackagingTypeCode = (code: string, tables?: CodeTables): boolean =>
  packagingTypeDefinition(code, tables) !== undefined
