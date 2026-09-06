/** KDV'nin GİB vergi türü kodu. */
export const VAT_TAX_CODE = '0015'

/** KDV'nin UBL belgelerinde yazılan adı. */
export const VAT_TAX_NAME = 'KDV'

/** Bir vergi türünün tanımı. */
export interface TaxDefinition {
  /** GİB vergi türü kodu (ör. `0015` KDV, `0071` ÖTV 1. Liste). */
  readonly code: string
  /** Verginin tam Türkçe adı. */
  readonly name: string
  /** Belgede kullanılan kısa ad. */
  readonly shortName: string
  /**
   * Verginin KDV matrahına etkisi.
   *
   * - `'increase'` — vergi KDV'den ÖNCE hesaplanır ve matraha eklenir; KDV
   *   bu verginin üzerine biner. ÖTV bu gruptadır.
   * - `'decrease'` — vergi matrahtan düşülür. Damga vergisi, ÖİV ve borsa
   *   tescil ücreti bu gruptadır.
   * - `'none'` — matrahı etkilemez.
   */
  readonly vatBaseEffect: 'increase' | 'decrease' | 'none'
  /**
   * Bu vergi ödenecek tutardan düşülür mü.
   *
   * Gelir ve kurumlar vergisi stopajı bu gruptadır: satıcı bu tutarı tahsil
   * etmez, alıcı doğrudan vergi dairesine öder. Belgede pozitif bir vergi
   * satırı olarak görünür ama `cbc:TaxInclusiveAmount` hesabına **eksi**
   * girer — bu ayrım kaçırıldığında ödenecek tutar iki kat stopaj kadar
   * yanlış çıkar.
   */
  readonly deductsFromTotal: boolean
}

/**
 * UBL-TR belgelerinde kullanılabilen vergi türleri.
 *
 * KDV (`0015`) bu listede ayrıca yer almaz; {@link VAT_TAX_CODE} ile
 * sabittir ve her faturada bulunur. Buradaki kodlar, KDV dışındaki
 * vergilerdir ve `cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme`
 * altında `cbc:TaxTypeCode` olarak yazılır.
 */
export const TAX_DEFINITIONS: readonly TaxDefinition[] = [
  {
    code: '0003',
    name: 'Gelir Vergisi Stopajı',
    shortName: 'Gelir Vergisi Stopajı',
    vatBaseEffect: 'none',
    deductsFromTotal: true,
  },
  {
    code: '0011',
    name: 'Kurumlar Vergisi Stopajı',
    shortName: 'Kurumlar Vergisi Stopajı',
    vatBaseEffect: 'none',
    deductsFromTotal: true,
  },
  {
    code: '0021',
    name: 'Banka Muameleleri Vergisi',
    shortName: 'BMV',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '0022',
    name: 'Sigorta Muameleleri Vergisi',
    shortName: 'SMV',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '0059',
    name: 'Konaklama Vergisi',
    shortName: 'Konaklama Vergisi',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '0061',
    name: 'Kaynak Kullanımı Destekleme Fonu Kesintisi',
    shortName: 'KKDF',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '0071',
    name: 'Petrol ve Doğalgaz ÖTV [1. Liste]',
    shortName: 'ÖTV 1. Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '0073',
    name: 'Kolalı Gazoz, Alkollü İçecek ve Tütün ÖTV [3. Liste]',
    shortName: 'ÖTV 3. Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '0074',
    name: 'Dayanıklı Tüketim ve Diğer Mallar ÖTV [4. Liste]',
    shortName: 'ÖTV 4. Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '0075',
    name: 'Alkollü İçecekler ÖTV [3A Liste]',
    shortName: 'ÖTV 3A Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '0076',
    name: 'Tütün Mamülleri ÖTV [3B Liste]',
    shortName: 'ÖTV 3B Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '0077',
    name: 'Kolalı Gazozlar ÖTV [3C Liste]',
    shortName: 'ÖTV 3C Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '1047',
    name: 'Damga Vergisi',
    shortName: 'Damga Vergisi',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '1048',
    name: '5035 Sayılı Kanuna Göre Damga Vergisi',
    shortName: 'Damga Vergisi 5035',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '4071',
    name: 'Elektrik ve Havagazı Tüketim Vergisi',
    shortName: 'Elektrik Tüketim V.',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '4171',
    name: 'Petrol ve Doğalgaz Ürünlerine İlişkin ÖTV Tevkifatı',
    shortName: 'PTR-DGZ ÖTV TEVKİFAT',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '4080',
    name: 'Özel İletişim Vergisi',
    shortName: 'ÖİV',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '4081',
    name: '5035 Sayılı Kanuna Göre Özel İletişim Vergisi',
    shortName: 'ÖİV 5035',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '8001',
    name: 'Borsa Tescil Ücreti',
    shortName: 'Borsa Tescil',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '8002',
    name: 'Enerji Fonu',
    shortName: 'Enerji Fonu',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '8004',
    name: 'TRT Payı',
    shortName: 'TRT Payı',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '8005',
    name: 'Elektrik Tüketim Vergisi',
    shortName: 'Elektrik Tüketim V.',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '8006',
    name: 'Telsiz Kullanım Ücreti',
    shortName: 'Telsiz Kullanım',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '8007',
    name: 'Telsiz Ruhsat Ücreti',
    shortName: 'Telsiz Ruhsat',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '8008',
    name: 'Çevre Temizlik Vergisi',
    shortName: 'Çevre Temizlik V.',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '9015',
    name: 'KDV Tevkifatı',
    shortName: 'KDV Tevkifatı',
    vatBaseEffect: 'none',
    deductsFromTotal: true,
  },
  {
    code: '9021',
    name: '4961 Banka Sigorta Muameleleri Vergisi',
    shortName: 'BSMV',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
  {
    code: '9040',
    name: 'Mera Fonu',
    shortName: 'Mera Fonu',
    vatBaseEffect: 'none',
    deductsFromTotal: true,
  },
  {
    code: '9077',
    name: 'Motorlu Taşıt ÖTV [2. Liste]',
    shortName: 'ÖTV 2. Liste',
    vatBaseEffect: 'increase',
    deductsFromTotal: false,
  },
  {
    code: '9944',
    name: 'Belediyelere Ödenen Hal Rüsumu',
    shortName: 'BEL.ÖD.HAL RÜSUM',
    vatBaseEffect: 'decrease',
    deductsFromTotal: false,
  },
]

const TAX_MAP = new Map(TAX_DEFINITIONS.map((t) => [t.code, t]))

/**
 * Bir vergi türü kodunun tanımını döndürür.
 *
 * @param code - GİB vergi türü kodu
 * @returns Tanım; kod listede yoksa `undefined`
 *
 * @example
 * ```ts
 * taxDefinition('0071')?.shortName // 'ÖTV 1. Liste'
 * taxDefinition('0003')?.deductsFromTotal // true — gelir vergisi stopajı
 * ```
 */
export const taxDefinition = (code: string): TaxDefinition | undefined => TAX_MAP.get(code)

/**
 * Bir vergi türü kodunun geçerli olup olmadığını söyler. KDV kodu da geçerlidir.
 *
 * @param code - Denetlenecek kod
 * @returns Kod tanımlıysa `true`
 *
 * @example
 * ```ts
 * isValidTaxCode('0015') // true — KDV
 * isValidTaxCode('0071') // true — ÖTV
 * isValidTaxCode('9999') // false
 * ```
 */
export const isValidTaxCode = (code: string): boolean => code === VAT_TAX_CODE || TAX_MAP.has(code)
