import {
  type CodeTables,
  EXEMPTION_DEFINITIONS,
  type ExemptionDefinition,
  InvoiceProfile,
  type InvoiceProfileId,
  InvoiceType,
  type InvoiceTypeCode,
  PROFILE_TYPES,
  RETURN_TYPES,
  WITHHOLDING_ALLOWED_TYPES,
  WITHHOLDING_DEFINITIONS,
  type WithholdingDefinition,
  YTB_TYPES,
} from '../constants/index.js'

/** Belge düzeyinde hangi alanların anlamlı olduğu. */
export interface FieldVisibility {
  /** İade edilen faturaya atıf alanı — `cac:BillingReference`. */
  readonly billingReference: boolean
  /** Satırlarda tevkifat kodu seçilebilir mi. */
  readonly withholdingCode: boolean
  /** Satırlarda muafiyet kodu seçilebilir mi. */
  readonly exemptionCode: boolean
  /** Aracı alıcı — `cac:BuyerCustomerParty`. */
  readonly buyerCustomer: boolean
  /** Satırlarda teslim bilgisi. */
  readonly lineDelivery: boolean
  /** Ödeme bilgisi ve IBAN. */
  readonly paymentMeans: boolean
  /** Döviz kuru — belge para birimi Türk lirası dışındaysa. */
  readonly exchangeRate: boolean
  /** Fatura dönemi. */
  readonly invoicePeriod: boolean
  /** Sözleşme atfı (yatırım teşvik belge numarası). */
  readonly contractDocument: boolean
  /** KDV iade aracı kurumu. */
  readonly taxRepresentative: boolean
  /** Kalemde marka, model, sınıflandırma ve seri bilgileri. */
  readonly itemDetails: boolean
  /** Kalemde ek tanımlayıcı (künye no, takip no). */
  readonly itemIdentifications: boolean
}

/** Belirli bir satır için hangi alanların anlamlı olduğu. */
export interface LineFieldVisibility {
  /** Tevkifat kodu. */
  readonly withholdingCode: boolean
  /** Muafiyet kodu. */
  readonly exemptionCode: boolean
  /** Teslim bilgisi (adres, Incoterms, GTİP, gümrük beyannamesi). */
  readonly delivery: boolean
  /** Marka, model, sınıflandırma, ürün takip ve seri numarası. */
  readonly itemDetails: boolean
  /** Ek tanımlayıcılar. */
  readonly itemIdentifications: boolean
  /** İskonto alanları. */
  readonly discount: boolean
  /** KDV dışı vergiler. */
  readonly additionalTaxes: boolean
}

/** {@link deriveFieldVisibility} girdisi. */
export interface VisibilityContext {
  /** Belge profili. */
  readonly profile?: InvoiceProfileId
  /** Fatura tipi. */
  readonly type?: InvoiceTypeCode
  /** Belge para birimi. */
  readonly currencyCode?: string
}

const iceren = (liste: readonly string[], deger: string | undefined): boolean =>
  deger !== undefined && liste.includes(deger)

/**
 * Alıcının mükellefiyet durumu.
 *
 * Türkiye'de fatura düzenlemenin ilk kararı budur ve gerisini belirler:
 * alıcı GİB'in e-Fatura mükellef listesinde ise **e-Fatura**, değilse
 * **e-Arşiv Fatura** düzenlenir. Yanlış tarafı seçmek belgeyi geçersiz
 * kılar — e-Fatura mükellefine e-Arşiv düzenlenemez, tersi de olmaz.
 *
 * - `'einvoice'` — e-Fatura mükellefi: `EARSIVFATURA` dışındaki profiller
 * - `'earchive'` — mükellef değil: yalnızca `EARSIVFATURA` profili
 *
 * Bu kütüphane mükellef listesini **sorgulamaz** (ağ isteği yapmaz);
 * sonucu siz verirsiniz, kütüphane ona göre seçenekleri daraltır.
 */
export type CustomerLiability = 'einvoice' | 'earchive'

