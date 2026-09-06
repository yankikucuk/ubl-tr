import { type CodeTables, findByCode } from './code-tables.js'
/** Bir KDV tevkifatı kodunun tanımı. */
export interface WithholdingDefinition {
  /** GİB tevkifat kodu. `6xx` kısmi, `8xx` tam tevkifattır. */
  readonly code: string
  /** İşlemin Türkçe adı. */
  readonly name: string
  /**
   * Alıcının beyan edeceği KDV yüzdesi.
   *
   * Mevzuat bunu kesir olarak yazar (7/10, 9/10); burada yüzde olarak
   * tutulur çünkü UBL `cbc:Percent` alanına yazılan değer budur.
   */
  readonly rate: number
}

/**
 * KDV tevkifatı kodları ve oranları.
 *
 * Tevkifat, KDV'nin bir kısmının satıcı yerine **alıcı** tarafından beyan
 * edilmesidir. Tevkifat tutarı KDV üzerinden hesaplanır:
 * `tevkifat = kdv × oran / 100`.
 *
 * `6xx` kodlar kısmi tevkifattır ve oranları farklıdır (ör. 603 için %70).
 * `8xx` kodlar tam tevkifattır ve oranları her zaman %100'dür.
 *
 * **Kod ve oran birlikte doğrulanır.** GİB'in Schematron kuralı kodu ve
 * yüzdeyi tek bir dize olarak (`603` + `70`) sabit bir listede arar; bu
 * yüzden serbest oranlı bir tevkifat kodu mümkün değildir.
 */
