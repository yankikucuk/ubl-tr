import { Namespace } from '../constants/index.js'
import { container, optionalContainer, optionalLeaf, leaf, type XmlElement } from '../core/index.js'
import { detectTaxIdentifierKind } from '../documents/index.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/** Bir tarafın posta adresi. */
export interface AddressInput {
  /** Cadde, sokak ve kapı bilgisi — `cbc:StreetName`. */
  readonly street?: string
  /** İlçe — `cbc:CitySubdivisionName`. GİB bunu zorunlu tutar. */
  readonly district: string
  /** İl — `cbc:CityName`. GİB bunu zorunlu tutar. */
  readonly city: string
  /** Posta kodu — `cbc:PostalZone`. */
  readonly postalCode?: string
  /**
   * Semt ya da bölge — `cbc:District`.
   *
   * `cbc:CitySubdivisionName` (ilçe) ile karıştırılmamalı; UBL adres
   * tipinde ikisi ayrı öğedir ve e-İrsaliye teslim adreslerinde ikisi de
   * yazılır.
   */
  readonly subDistrict?: string
  /** Ülke adı — `cac:Country/cbc:Name`. Varsayılan `Türkiye`. */
  readonly country?: string
}

/** Bir tarafa ait ek tanımlayıcı — `cac:PartyIdentification`. */
export interface PartyIdentificationInput {
  /** Tanımlayıcının türü — `schemeID` (ör. `MUSTERINO`, `MERSISNO`, `TICARETSICILNO`). */
  readonly schemeId: string
  /** Tanımlayıcının değeri. */
  readonly value: string
}

/** Fatura tarafı: satıcı ya da alıcı. */
export interface PartyInput {
  /** VKN (10 hane) ya da TCKN (11 hane). */
  readonly taxNumber: string
  /** Ünvan ya da ad soyad. */
  readonly name: string
  /** Vergi dairesi — `cac:PartyTaxScheme/cac:TaxScheme/cbc:Name`. */
  readonly taxOffice?: string
  /**
   * Posta adresi.
   *
   * GİB satıcı ve alıcı için zorunlu tutar. Taşıyıcı ve gümrük
   * beyannamesi düzenleyeni gibi yardımcı rollerde adres bulunmayabilir;
   * bu yüzden alan isteğe bağlıdır.
   */
  readonly address?: AddressInput
  /** Telefon. */
  readonly phone?: string
  /** Faks. */
  readonly fax?: string
  /** E-posta. */
  readonly email?: string
  /** Web sitesi — `cbc:WebsiteURI`. */
  readonly website?: string
  /**
   * Gerçek kişi ad ve soyadı.
   *
   * TCKN sahibi bir taraf için GİB `cac:Person` bloğunu zorunlu tutar ve
   * `cac:PartyName` yerine bunu bekler. Verilmezse {@link buildParty}
   * bunu `name` alanından türetir — ama türetme belirsizdir, bkz. oradaki
   * açıklama; çok parçalı adlarda bu alanı açıkça verin.
   */
  readonly person?: { readonly firstName: string; readonly familyName: string }
  /**
   * Birincil tanımlayıcının şeması — `schemeID`.
   *
   * Verilmezse vergi numarasının türünden (`VKN` / `TCKN`) belirlenir.
   * Gümrük beyannamesini düzenleyen taraf gibi özel rollerde GİB başka bir
   * şema bekler (ör. `ALICIDIBSATIRKOD`); o durumda bu alan kullanılır.
   */
  readonly identificationSchemeId?: string
  /**
   * Vergi numarası dışındaki tanımlayıcılar.
   *
   * Müşteri numarası (`MUSTERINO`), MERSİS numarası (`MERSISNO`) ve ticaret
   * sicil numarası (`TICARETSICILNO`) bu yolla yazılır.
   */
  readonly identifications?: readonly PartyIdentificationInput[]
  /**
   * Uyruk kodu — `cac:Person/cbc:NationalityID` (ISO 3166 iki harf).
   *
   * Yolcu beraberi eşya (tax free) faturalarında yabancı alıcının uyruğu.
   */
  readonly nationalityId?: string
  /**
   * Kimlik belgesi numarası — `cac:Person/cac:IdentityDocumentReference/cbc:ID`.
   *
   * Yolcu beraberi eşya faturalarında pasaport numarası.
   */
  readonly identityDocumentId?: string
  /**
   * Ticaret unvanı — `cac:PartyLegalEntity/cbc:RegistrationName`.
   *
   * Kamu ve ihracat profillerinde beklenir. Verilmezse blok yazılmaz.
   */
  readonly legalRegistrationName?: string
}

