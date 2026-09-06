/**
 * UBL-TR fatura profilleri (`cbc:ProfileID`).
 *
 * Profil, faturanın hangi senaryoda düzenlendiğini söyler ve hangi fatura
 * tiplerinin kullanılabileceğini belirler. GİB bu eşleşmeyi Schematron
 * düzeyinde denetler; XSD denetlemez.
 */
export const InvoiceProfile = {
  /** Alıcının kabul/red hakkı olmayan temel fatura. */
  TEMEL: 'TEMELFATURA',
  /** Alıcının 8 gün içinde kabul ya da red hakkı olan ticari fatura. */
  TICARI: 'TICARIFATURA',
  /** Gümrük çıkışlı ihracat faturası. */
  IHRACAT: 'IHRACAT',
  /** Yolcu beraberi eşya (tax free) faturası. */
  YOLCU_BERABER: 'YOLCUBERABERFATURA',
  /** Özel fatura (Bakanlar Kurulu kararı kapsamındaki satışlar). */
  OZEL: 'OZELFATURA',
  /** Kamu kurumlarına düzenlenen fatura. */
  KAMU: 'KAMU',
  /** Hal Kayıt Sistemi kapsamındaki sebze-meyve faturaları. */
  HKS: 'HKS',
  /** Elektrikli araç şarj hizmeti faturaları. */
  ENERJI: 'ENERJI',
  /** İlaç ve tıbbi cihaz takip sistemi kapsamındaki faturalar. */
  ILAC_TIBBICIHAZ: 'ILAC_TIBBICIHAZ',
  /** Yatırım teşvik belgesi kapsamındaki faturalar. */
  YATIRIM_TESVIK: 'YATIRIMTESVIK',
  /** İhracatta Dâhilde İşleme Sistemi kapsamındaki faturalar. */
  IDIS: 'IDIS',
  /** e-Arşiv faturası — alıcısı e-Fatura mükellefi olmayan belgeler. */
  EARSIV: 'EARSIVFATURA',
} as const

/** Tanımlı profil kimlikleri. */
export type InvoiceProfileId = (typeof InvoiceProfile)[keyof typeof InvoiceProfile]

/**
 * UBL-TR fatura tipleri (`cbc:InvoiceTypeCode`).
 *
 * Tip, faturanın vergisel niteliğini söyler ve hangi alanların zorunlu
 * olduğunu belirler: `IADE` için `cac:BillingReference`, `TEVKIFAT` için
 * `cac:WithholdingTaxTotal`, `ISTISNA` için muafiyet kodu gibi.
 */
export const InvoiceType = {
  /** Olağan satış. */
  SATIS: 'SATIS',
  /** İade faturası; iade edilen faturaya atıf zorunludur. */
  IADE: 'IADE',
  /** KDV tevkifatlı satış. */
  TEVKIFAT: 'TEVKIFAT',
  /** Tevkifatlı bir faturanın iadesi. */
  TEVKIFAT_IADE: 'TEVKIFATIADE',
  /** KDV'den istisna satış; muafiyet sebebi kodu zorunludur. */
  ISTISNA: 'ISTISNA',
  /** Özel matrah şekline tabi satış. */
  OZEL_MATRAH: 'OZELMATRAH',
  /** İhraç kaydıyla teslim. */
  IHRAC_KAYITLI: 'IHRACKAYITLI',
  /** SGK'ya düzenlenen fatura. */
  SGK: 'SGK',
  /** Komisyoncu faturası. */
  KOMISYONCU: 'KOMISYONCU',
  /** Hal Kayıt Sistemi satış faturası. */
  HKS_SATIS: 'HKSSATIS',
  /** Hal Kayıt Sistemi komisyoncu faturası. */
  HKS_KOMISYONCU: 'HKSKOMISYONCU',
  /** Konaklama vergisi içeren fatura. */
  KONAKLAMA_VERGISI: 'KONAKLAMAVERGISI',
  /** Elektrikli araç şarj satışı. */
  SARJ: 'SARJ',
  /** Şarj ağı işletmecisi faturası. */
  SARJ_ANLIK: 'SARJANLIK',
  /** Teknoloji desteği kapsamındaki e-Arşiv faturası. */
  TEKNOLOJI_DESTEK: 'TEKNOLOJIDESTEK',
  /** Yatırım teşvik belgeli satış (e-Arşiv). */
  YTB_SATIS: 'YTBSATIS',
  /** Yatırım teşvik belgeli iade (e-Arşiv). */
  YTB_IADE: 'YTBIADE',
  /** Yatırım teşvik belgeli istisna (e-Arşiv). */
  YTB_ISTISNA: 'YTBISTISNA',
  /** Yatırım teşvik belgeli tevkifat (e-Arşiv). */
  YTB_TEVKIFAT: 'YTBTEVKIFAT',
  /** Yatırım teşvik belgeli tevkifat iadesi (e-Arşiv). */
  YTB_TEVKIFAT_IADE: 'YTBTEVKIFATIADE',
} as const

