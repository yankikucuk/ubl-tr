/**
 * UBL-TR e-İrsaliye profilleri (`cbc:ProfileID`).
 */
export const DespatchProfile = {
  /** Temel irsaliye — tek profil. */
  TEMEL: 'TEMELIRSALIYE',
} as const

/** Tanımlı e-İrsaliye profil kimlikleri. */
export type DespatchProfileId = (typeof DespatchProfile)[keyof typeof DespatchProfile]

/**
 * e-İrsaliye tipleri (`cbc:DespatchAdviceTypeCode`).
 */
export const DespatchType = {
  /** Olağan sevk irsaliyesi. */
  SEVK: 'SEVK',
  /** Matbu (kağıt) irsaliyenin elektronik karşılığı. */
  MATBUDAN: 'MATBUDAN',
} as const

/** Tanımlı e-İrsaliye tip kodları. */
export type DespatchTypeCode = (typeof DespatchType)[keyof typeof DespatchType]

/**
 * Taşıt plakası tanımlayıcı şemaları — `cbc:LicensePlateID/@schemeID`.
 */
export const LicensePlateScheme = {
  /** Çekici ya da kamyon plakası. */
  PLATE: 'PLAKA',
  /** Dorse plakası. */
  TRAILER: 'DORSE',
  /** Taşıma ekipmanı olarak bildirilen dorse plakası. */
  TRAILER_EQUIPMENT: 'DORSEPLAKA',
  /** Yabancı çekici ya da kamyon plakası. */
  FOREIGN_PLATE: 'YABANCIPLAKA',
  /** Yabancı dorse plakası. */
  FOREIGN_TRAILER: 'YABANCIDORSE',
  /** Yabancı taşıma ekipmanı plakası. */
  FOREIGN_TRAILER_EQUIPMENT: 'YABANCIDORSEPLAKA',
} as const

/** Tanımlı plaka şemaları. */
export type LicensePlateSchemeId = (typeof LicensePlateScheme)[keyof typeof LicensePlateScheme]

/**
 * Yabancı plaka şemaları.
 *
 * Bu şemalarla bildirilen plakalar Türk plaka biçim kuralından muaftır;
 * kaynak ülkenin biçimini taşırlar.
 */
export const FOREIGN_LICENSE_PLATE_SCHEMES: ReadonlySet<string> = new Set([
  LicensePlateScheme.FOREIGN_PLATE,
  LicensePlateScheme.FOREIGN_TRAILER,
  LicensePlateScheme.FOREIGN_TRAILER_EQUIPMENT,
])

/**
 * Bir plaka şemasının geçerli olup olmadığını söyler.
 *
 * @param schemeId - Denetlenecek şema
 * @returns Şema tanımlıysa `true`
 *
 * @example
 * ```ts
 * isValidLicensePlateScheme('DORSE')        // true
 * isValidLicensePlateScheme('YABANCIPLAKA') // true
 * isValidLicensePlateScheme('TIR')          // false
 * ```
 */
export const isValidLicensePlateScheme = (schemeId: string): boolean =>
  (Object.values(LicensePlateScheme) as string[]).includes(schemeId)