/**
 * Tam addan ad ve soyadı ayırır.
 *
 * Son sözcük soyadı, kalanı addır. Bu **kesin bir kural değildir**: çok
 * parçalı soyadlarında ("Van der Berg") ve unvan içeren adlarda yanlış
 * bölme yapar. Belirsizliği kütüphane çözemez — doğru bölmeyi yalnızca
 * veriyi giren bilir. Bu yüzden {@link PartyInput.person} alanı vardır ve
 * verildiğinde türetme hiç çalışmaz.
 *
 * @param fullName - Tam ad
 * @returns Ad ve soyadı
 *
 * @example
 * ```ts
 * splitPersonName('Ayşe Yılmaz')        // { firstName: 'Ayşe', familyName: 'Yılmaz' }
 * splitPersonName('Ayşe Nur Yılmaz')    // { firstName: 'Ayşe Nur', familyName: 'Yılmaz' }
 * splitPersonName('Yılmaz')             // { firstName: 'Yılmaz', familyName: 'Yılmaz' }
 * ```
 */
export const splitPersonName = (
  fullName: string,
): { readonly firstName: string; readonly familyName: string } => {
  const parcalar = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '')
  if (parcalar.length <= 1) {
    const tek = parcalar[0] ?? fullName
    return { firstName: tek, familyName: tek }
  }
  const soyad = parcalar[parcalar.length - 1] ?? ''
  return { firstName: parcalar.slice(0, -1).join(' '), familyName: soyad }
}

/**
 * Bir adresi UBL adres öğesine çevirir.
 *
 * `cbc:CitySubdivisionName`, `cbc:CityName` ve `cac:Country` GİB paketinde
 * **zorunludur** — stok OASIS şemasında isteğe bağlı olsalar bile. Boş bir
 * öğe şemadan geçer, hiç yazılmayan öğe geçmez; bu yüzden üçü her zaman
 * yazılır.
 *
 * @param address - Adres girdisi
 * @param elementName - Üretilecek öğenin adı; varsayılan `PostalAddress`.
 * Teslim adresinde `DeliveryAddress` kullanılır — iç yapı aynı, ad farklıdır.
 * @returns Adres öğesi
 *
 * @example
 * ```ts
 * buildPostalAddress({ district: 'Kadıköy', city: 'İstanbul' })
 * buildPostalAddress(teslimAdresi, 'DeliveryAddress')
 * ```
 */
export const buildPostalAddress = (
  address: AddressInput,
  elementName = 'PostalAddress',
): XmlElement =>
  container(CAC, elementName, [
    optionalLeaf(CBC, 'StreetName', address.street),
    leaf(CBC, 'CitySubdivisionName', address.district),
    leaf(CBC, 'CityName', address.city),
    optionalLeaf(CBC, 'PostalZone', address.postalCode),
    optionalLeaf(CBC, 'District', address.subDistrict),
    container(CAC, 'Country', [leaf(CBC, 'Name', address.country ?? 'Türkiye')]),
  ])

/**
 * Bir fatura tarafını UBL `cac:Party` öğesine çevirir.
 *
 * Vergi numarasının türü kontrol basamağından belirlenir ve `schemeID`
 * özniteliğine yazılır. Tür belirlenemezse `VKN`/`TCKN` uzunluktan
 * çıkarılır — numara geçersiz olsa bile belge üretilebilmelidir; doğrulama
 * ayrı bir adımdır ve çağıranın kararıdır.
 *
 * Gerçek kişi (TCKN) tarafında GİB `cac:Person` bekler; tüzel kişide
 * `cac:PartyName`. İkisi birlikte yazılmaz.
 *
 * @param party - Taraf girdisi
 * @param elementName - Üretilecek öğenin adı; varsayılan `Party`.
 * UBL'de `cac:IssuerParty`, `cac:SignatoryParty` gibi roller de birer
 * `PartyType`'tır: içerikleri aynıdır, öğe adı farklıdır. Bunları
 * `cac:Party` ile sarmalamak fazladan bir seviye ekler ve belgeyi şema
 * dışı bırakır.
 * @returns Taraf öğesi
 *
 * @example Tüzel kişi
 * ```ts
 * buildParty({
 *   taxNumber: '1234567890',
 *   name: 'Acme Ltd. Şti.',
 *   taxOffice: 'Kadıköy',
 *   address: { district: 'Kadıköy', city: 'İstanbul' },
 * })
 * ```
 *
 * @example Gerçek kişi — cac:Person yazılır
 * ```ts
 * buildParty({
 *   taxNumber: '10000000146',
 *   name: 'Ayşe Yılmaz',
 *   address: { district: 'Çankaya', city: 'Ankara' },
 *   person: { firstName: 'Ayşe', familyName: 'Yılmaz' },
 * })
 * ```
 */
