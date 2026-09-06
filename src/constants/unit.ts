/**
 * Bir ölçü birimi tanımı.
 *
 * `code`, UBL `unitCode` özniteliğine yazılan UN/ECE Recommendation 20
 * kodudur; `name` GİB'in Türkçe etiketidir.
 */
export interface UnitDefinition {
  /** UN/ECE Rec 20 birim kodu (ör. `C62`). */
  readonly code: string
  /** GİB'in Türkçe etiketi (ör. `Adet`). */
  readonly name: string
}

/**
 * UBL-TR belgelerinde kullanılabilen ölçü birimleri.
 *
 * GİB, `unitCode` alanında serbest metin kabul etmez; kod bu listeden
 * gelmelidir. Sık yapılan hata, insan tarafından okunabilir adı
 * (`"Adet"`) kod alanına yazmaktır — GİB'in beklediği `C62`'dir.
 *
 * @see {@link unitDefinition} — koddan tanıma erişim
 */
export const UNIT_DEFINITIONS: readonly UnitDefinition[] = [
  { code: 'C62', name: 'Adet' },
  { code: 'KGM', name: 'Kilogram' },
  { code: 'DPC', name: 'Düzine' },
  { code: 'MTK', name: 'Metre Kare' },
  { code: 'MTR', name: 'Metre' },
  { code: 'PR', name: 'Çift' },
  { code: 'LTR', name: 'Litre' },
  { code: 'D40', name: 'Bin Litre' },
  { code: 'R9', name: 'Bin Metre Küp' },
  { code: 'D30', name: 'Brüt Kalori Değeri' },
  { code: 'GRM', name: 'Gram' },
  { code: 'GT', name: 'Gross Ton' },
  { code: 'NCL', name: 'Hücre Adedi' },
  { code: 'KPH', name: 'Kg Potasyum Oksid' },
  { code: 'B32', name: 'Kg-Metre Kare' },
  { code: 'KOH', name: 'Kilogram Potasyum Hidroksit' },
  { code: 'K20', name: 'Kilogram Potasyum Oksit' },
  { code: 'K62', name: 'Kilogram-Adet' },
  { code: 'KH6', name: 'Kilogram-Baş' },
  { code: 'KPR', name: 'Kilogram-Çift' },
  { code: 'KWT', name: 'Kilowatt' },
  { code: 'KWH', name: 'Kilowatt Saat' },
  { code: 'MTQ', name: 'Metre Küp' },
  { code: 'LPA', name: 'Saf Alkol Litresi' },
  { code: 'SET', name: 'Set' },
  { code: 'CCT', name: 'Ton Başına Taşıma Kapasitesi' },
  { code: 'CPR', name: 'Adet-Çift' },
  { code: 'HUR', name: 'Saat' },
  { code: 'T3', name: 'Bin Adet' },
  { code: 'AYR', name: 'Altın Ayarı' },
  { code: 'KNI', name: 'Azotun Kilogram' },
  { code: 'BAS', name: 'Baş' },
  { code: 'TWH', name: 'Terawatt Saat' },
  { code: 'KFO', name: 'Difosfor Pentaoksit Kilogramı' },
  { code: 'GFI', name: 'Fıssıle İzotop Gramı' },
  { code: 'GMS', name: 'Gümüş' },
  { code: 'KHO', name: 'Hidrojen Peroksit Kilogramı' },
  { code: 'K58', name: 'Kurutulmuş Net Ağırlık Kilogramı' },
  { code: 'OMV', name: 'Otv Maktu Vergi' },
  { code: 'OTB', name: 'Otv Birim Fiyatı' },
  { code: 'KMA', name: 'Metil Aminlerin Kilogramı' },
  { code: 'KSH', name: 'Sodyum Hidroksit Kilogramı' },
  { code: 'KUR', name: 'Uranyum Kilogramı' },
  { code: 'H62', name: 'Yüz Adet' },
  { code: 'KSD', name: '%90 Kuru Üzüm Kilogramı' },
  { code: 'DAY', name: 'Gün' },
  { code: 'MON', name: 'Ay' },
  { code: 'ANN', name: 'Yıl' },
  { code: 'D61', name: 'Dakika' },
  { code: 'D62', name: 'Saniye' },
  { code: 'PA', name: 'Paket' },
  { code: 'BX', name: 'Kutu' },
  { code: 'MGM', name: 'Miligram' },
  { code: '26', name: 'Ton' },
  { code: 'NT', name: 'Net Ton' },
  { code: 'MMT', name: 'Milimetre' },
  { code: 'CMT', name: 'Santimetre' },
  { code: 'CMQ', name: 'Santimetre Küp' },
  { code: 'CLT', name: 'Santilitre' },
  { code: 'KJO', name: 'Kilojoule' },
  { code: 'MMQ', name: 'Milimetre Küp' },
  { code: 'CMK', name: 'Santimetre Kare' },
  { code: 'MLT', name: 'Mililitre' },
  { code: 'KTM', name: 'Kilometre' },
  { code: 'CTM', name: 'Karat' },
  { code: 'RO', name: 'Rulo' },
  { code: 'BJ', name: 'Kova' },
  { code: 'YRD', name: 'Yarda' },
  { code: 'TN', name: 'Teneke' },
  { code: 'DR', name: 'Davul' },
  { code: 'GRO', name: 'Groza' },
  { code: 'EV', name: 'Zarf' },
  { code: 'DMK', name: 'Desimetre Kare' },
  { code: 'GWH', name: 'Gigawatt Saat' },
  { code: 'MWH', name: 'Megawatt Saat' },
  { code: 'SM3', name: 'Standart Metre Küp' },
  { code: 'D32', name: 'Terawatt Saat' },
]

/** UBL-TR'nin varsayılan birimi: adet. */
export const DEFAULT_UNIT_CODE = 'C62'

const UNIT_MAP = new Map(UNIT_DEFINITIONS.map((u) => [u.code, u]))

/**
 * Bir birim kodunun tanımını döndürür.
 *
 * @param code - UN/ECE Rec 20 birim kodu
 * @returns Tanım; kod listede yoksa `undefined`
 *
 * @example
 * ```ts
 * unitDefinition('C62')?.name // 'Adet'
 * unitDefinition('KGM')?.name // 'Kilogram'
 * unitDefinition('Adet')      // undefined — bu bir ad, kod değil
 * ```
 */
export const unitDefinition = (code: string): UnitDefinition | undefined => UNIT_MAP.get(code)

/**
 * Bir birim kodunun geçerli olup olmadığını söyler.
 *
 * @param code - Denetlenecek kod
 * @returns Kod listede varsa `true`
 *
 * @example
 * ```ts
 * isValidUnitCode('C62')   // true
 * isValidUnitCode('ADET')  // false
 * ```
 */
export const isValidUnitCode = (code: string): boolean => UNIT_MAP.has(code)