/** Tanımlı fatura tipi kodları. */
export type InvoiceTypeCode = (typeof InvoiceType)[keyof typeof InvoiceType]

const T = InvoiceType

/**
 * Her profilde kullanılabilen fatura tipleri.
 *
 * GİB bu eşleşmeyi Schematron ile denetler; XSD denetlemez. Yani profil ve
 * tip uyuşmazlığı olan bir belge `xmllint` ile şema doğrulamasından **geçer**
 * ve karşı tarafta reddedilir. Bu tablo, o hatanın belgeyi göndermeden önce
 * yakalanmasını sağlar.
 */
export const PROFILE_TYPES: Readonly<Record<InvoiceProfileId, readonly InvoiceTypeCode[]>> = {
  [InvoiceProfile.TEMEL]: [
    T.SATIS,
    T.IADE,
    T.TEVKIFAT,
    T.TEVKIFAT_IADE,
    T.ISTISNA,
    T.OZEL_MATRAH,
    T.IHRAC_KAYITLI,
    T.SGK,
    T.KOMISYONCU,
    T.KONAKLAMA_VERGISI,
  ],
  // TİCARİ profilde IADE YOKTUR: iade, temel faturayla düzenlenir.
  [InvoiceProfile.TICARI]: [
    T.SATIS,
    T.TEVKIFAT,
    T.TEVKIFAT_IADE,
    T.ISTISNA,
    T.OZEL_MATRAH,
    T.IHRAC_KAYITLI,
    T.SGK,
    T.KOMISYONCU,
    T.KONAKLAMA_VERGISI,
  ],
  [InvoiceProfile.IHRACAT]: [T.ISTISNA],
  [InvoiceProfile.YOLCU_BERABER]: [T.ISTISNA],
  [InvoiceProfile.OZEL]: [T.ISTISNA],
  [InvoiceProfile.KAMU]: [
    T.SATIS,
    T.IADE,
    T.TEVKIFAT,
    T.TEVKIFAT_IADE,
    T.ISTISNA,
    T.OZEL_MATRAH,
    T.IHRAC_KAYITLI,
    T.SGK,
    T.KOMISYONCU,
    T.KONAKLAMA_VERGISI,
  ],
  [InvoiceProfile.HKS]: [
    T.HKS_SATIS,
    T.HKS_KOMISYONCU,
    T.SATIS,
    T.ISTISNA,
    T.TEVKIFAT,
    T.TEVKIFAT_IADE,
  ],
  [InvoiceProfile.ENERJI]: [T.SARJ, T.SARJ_ANLIK],
  [InvoiceProfile.ILAC_TIBBICIHAZ]: [
    T.SATIS,
    T.ISTISNA,
    T.TEVKIFAT,
    T.TEVKIFAT_IADE,
    T.IADE,
    T.IHRAC_KAYITLI,
  ],
  [InvoiceProfile.YATIRIM_TESVIK]: [T.SATIS, T.ISTISNA, T.IADE, T.TEVKIFAT, T.TEVKIFAT_IADE],
  [InvoiceProfile.IDIS]: [T.SATIS, T.ISTISNA, T.IADE, T.TEVKIFAT, T.TEVKIFAT_IADE, T.IHRAC_KAYITLI],
  [InvoiceProfile.EARSIV]: [
    T.SATIS,
    T.IADE,
    T.TEVKIFAT,
    T.TEVKIFAT_IADE,
    T.ISTISNA,
    T.OZEL_MATRAH,
    T.IHRAC_KAYITLI,
    T.SGK,
    T.KOMISYONCU,
    T.KONAKLAMA_VERGISI,
    T.TEKNOLOJI_DESTEK,
    T.YTB_SATIS,
    T.YTB_IADE,
    T.YTB_ISTISNA,
    T.YTB_TEVKIFAT,
    T.YTB_TEVKIFAT_IADE,
  ],
}