export const buildParty = (party: PartyInput, elementName = 'Party'): XmlElement => {
  const kind =
    detectTaxIdentifierKind(party.taxNumber) ?? (party.taxNumber.length === 11 ? 'TCKN' : 'VKN')
  // TCKN sahibi taraf gerçek kişidir: GİB `cac:Person` bekler ve
  // `cac:PartyName` yazılmaz. Ad açıkça verilmediyse tam addan türetilir.
  //
  // Çıkarım YALNIZCA şema kendiliğinden belirlendiğinde yapılır. Şema açıkça
  // verilmişse (ör. `ALICIDIBSATIRKOD`) numara bir kimlik numarası değil rol
  // koduna aittir; on bir haneli olması onu gerçek kişi yapmaz.
  const person =
    party.person ??
    (party.identificationSchemeId === undefined && kind === 'TCKN'
      ? splitPersonName(party.name)
      : undefined)

  // Öğe sırası UBL 2.1 `cac:Party` sequence tanımına uyar. `cbc:WebsiteURI`
  // bu sıranın İLK öğesidir — sona koymak belgeyi şema dışı bırakır.
  return container(CAC, elementName, [
    optionalLeaf(CBC, 'WebsiteURI', party.website),
    container(CAC, 'PartyIdentification', [
      leaf(CBC, 'ID', party.taxNumber, [
        { name: 'schemeID', value: party.identificationSchemeId ?? kind },
      ]),
    ]),
    ...(party.identifications ?? []).map((kimlik) =>
      container(CAC, 'PartyIdentification', [
        leaf(CBC, 'ID', kimlik.value, [{ name: 'schemeID', value: kimlik.schemeId }]),
      ]),
    ),
    person === undefined ? container(CAC, 'PartyName', [leaf(CBC, 'Name', party.name)]) : undefined,
    party.address === undefined ? undefined : buildPostalAddress(party.address),
    // Gerçek kişide `cac:PartyTaxScheme` YAZILMAZ. GİB paketine karşı XSD
    // doğrulaması yapan bir ekip bu alanın gerçek kişide bulunmaması
    // gerektiğini bildirdi (gorkem-bwl/atlas#39). Vergi dairesi verilse bile
    // gerçek kişi tarafında atlanır.
    party.taxOffice === undefined || person !== undefined
      ? undefined
      : container(CAC, 'PartyTaxScheme', [
          container(CAC, 'TaxScheme', [leaf(CBC, 'Name', party.taxOffice)]),
        ]),
    party.legalRegistrationName === undefined
      ? undefined
      : container(CAC, 'PartyLegalEntity', [
          leaf(CBC, 'RegistrationName', party.legalRegistrationName),
        ]),
    optionalContainer(CAC, 'Contact', [
      optionalLeaf(CBC, 'Telephone', party.phone),
      optionalLeaf(CBC, 'Telefax', party.fax),
      optionalLeaf(CBC, 'ElectronicMail', party.email),
    ]),
    // `cac:Person` ad-soyad OLMADAN da yazılabilir: yolcu beraberi eşya
    // faturasında alıcı tüzel kişidir ama uyruk ve pasaport bilgisi yine
    // bu blokta taşınır. Öğe sırası UBL `cac:PersonType` sequence'ıdır.
    optionalContainer(CAC, 'Person', [
      person === undefined ? undefined : leaf(CBC, 'FirstName', person.firstName),
      person === undefined ? undefined : leaf(CBC, 'FamilyName', person.familyName),
      optionalLeaf(CBC, 'NationalityID', party.nationalityId),
      party.identityDocumentId === undefined
        ? undefined
        : container(CAC, 'IdentityDocumentReference', [leaf(CBC, 'ID', party.identityDocumentId)]),
    ]),
  ])
}

/** KDV iade aracı kurumu — `cac:TaxRepresentativeParty`. */
export interface TaxRepresentativeInput {
  /** Aracı kurumun vergi numarası — `schemeID="ARACIKURUMVKN"`. */
  readonly taxNumber: string
  /** Aracı kurumun adı. */
  readonly name: string
  /** GİB'in verdiği aracı kurum etiketi — `schemeID="ARACIKURUMETIKET"`. */
  readonly label?: string
}

/**
 * KDV iade aracı kurumunu `cac:TaxRepresentativeParty` öğesine çevirir.
 *
 * Yolcu beraberi eşya (tax free) faturalarında, KDV iadesini yürüten aracı
 * kurum bu blokta bildirilir. Sıradan bir taraftan farkı adres taşımaması
 * ve kimliklerin özel şemalarla (`ARACIKURUMVKN`, `ARACIKURUMETIKET`)
 * yazılmasıdır; bu yüzden {@link buildParty} ile üretilmez.
 *
 * @param temsilci - Aracı kurum bilgisi
 * @returns `cac:TaxRepresentativeParty` öğesi
 *
 * @example
 * ```ts
 * buildTaxRepresentativeParty({
 *   taxNumber: '9876543210',
 *   name: 'Turizm KDV İade Aracı',
 *   label: 'TAXFREE_INTERMEDIARY',
 * })
 * ```
 */
export const buildTaxRepresentativeParty = (temsilci: TaxRepresentativeInput): XmlElement =>
  container(CAC, 'TaxRepresentativeParty', [
    container(CAC, 'PartyIdentification', [
      leaf(CBC, 'ID', temsilci.taxNumber, [{ name: 'schemeID', value: 'ARACIKURUMVKN' }]),
    ]),
    temsilci.label === undefined
      ? undefined
      : container(CAC, 'PartyIdentification', [
          leaf(CBC, 'ID', temsilci.label, [{ name: 'schemeID', value: 'ARACIKURUMETIKET' }]),
        ]),
    container(CAC, 'PartyName', [leaf(CBC, 'Name', temsilci.name)]),
  ])