/**
 * Profil listesini mükellefiyete göre süzer.
 *
 * İhracat istisnası: `isExport` verilirse `IHRACAT` profili e-Fatura
 * mükellefinde de kalır — ihracat faturası e-Fatura mükellefine düzenlenen
 * bir belgedir ve profili ayrıdır.
 *
 * @param profiles - Süzülecek profiller
 * @param liability - Mükellefiyet durumu; verilmezse süzme yapılmaz
 * @param isExport - İhracat oturumu mu
 * @returns Mükellefiyetin izin verdiği profiller
 *
 * @example
 * ```ts
 * filterProfilesByLiability([InvoiceProfile.TEMEL, InvoiceProfile.EARSIV], 'earchive')
 * // ['EARSIVFATURA']
 * ```
 */
export const filterProfilesByLiability = (
  profiles: readonly InvoiceProfileId[],
  liability?: CustomerLiability,
  isExport = false,
): InvoiceProfileId[] => {
  if (liability === undefined) return [...profiles]
  if (liability === 'earchive') return profiles.filter((p) => p === InvoiceProfile.EARSIV)
  return profiles.filter((p) => {
    if (p === InvoiceProfile.EARSIV) return false
    if (p === InvoiceProfile.IHRACAT) return isExport
    return true
  })
}

/**
 * Tip listesini mükellefiyete göre süzer.
 *
 * Profil daraldığında ona ait olmayan tipler de daralır: e-Arşiv
 * mükellefinde yalnızca `EARSIVFATURA` profilinin taşıdığı tipler kalır.
 *
 * @param types - Süzülecek tipler
 * @param liability - Mükellefiyet durumu; verilmezse süzme yapılmaz
 * @returns Mükellefiyetin izin verdiği tipler
 */
export const filterTypesByLiability = (
  types: readonly InvoiceTypeCode[],
  liability?: CustomerLiability,
): readonly InvoiceTypeCode[] => {
  if (liability !== 'earchive') return types
  const earsiv = PROFILE_TYPES[InvoiceProfile.EARSIV] as readonly string[]
  return types.filter((t) => earsiv.includes(t))
}

/**
 * Profil ve fatura tipine göre hangi alanların anlamlı olduğunu türetir.
 *
 * Bu bir **doğrulama değil, yönlendirmedir**: gizlenen bir alan yasak
 * değildir, o senaryoda anlamsızdır. Formda gereksiz alanları gizlemek ve
 * kullanıcıyı doğru alanlara yönlendirmek için kullanılır. Belgenin
 * geçerliliğini {@link validateInvoiceRules} söyler.
 *
 * @param context - Profil, tip ve para birimi
 * @returns Belge düzeyinde alan görünürlükleri
 *
 * @example
 * ```ts
 * deriveFieldVisibility({ type: InvoiceType.IADE }).billingReference   // true
 * deriveFieldVisibility({ type: InvoiceType.SATIS }).billingReference  // false
 * deriveFieldVisibility({ type: InvoiceType.TEVKIFAT }).withholdingCode // true
 * ```
 *
 * @example Tevkifatlı iadenin doğru kurulumu
 * ```ts
 * // TEVKIFATIADE tipi tevkifat TAŞIYAMAZ; sahadaki doğru yapı IADE tipi
 * // ve kalemlerde tevkifat kodudur. Görünürlük bunu yansıtır.
 * deriveFieldVisibility({ type: InvoiceType.TEVKIFAT_IADE }).withholdingCode // false
 * deriveFieldVisibility({ type: InvoiceType.IADE }).withholdingCode          // true
 * ```
 */
export const deriveFieldVisibility = (context: VisibilityContext): FieldVisibility => {
  const { profile, type, currencyCode } = context
  const ytb = profile === InvoiceProfile.YATIRIM_TESVIK || iceren(YTB_TYPES, type)
  const ihracat =
    profile === InvoiceProfile.IHRACAT ||
    profile === InvoiceProfile.YOLCU_BERABER ||
    type === InvoiceType.IHRAC_KAYITLI

  return {
    billingReference: iceren(RETURN_TYPES, type),
    withholdingCode: iceren(WITHHOLDING_ALLOWED_TYPES, type),
    exemptionCode:
      type === InvoiceType.ISTISNA ||
      type === InvoiceType.YTB_ISTISNA ||
      type === InvoiceType.IHRAC_KAYITLI ||
      type === InvoiceType.OZEL_MATRAH,
    buyerCustomer: profile === InvoiceProfile.KAMU || ihracat,
    lineDelivery: ihracat,
    paymentMeans: true,
    exchangeRate: currencyCode !== undefined && currencyCode !== 'TRY',
    invoicePeriod: type === InvoiceType.SARJ || type === InvoiceType.SARJ_ANLIK,
    contractDocument: ytb,
    taxRepresentative: profile === InvoiceProfile.YOLCU_BERABER,
    itemDetails: ytb,
    itemIdentifications:
      profile === InvoiceProfile.HKS ||
      profile === InvoiceProfile.ILAC_TIBBICIHAZ ||
      profile === InvoiceProfile.IDIS,
  }
}