/**
 * Bir profil ve fatura tipinin birlikte kullanılabilir olduğunu söyler.
 *
 * @param profile - Fatura profili
 * @param type - Fatura tipi
 * @returns Eşleşme geçerliyse `true`
 *
 * @example
 * ```ts
 * isProfileTypeAllowed('TEMELFATURA', 'IADE')  // true
 * isProfileTypeAllowed('TICARIFATURA', 'IADE') // false — iade temel faturayla düzenlenir
 * isProfileTypeAllowed('IHRACAT', 'SATIS')     // false — ihracat yalnızca ISTISNA
 * ```
 */
export const isProfileTypeAllowed = (profile: string, type: string): boolean => {
  const izinli = (PROFILE_TYPES as Record<string, readonly string[] | undefined>)[profile]
  return izinli?.includes(type) ?? false
}

/** İade grubundaki tipler; bu tiplerde iade edilen faturaya atıf zorunludur. */
export const RETURN_TYPES: readonly InvoiceTypeCode[] = [
  T.IADE,
  T.TEVKIFAT_IADE,
  T.YTB_IADE,
  T.YTB_TEVKIFAT_IADE,
]

/**
 * Bir fatura tipi için iade atfında yazılabilecek belge tipi kodlarını
 * döndürür.
 *
 * `cac:BillingReference/cac:InvoiceDocumentReference/cbc:DocumentTypeCode`
 * alanında atıf yapılan asıl belgenin tipi bildirilir. GİB Schematron'u
 * iade faturalarında bu alanı faturanın kendi tipiyle bekler; kurucu
 * verilmediğinde onu kendiliğinden yazar. Bu işlev arayüzün seçim
 * kutusunu doldurması içindir.
 *
 * @param type - Fatura tipi
 * @returns İzin verilen belge tipi kodları; iade tipi değilse boş dizi
 *
 * @example
 * ```ts
 * availableBillingDocumentTypes('IADE')  // ['IADE']
 * availableBillingDocumentTypes('SATIS') // []
 * ```
 */
export const availableBillingDocumentTypes = (type: InvoiceTypeCode): readonly InvoiceTypeCode[] =>
  RETURN_TYPES.includes(type) ? [type] : []

/** Tevkifat grubundaki tipler; bu tiplerde tevkifat toplamı zorunludur. */
export const WITHHOLDING_TYPES: readonly InvoiceTypeCode[] = [
  T.TEVKIFAT,
  T.TEVKIFAT_IADE,
  T.YTB_TEVKIFAT,
  T.YTB_TEVKIFAT_IADE,
]

/**
 * `cac:WithholdingTaxTotal` **taşıyabilen** fatura tipleri.
 *
 * {@link WITHHOLDING_TYPES} ile karıştırılmamalı: orası tevkifatın
 * *zorunlu* olduğu tipler, burası *izin verilen* tipler.
 *
 * Listede `TEVKIFATIADE` **yoktur** ve bu şaşırtıcı ama doğrudur: GİB'in
 * `GeneralWithholdingTaxTotalCheck` kuralı bu tipi kabul etmez. Sahadaki
 * doğru yapı, tevkifatlı iadeyi `IADE` tipiyle ve kalemlerde tevkifat
 * koduyla düzenlemektir.
 */
export const WITHHOLDING_ALLOWED_TYPES: readonly InvoiceTypeCode[] = [
  T.TEVKIFAT,
  T.YTB_TEVKIFAT,
  T.IADE,
  T.YTB_IADE,
  T.SGK,
  T.SARJ,
  T.SARJ_ANLIK,
]

/**
 * KDV sıfır olduğunda muafiyet sebebi kodu **gerekmeyen** tipler.
 *
 * Diğer tiplerde sıfır KDV'li bir kalem muafiyet kodu ister; bu tiplerde
 * sıfır KDV'nin gerekçesi tipin kendisidir.
 */
export const ZERO_VAT_WITHOUT_EXEMPTION_TYPES: readonly InvoiceTypeCode[] = [
  T.IADE,
  T.OZEL_MATRAH,
  T.SGK,
  T.IHRAC_KAYITLI,
  T.KONAKLAMA_VERGISI,
  T.YTB_IADE,
]

/** Yatırım teşvik e-Arşiv tipleri. */
export const YTB_TYPES: readonly InvoiceTypeCode[] = [
  T.YTB_SATIS,
  T.YTB_IADE,
  T.YTB_ISTISNA,
  T.YTB_TEVKIFAT,
  T.YTB_TEVKIFAT_IADE,
]

/** İstisna grubundaki tipler; bu tiplerde muafiyet sebebi kodu zorunludur. */
export const EXEMPTION_TYPES: readonly InvoiceTypeCode[] = [T.ISTISNA, T.YTB_ISTISNA]