export const WITHHOLDING_DEFINITIONS: readonly WithholdingDefinition[] = [
  { code: '601', name: 'Yapım İşleri ile Mühendislik-Mimarlık ve Etüt-Proje Hizmetleri', rate: 40 },
  { code: '602', name: 'Etüt, Plan-Proje, Danışmanlık, Denetim ve Benzeri Hizmetler', rate: 90 },
  {
    code: '603',
    name: 'Makine, Teçhizat, Demirbaş ve Taşıtlara Ait Tadil, Bakım ve Onarım Hizmetleri',
    rate: 70,
  },
  { code: '604', name: 'Yemek Servis Hizmeti', rate: 50 },
  { code: '605', name: 'Organizasyon Hizmeti', rate: 50 },
  { code: '606', name: 'İşgücü Temin Hizmetleri', rate: 90 },
  { code: '607', name: 'Özel Güvenlik Hizmeti', rate: 90 },
  { code: '608', name: 'Yapı Denetim Hizmetleri', rate: 90 },
  {
    code: '609',
    name: 'Fason Tekstil ve Konfeksiyon İşleri, Çanta ve Ayakkabı Dikim İşleri',
    rate: 70,
  },
  { code: '610', name: 'Turistik Mağazalara Verilen Müşteri Bulma/Götürme Hizmetleri', rate: 90 },
  { code: '611', name: 'Spor Kulüplerinin Yayın, Reklâm ve İsim Hakkı Gelirleri', rate: 90 },
  { code: '612', name: 'Temizlik Hizmeti', rate: 90 },
  { code: '613', name: 'Çevre ve Bahçe Bakım Hizmetleri', rate: 90 },
  { code: '614', name: 'Servis Taşımacılığı Hizmeti', rate: 50 },
  { code: '615', name: 'Her Türlü Baskı ve Basım Hizmetleri', rate: 70 },
  { code: '616', name: 'Diğer Hizmetler [KDVGUT-(I/C-2.1.3.2.13)]', rate: 50 },
  { code: '617', name: 'Hurda Metalden Elde Edilen Külçe Teslimleri', rate: 70 },
  {
    code: '618',
    name: 'Hurda Metalden Elde Edilenler Dışındaki Bakır, Çinko, Demir-Çelik, Alüminyum ve Kurşun Külçe Teslimleri',
    rate: 70,
  },
  { code: '619', name: 'Bakır, Çinko ve Alüminyum Ürünlerinin Teslimi', rate: 70 },
  { code: '620', name: 'İstisnadan Vazgeçenlerin Hurda ve Atık Teslimi', rate: 70 },
  {
    code: '621',
    name: 'Metal, Plastik, Lastik, Kauçuk, Kâğıt ve Cam Hurda ve Atıklardan Elde Edilen Hammadde Teslimi',
    rate: 90,
  },
  { code: '622', name: 'Pamuk, Tiftik, Yün ve Yapağı ile Ham Post ve Deri Teslimleri', rate: 90 },
  { code: '623', name: 'Ağaç ve Orman Ürünleri Teslimi', rate: 50 },
  { code: '624', name: 'Yük Taşımacılığı Hizmeti', rate: 20 },
  { code: '625', name: 'Ticari Reklam Hizmetleri', rate: 30 },
  { code: '626', name: 'Diğer Teslimler', rate: 20 },
  { code: '627', name: 'Demir-Çelik Ürünlerinin Teslimi', rate: 50 },
  {
    code: '801',
    name: 'Yapım İşleri ile Mühendislik-Mimarlık ve Etüt-Proje Hizmetleri (Tam)',
    rate: 100,
  },
  {
    code: '802',
    name: 'Etüt, Plan-Proje, Danışmanlık, Denetim ve Benzeri Hizmetler (Tam)',
    rate: 100,
  },
  {
    code: '803',
    name: 'Makine, Teçhizat, Demirbaş ve Taşıtlara Ait Tadil, Bakım ve Onarım Hizmetleri (Tam)',
    rate: 100,
  },
  { code: '804', name: 'Yemek Servis Hizmeti (Tam)', rate: 100 },
  { code: '805', name: 'Organizasyon Hizmeti (Tam)', rate: 100 },
  { code: '806', name: 'İşgücü Temin Hizmetleri (Tam)', rate: 100 },
  { code: '807', name: 'Özel Güvenlik Hizmeti (Tam)', rate: 100 },
  { code: '808', name: 'Yapı Denetim Hizmetleri (Tam)', rate: 100 },
  { code: '809', name: 'Fason Tekstil ve Konfeksiyon İşleri (Tam)', rate: 100 },
  {
    code: '810',
    name: 'Turistik Mağazalara Verilen Müşteri Bulma/Götürme Hizmetleri (Tam)',
    rate: 100,
  },
  { code: '811', name: 'Spor Kulüplerinin Yayın, Reklâm ve İsim Hakkı Gelirleri (Tam)', rate: 100 },
  { code: '812', name: 'Temizlik Hizmeti (Tam)', rate: 100 },
  { code: '813', name: 'Çevre ve Bahçe Bakım Hizmetleri (Tam)', rate: 100 },
  { code: '814', name: 'Servis Taşımacılığı Hizmeti (Tam)', rate: 100 },
  { code: '815', name: 'Her Türlü Baskı ve Basım Hizmetleri (Tam)', rate: 100 },
  { code: '816', name: 'Hurda Metalden Elde Edilen Külçe Teslimleri (Tam)', rate: 100 },
  {
    code: '817',
    name: 'Hurda Metalden Elde Edilenler Dışındaki Bakır, Çinko, Demir-Çelik, Alüminyum ve Kurşun Külçe Teslimi (Tam)',
    rate: 100,
  },
  { code: '818', name: 'Bakır, Çinko, Alüminyum ve Kurşun Ürünlerinin Teslimi (Tam)', rate: 100 },
  { code: '819', name: 'İstisnadan Vazgeçenlerin Hurda ve Atık Teslimi (Tam)', rate: 100 },
  {
    code: '820',
    name: 'Metal, Plastik, Lastik, Kauçuk, Kâğıt ve Cam Hurda ve Atıklardan Elde Edilen Hammadde Teslimi (Tam)',
    rate: 100,
  },
  {
    code: '821',
    name: 'Pamuk, Tiftik, Yün ve Yapağı ile Ham Post ve Deri Teslimleri (Tam)',
    rate: 100,
  },
  { code: '822', name: 'Ağaç ve Orman Ürünleri Teslimi (Tam)', rate: 100 },
  { code: '823', name: 'Yük Taşımacılığı Hizmeti (Tam)', rate: 100 },
  { code: '824', name: 'Ticari Reklam Hizmetleri (Tam)', rate: 100 },
  { code: '825', name: 'Demir-Çelik Ürünlerinin Teslimi (Tam)', rate: 100 },
]

const WITHHOLDING_MAP = new Map(WITHHOLDING_DEFINITIONS.map((w) => [w.code, w]))

/**
 * Bir tevkifat kodunun tanımını döndürür.
 *
 * @param code - GİB tevkifat kodu
 * @returns Tanım; kod listede yoksa `undefined`
 *
 * @example
 * ```ts
 * withholdingDefinition('603')?.rate // 70 — makine bakım-onarım, 7/10
 * withholdingDefinition('602')?.rate // 90 — danışmanlık, 9/10
 * withholdingDefinition('803')?.rate // 100 — aynı işin tam tevkifatı
 * ```
 */
export const withholdingDefinition = (
  code: string,
  tables?: CodeTables,
): WithholdingDefinition | undefined =>
  findByCode(tables?.withholdings, code) ?? WITHHOLDING_MAP.get(code)

/**
 * Bir tevkifat kodunun geçerli olup olmadığını söyler.
 *
 * @param code - Denetlenecek kod
 * @returns Kod listede varsa `true`
 *
 * @example
 * ```ts
 * isValidWithholdingCode('603') // true
 * isValidWithholdingCode('650') // false — serbest oranlı kod GİB'ce reddedilir
 * ```
 */
export const isValidWithholdingCode = (code: string): boolean => WITHHOLDING_MAP.has(code)