/**
 * Bir satır için alan görünürlüklerini türetir.
 *
 * Satır düzeyi belge düzeyinden ayrıdır: bazı alanlar belgede açık olsa
 * bile o satır için anlamsız olabilir.
 *
 * @param context - Profil, tip ve para birimi
 * @returns Satır düzeyinde alan görünürlükleri
 *
 * @example
 * ```ts
 * deriveLineFieldVisibility({ profile: InvoiceProfile.HKS }).itemIdentifications // true
 * ```
 */
export const deriveLineFieldVisibility = (context: VisibilityContext): LineFieldVisibility => {
  const belge = deriveFieldVisibility(context)
  return {
    withholdingCode: belge.withholdingCode,
    exemptionCode: belge.exemptionCode,
    delivery: belge.lineDelivery,
    itemDetails: belge.itemDetails,
    itemIdentifications: belge.itemIdentifications,
    discount: true,
    additionalTaxes: true,
  }
}

/**
 * Bir fatura tipiyle birlikte kullanılabilen profilleri döndürür.
 *
 * @param type - Fatura tipi
 * @returns İzin verilen profiller
 *
 * @example
 * ```ts
 * allowedProfilesForType(InvoiceType.IADE)
 * // TEMELFATURA, KAMU, ILAC_TIBBICIHAZ, YATIRIMTESVIK, IDIS, EARSIVFATURA
 * // TICARIFATURA yoktur: iade temel faturayla düzenlenir.
 * ```
 */
export const allowedProfilesForType = (
  type: InvoiceTypeCode,
  liability?: CustomerLiability,
  isExport = false,
): InvoiceProfileId[] =>
  filterProfilesByLiability(
    (Object.keys(PROFILE_TYPES) as InvoiceProfileId[]).filter((p) =>
      (PROFILE_TYPES[p] as readonly string[]).includes(type),
    ),
    liability,
    isExport,
  )

/**
 * Bir profilde kullanılabilen fatura tiplerini döndürür.
 *
 * @param profile - Fatura profili
 * @returns İzin verilen tipler
 *
 * @example
 * ```ts
 * allowedTypesForProfile(InvoiceProfile.IHRACAT) // ['ISTISNA']
 * ```
 */
export const allowedTypesForProfile = (
  profile: InvoiceProfileId,
  liability?: CustomerLiability,
): readonly InvoiceTypeCode[] => filterTypesByLiability(PROFILE_TYPES[profile], liability)

/**
 * Tip değiştiğinde profilin hâlâ geçerli olup olmadığını çözer.
 *
 * Formda tip seçici ile profil seçici birbirine bağlıdır: kullanıcı tipi
 * değiştirdiğinde eldeki profil o tipe uymayabilir. Bu işlev, uyuyorsa
 * profili korur; uymuyorsa mükellefiyete uygun bir profil önerir.
 *
 * İade faturasında özel bir kural var: iade **temel** faturayla düzenlenir,
 * ticari faturayla değil. Bu GİB Schematron kuralıdır, tercih değil.
 *
 * @param currentProfile - Formdaki mevcut profil
 * @param newType - Yeni seçilen fatura tipi
 * @param liability - Alıcının mükellefiyet durumu
 * @param isExport - İhracat oturumu mu
 * @returns Korunan ya da önerilen profil
 *
 * @example
 * ```ts
 * // Uyuyorsa dokunulmaz
 * resolveProfileForType(InvoiceProfile.TICARI, InvoiceType.SATIS) // 'TICARIFATURA'
 * // Ticari faturada iade yok; temele düşer
 * resolveProfileForType(InvoiceProfile.TICARI, InvoiceType.IADE)  // 'TEMELFATURA'
 * ```
 */
export const resolveProfileForType = (
  currentProfile: InvoiceProfileId | undefined,
  newType: InvoiceTypeCode,
  liability?: CustomerLiability,
  isExport = false,
): InvoiceProfileId => {
  const izinli = allowedProfilesForType(newType, liability, isExport)
  if (currentProfile !== undefined && izinli.includes(currentProfile)) return currentProfile
  // İade temel faturayla düzenlenir — Schematron kuralı.
  if (
    (RETURN_TYPES as readonly string[]).includes(newType) &&
    izinli.includes(InvoiceProfile.TEMEL)
  )
    return InvoiceProfile.TEMEL
  return izinli[0] ?? InvoiceProfile.TEMEL
}

/**
 * Profil değiştiğinde fatura tipinin hâlâ geçerli olup olmadığını çözer.
 *
 * {@link resolveProfileForType}'ın aynası: kullanıcı formda profili
 * değiştirdiğinde eldeki tip o profile uymayabilir. Uyuyorsa tip korunur;
 * uymuyorsa profilin ilk izinli tipi seçilir.
 *
 * Tip korunmaya öncelik verilir, çünkü kullanıcı tipi bilinçli seçmiştir:
 * profil çoğu zaman gönderim biçimine, tip ise satışın niteliğine aittir.
 *
 * @param currentType - Formdaki mevcut fatura tipi
 * @param newProfile - Yeni seçilen profil
 * @param liability - Alıcının mükellefiyet durumu
 * @returns Korunan ya da önerilen fatura tipi
 *
 * @example
 * ```ts
 * // Uyuyorsa dokunulmaz
 * resolveTypeForProfile(InvoiceType.SATIS, InvoiceProfile.TICARI) // 'SATIS'
 * // Ticari faturada iade yok; profilin ilk tipine düşer
 * resolveTypeForProfile(InvoiceType.IADE, InvoiceProfile.TICARI)  // 'SATIS'
 * ```
 */
export const resolveTypeForProfile = (
  currentType: InvoiceTypeCode | undefined,
  newProfile: InvoiceProfileId,
  liability?: CustomerLiability,
): InvoiceTypeCode => {
  const izinli = allowedTypesForProfile(newProfile, liability)
  if (currentType !== undefined && izinli.includes(currentType)) return currentType
  return izinli[0] ?? InvoiceType.SATIS
}

/**
 * Bir fatura tipinde kullanılabilen muafiyet kodlarını döndürür.
 *
 * Muafiyet tablosundaki her kodun hangi belge tipine ait olduğu bilinir;
 * bu bilgi filtreleme için kullanılır. Yanlış tipte kod seçmek GİB
 * tarafından reddedilir.
 *
 * @param type - Fatura tipi
 * @returns O tipte kullanılabilen muafiyet kodları
 *
 * @example
 * ```ts
 * availableExemptions(InvoiceType.IHRAC_KAYITLI).map((e) => e.code) // ['701', '702', …]
 * availableExemptions(InvoiceType.ISTISNA).length                   // 84
 * ```
 */
export const availableExemptions = (
  type: InvoiceTypeCode | undefined,
  tables?: CodeTables,
): readonly ExemptionDefinition[] => {
  const tumu = [...(tables?.exemptions ?? []), ...EXEMPTION_DEFINITIONS]
  if (type === undefined) return tumu
  const hedef =
    type === InvoiceType.IHRAC_KAYITLI
      ? 'IHRACKAYITLI'
      : type === InvoiceType.OZEL_MATRAH
        ? 'OZELMATRAH'
        : type === InvoiceType.ISTISNA || type === InvoiceType.YTB_ISTISNA
          ? 'ISTISNA'
          : 'SATIS'
  return tumu.filter((e) => e.documentType === hedef)
}

/**
 * Bir fatura tipinde kullanılabilen tevkifat kodlarını döndürür.
 *
 * @param type - Fatura tipi
 * @returns Tevkifat kodları; tip tevkifat taşıyamıyorsa boş dizi
 *
 * @example
 * ```ts
 * availableWithholdings(InvoiceType.TEVKIFAT).length      // 52
 * availableWithholdings(InvoiceType.TEVKIFAT_IADE).length // 0 — bu tip taşıyamaz
 * ```
 */
export const availableWithholdings = (
  type: InvoiceTypeCode | undefined,
  tables?: CodeTables,
): readonly WithholdingDefinition[] =>
  iceren(WITHHOLDING_ALLOWED_TYPES, type)
    ? [...(tables?.withholdings ?? []), ...WITHHOLDING_DEFINITIONS]
    : []
