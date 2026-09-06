import {
  type CodeTables,
  currencyDefinition,
  Currency,
  isValidExemptionCode,
  isProfileTypeAllowed,
  isValidPaymentMeansCode,
  isValidTaxCode,
  isValidUnitCode,
  Namespace,
  RETURN_TYPES,
  VAT_TAX_CODE,
  withholdingDefinition,
} from '../constants/index.js'
import {
  attribute,
  child,
  children,
  compare,
  decimal,
  type Decimal,
  sum,
  text,
  walk,
  type XmlElement,
} from '../core/index.js'
import { detectTaxIdentifierKind, isValidDocumentNumber } from '../documents/index.js'

import { toResult, type ValidationIssue, type ValidationResult } from './result.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/**
 * `PartyType` yapısındaki öğeler.
 *
 * UBL'de bu rollerin hepsi aynı içeriğe sahiptir; vergi numarası denetimi
 * hepsinde aynı biçimde çalışır.
 */
const PARTY_ELEMENTS = new Set([
  'Party',
  'IssuerParty',
  'CarrierParty',
  'SignatoryParty',
  'TaxRepresentativeParty',
])

/** e-Arşiv yatırım teşvik fatura tipleri. */
const YTB_EARSIV_TYPES = new Set([
  'YTBSATIS',
  'YTBIADE',
  'YTBISTISNA',
  'YTBTEVKIFAT',
  'YTBTEVKIFATIADE',
])

/** Yatırım teşvik kapsamındaki iade tipleri; KDV kuralı bunlara uygulanmaz. */
const YTB_RETURN_TYPES = new Set(['IADE', 'TEVKIFATIADE', 'YTBIADE', 'YTBTEVKIFATIADE'])

/** Yurt içi sayılan ülke adları. */
const TURKIYE = new Set(['türkiye', 'turkiye', 'turkey', 'tr'])

/** Bir adres öğesinin ülke adını okur. */
const ulkeIsmi = (adres: XmlElement): string | undefined => {
  const ulke = child(adres, CAC, 'Country')
  return ulke === undefined ? undefined : text(ulke, 'Name')
}

/**
 * `cac:LegalMonetaryTotal` içinde ondalık basamağı iki ile sınırlı alanlar.
 *
 * GİB'in ortak Schematron kuralı (`decimalCheck`) parasal alanlarda noktadan
 * sonra en fazla iki hane kabul eder ve bu kural yalnızca **belirli**
 * bağlamlara uygulanır: `cac:LegalMonetaryTotal`'ın beş alanı ile faturanın
 * kök `cac:TaxTotal/cbc:TaxAmount` alanı. Miktar ve birim fiyat bu kapsamda
 * **değildir** — onlara iki basamak dayatmak gerçek veriyi imha eder.
 */
const TWO_DECIMAL_FIELDS = [
  'LineExtensionAmount',
  'TaxExclusiveAmount',
  'TaxInclusiveAmount',
  'AllowanceTotalAmount',
  'PayableAmount',
] as const

/** Ondalık metnin nokta sonrası basamak sayısını verir. */
const decimalPlaces = (value: string): number => {
  const nokta = value.indexOf('.')
  return nokta === -1 ? 0 : value.length - nokta - 1
}

/** Metni ondalığa çevirir; çevrilemezse `undefined`. */
const toDecimal = (value: string | undefined): Decimal | undefined => {
  if (value === undefined) return undefined
  try {
    return decimal(value)
  } catch {
    return undefined
  }
}

/** {@link validateInvoiceRules} seçenekleri. */
export interface ValidateRulesOptions {
  /**
   * Gömülü GİB kod tablolarının önüne geçen ek tanımlar.
   *
   * Belgeyi üretirken hangi tabloyu kullandıysanız doğrularken de aynısını
   * verin; aksi hâlde kendi eklediğiniz kod doğrulamada "tanımsız" görünür.
   * Bkz. {@link CodeTables}.
   */
  readonly codeTables?: CodeTables
}

/**
 * Bir UBL-TR faturasını GİB'in iş kurallarına karşı doğrular.
 *
 * **Bu, GİB'in Schematron paketinin tamamı değildir.** Buradaki kurallar
 * kanıtlanabilir kaynaklardan derlenmiştir: GİB kılavuzları, kod listeleri
 * ve sahada doğrulanmış uygulamalar. Her kuralın gerekçesi kodda yazılıdır.
 * Kural eklendikçe kapsam genişleyecektir; **temiz sonuç, belgenin GİB
 * tarafından kabul edileceği garantisi değildir.**
 *
 * Yine de bu katman, şema doğrulamasının yakalayamadığı hata sınıfını
 * yakalar. XSD kod listelerini, tutar tutarlılığını ve profil-tip
 * eşleşmesini denetlemez; belge şemadan geçip karşı tarafta reddedilir.
 * En bilinen örneği kök `cbc:ID` alanına 16 haneli belge numarası yerine
 * kısa bir sıra kodu yazılmasıdır — belge `xmllint` ile doğrulanır, GİB
 * reddeder.
 *
 * @param root - Doğrulanacak faturanın kök öğesi
 * @returns Bulgular ve geçerlilik
 *
 * @example Kendi ürettiğimiz belgeyi denetlemek
 * ```ts
 * const { root } = buildInvoice(girdi)
 * const sonuc = validateInvoiceRules(root)
 * if (!sonuc.valid) throw new Error(sonuc.issues[0]?.message)
 * ```
 *
 * @example Gelen belgeyi denetlemek
 * ```ts
 * const { root } = parseDocument(partnerdenGelenXml)
 * validateInvoiceRules(root).issues.filter((i) => i.severity === 'error')
 * ```
 */
export const validateInvoiceRules = (
  root: XmlElement,
  options: ValidateRulesOptions = {},
): ValidationResult => {
  const tables = options.codeTables
  const issues: ValidationIssue[] = []
  const ekle = (
    code: string,
    path: string,
    message: string,
    severity: ValidationIssue['severity'] = 'error',
  ): void => {
    issues.push({ code, path, message, severity })
  }

  const kokAdi = root.name
  const profil = text(root, 'ProfileID')
  const tip = text(root, 'InvoiceTypeCode')
  const paraBirimi = text(root, 'DocumentCurrencyCode')

  // ── Belge numarası biçimi ────────────────────────────────────────────
  // GİB tüm e-belgelerde 16 haneli düzeni şart koşar: 3 harf + 4 haneli yıl
  // + 9 haneli sıra. Bu kural XSD'de DEĞİL, kılavuzda tanımlıdır.
  const belgeNo = text(root, 'ID')
  if (belgeNo !== undefined && !isValidDocumentNumber(belgeNo)) {
    ekle(
      'INVALID_DOCUMENT_NUMBER',
      `${kokAdi}/cbc:ID`,
      `"${belgeNo}" 16 haneli belge numarası biçiminde değil ` +
        '(3 harf + 4 haneli yıl + 9 haneli sıra).',
    )
  }

  // ── Belge numarasındaki yıl ile düzenleme tarihi ─────────────────────
  const tarih = text(root, 'IssueDate')
  if (belgeNo !== undefined && isValidDocumentNumber(belgeNo) && tarih !== undefined) {
    const numaraYili = belgeNo.slice(3, 7)
    const tarihYili = tarih.slice(0, 4)
    if (numaraYili !== tarihYili) {
      ekle(
        'DOCUMENT_NUMBER_YEAR_MISMATCH',
        `${kokAdi}/cbc:ID`,
        `Belge numarasındaki yıl (${numaraYili}) düzenleme tarihiyle (${tarihYili}) uyuşmuyor.`,
      )
    }
  }

  // ── Profil ve fatura tipi eşleşmesi ──────────────────────────────────
  // GİB bunu yalnızca Schematron düzeyinde denetler; XSD denetlemez.
  if (profil !== undefined && tip !== undefined && !isProfileTypeAllowed(profil, tip)) {
    ekle(
      'PROFILE_TYPE_MISMATCH',
      `${kokAdi}/cbc:InvoiceTypeCode`,
      `"${profil}" profilinde "${tip}" fatura tipi kullanılamaz.`,
    )
  }

  // ── İade faturasında asıl faturaya atıf ──────────────────────────────
  if (tip !== undefined && (RETURN_TYPES as readonly string[]).includes(tip)) {
    if (child(root, CAC, 'BillingReference') === undefined) {
      ekle(
        'MISSING_BILLING_REFERENCE',
        `${kokAdi}/cac:BillingReference`,
        `"${tip}" iade tipidir; iade edilen faturaya atıf zorunludur.`,
      )
    }
  }

  // ── Satır sayısı ─────────────────────────────────────────────────────
  const satirlar = children(root, CAC, 'InvoiceLine')
  const bildirilenSayi = text(root, 'LineCountNumeric')
  if (bildirilenSayi !== undefined && bildirilenSayi !== String(satirlar.length)) {
    ekle(
      'LINE_COUNT_MISMATCH',
      `${kokAdi}/cbc:LineCountNumeric`,
      `Bildirilen satır sayısı ${bildirilenSayi}, belgede ${String(satirlar.length)} satır var.`,
    )
  }

  // ── Para birimi ──────────────────────────────────────────────────────
  if (paraBirimi !== undefined && !(paraBirimi in Currency)) {
    ekle(
      'UNKNOWN_CURRENCY',
      `${kokAdi}/cbc:DocumentCurrencyCode`,
      `"${paraBirimi}" tanınan para birimleri arasında değil. ` +
        'Kod geçerli olabilir; ondalık basamak sayısı varsayılan olarak 2 alınır.',
      'warning',
    )
  }

  // ── Toplam tutarların satırlarla tutarlılığı ─────────────────────────
  // GİB bu çapraz denetimi yapar: satır toplamı ile
  // `cac:LegalMonetaryTotal/cbc:LineExtensionAmount` tutmalıdır.
  const toplamlar = child(root, CAC, 'LegalMonetaryTotal')
  if (toplamlar !== undefined && satirlar.length > 0) {
    const satirToplami = sum(
      satirlar.flatMap((satir) => {
        const d = toDecimal(text(satir, 'LineExtensionAmount'))
        return d === undefined ? [] : [d]
      }),
    )
    const bildirilen = toDecimal(text(toplamlar, 'LineExtensionAmount'))
    if (bildirilen !== undefined && compare(satirToplami, bildirilen) !== 0) {
      ekle(
        'MONETARY_TOTAL_MISMATCH',
        `${kokAdi}/cac:LegalMonetaryTotal/cbc:LineExtensionAmount`,
        'Satır toplamı ile bildirilen satır tutarı toplamı uyuşmuyor.',
      )
    }
  }

  // ── Parasal alanlarda ondalık basamak sınırı ─────────────────────────
  if (toplamlar?.kind === 'container') {
    for (const alan of TWO_DECIMAL_FIELDS) {
      const deger = text(toplamlar, alan)
      if (deger !== undefined && decimalPlaces(deger) > 2) {
        ekle(
          'DECIMAL_PRECISION',
          `${kokAdi}/cac:LegalMonetaryTotal/cbc:${alan}`,
          `"${deger}" iki ondalık basamaktan fazla; parasal alanlarda en fazla iki hane yazılabilir.`,
        )
      }
    }
  }

  // ── Ağaç geneli denetimler ───────────────────────────────────────────
  for (const [oge, yol] of walk(root, kokAdi)) {
    // Birim kodu kod listesinden gelmeli; serbest metin kabul edilmez.
    // En sık hata, insan tarafından okunabilir adı ("Adet") kod alanına
    // yazmaktır; beklenen `C62`'dir.
    if (oge.name === 'InvoicedQuantity' || oge.name === 'DeliveredQuantity') {
      const birim = attribute(oge, 'unitCode')
      if (birim !== undefined && !isValidUnitCode(birim, tables)) {
        ekle(
          'UNKNOWN_UNIT_CODE',
          `${yol}/@unitCode`,
          `"${birim}" tanımlı bir birim kodu değil. Kod listesinden bir değer bekleniyor ` +
            '(ör. adet için "C62").',
        )
      }
    }

    // Vergi türü kodu kod listesinden gelmeli.
    if (oge.name === 'TaxTypeCode' && oge.kind === 'leaf') {
      const kod = oge.text
      const tevkifatMi = withholdingDefinition(kod, tables) !== undefined
      if (!tevkifatMi && !isValidTaxCode(kod, tables)) {
        ekle('UNKNOWN_TAX_TYPE_CODE', yol, `"${kod}" tanımlı bir vergi türü kodu değil.`)
      }
    }

    // Muafiyet kodu kod listesinden gelmeli.
    if (oge.name === 'TaxExemptionReasonCode' && oge.kind === 'leaf') {
      if (!isValidExemptionCode(oge.text, tables)) {
        ekle('UNKNOWN_EXEMPTION_CODE', yol, `"${oge.text}" tanımlı bir muafiyet kodu değil.`)
      }
    }

    // Vergi numarası kontrol basamağı — taraf bloklarında.
    //
    // Ağırlık bilerek UYARI: GİB'in Schematron paketi kontrol basamağını
    // denetlemez, dolayısıyla geçersiz bir numara belgeyi reddettirmez.
    // Ama gerçek hayatta kontrol basamağı tutmayan bir numara neredeyse
    // her zaman yazım hatasıdır; sessiz kalmak da doğru değildir.
    //
    // YABANCI TARAFLARA UYGULANMAZ: ihracat ve yolcu beraberi eşya
    // faturalarında alıcı yurt dışındadır ve numarası Türk VKN algoritmasına
    // uymaz — pratikte `schemeID="VKN"` ile yazılsa bile. Bu ayrım
    // yapılmazsa her ihracat faturası yanlış uyarı üretir.
    if (PARTY_ELEMENTS.has(oge.name) && oge.kind === 'container') {
      const ulke = child(oge, CAC, 'PostalAddress')
      const ulkeAdi = ulke === undefined ? undefined : ulkeIsmi(ulke)
      const yurtIci = ulkeAdi === undefined || TURKIYE.has(ulkeAdi.toLocaleLowerCase('tr'))
      if (yurtIci) {
        for (const kimlik of children(oge, CAC, 'PartyIdentification')) {
          const id = child(kimlik, CBC, 'ID')
          if (id?.kind !== 'leaf') continue
          const sema = attribute(id, 'schemeID')
          if (sema !== 'VKN' && sema !== 'TCKN') continue
          if (detectTaxIdentifierKind(id.text) === undefined) {
            ekle(
              'INVALID_TAX_IDENTIFIER',
              `${yol}/cac:PartyIdentification/cbc:ID`,
              `"${id.text}" kontrol basamağından geçemiyor; büyük olasılıkla yazım hatası. ` +
                'GİB bu denetimi yapmaz, belge reddedilmez.',
              'warning',
            )
          }
        }
      }
    }
  }

  // ── Tevkifat kodu ve oranı birlikte ──────────────────────────────────
  // GİB'in Schematron kuralı kodu ve yüzdeyi TEK bir dize olarak sabit bir
  // listede arar; kod doğru ama oran farklıysa belge reddedilir.
  for (const tevkifat of children(root, CAC, 'WithholdingTaxTotal')) {
    for (const altToplam of children(tevkifat, CAC, 'TaxSubtotal')) {
      const kategori = child(altToplam, CAC, 'TaxCategory')
      const sema = kategori === undefined ? undefined : child(kategori, CAC, 'TaxScheme')
      const kod = sema === undefined ? undefined : text(sema, 'TaxTypeCode')
      const oran = text(altToplam, 'Percent')
      if (kod === undefined) continue
      const tanim = withholdingDefinition(kod, tables)
      if (tanim === undefined) {
        ekle(
          'UNKNOWN_WITHHOLDING_CODE',
          `${kokAdi}/cac:WithholdingTaxTotal/cac:TaxSubtotal`,
          `"${kod}" tanımlı bir tevkifat kodu değil.`,
        )
      } else if (oran !== undefined) {
        const beklenen = decimal(tanim.rate)
        const yazilan = toDecimal(oran)
        if (yazilan !== undefined && compare(beklenen, yazilan) !== 0) {
          ekle(
            'WITHHOLDING_RATE_MISMATCH',
            `${kokAdi}/cac:WithholdingTaxTotal/cac:TaxSubtotal/cbc:Percent`,
            `"${kod}" tevkifat kodunun oranı %${String(tanim.rate)} olmalı, "${oran}" yazılmış. ` +
              'GİB kodu ve oranı birlikte denetler.',
          )
        }
      }
    }
  }

  // ── KDV alt toplamında vergi kodu ────────────────────────────────────
  for (const vergiToplami of children(root, CAC, 'TaxTotal')) {
    for (const altToplam of children(vergiToplami, CAC, 'TaxSubtotal')) {
      const kategori = child(altToplam, CAC, 'TaxCategory')
      if (kategori === undefined) continue
      const sema = child(kategori, CAC, 'TaxScheme')
      const kod = sema === undefined ? undefined : text(sema, 'TaxTypeCode')
      const muafiyet = text(kategori, 'TaxExemptionReasonCode')
      const vergiTutari = toDecimal(text(altToplam, 'TaxAmount'))
      // İstisna ve ihraç kayıtlı faturalarda KDV sıfırdır ve muafiyet
      // sebebi kodu zorunlu hâle gelir.
      if (
        kod === VAT_TAX_CODE &&
        vergiTutari !== undefined &&
        compare(vergiTutari, decimal('0')) === 0 &&
        tip !== undefined &&
        (tip === 'ISTISNA' || tip === 'IHRACKAYITLI' || tip === 'YTBISTISNA') &&
        muafiyet === undefined
      ) {
        ekle(
          'MISSING_EXEMPTION_CODE',
          `${kokAdi}/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory`,
          `"${tip}" tipinde KDV sıfırdır; muafiyet sebebi kodu zorunludur.`,
        )
      }
    }
  }

  // ── HKS künye numarası ───────────────────────────────────────────────
  // GİB'in HKS profili için tek şartı her kalemde künye numarasıdır.
  if (profil === 'HKS') {
    for (const [i, satir] of satirlar.entries()) {
      const kalem = child(satir, CAC, 'Item')
      const kimlikler =
        kalem === undefined ? [] : children(kalem, CAC, 'AdditionalItemIdentification')
      const kunye = kimlikler.some((k) => {
        const id = child(k, CBC, 'ID')
        return id !== undefined && attribute(id, 'schemeID') === 'KUNYENO'
      })
      if (!kunye) {
        ekle(
          'HKS_MISSING_KUNYENO',
          `${kokAdi}/cac:InvoiceLine[${String(i + 1)}]/cac:Item`,
          'HKS profilinde her kalemde künye numarası (KUNYENO) zorunludur.',
        )
      }
    }
  }

  // ── Para birimi öznitelikleri belge para birimiyle aynı olmalı ───────
  if (paraBirimi !== undefined) {
    const basamak = currencyDefinition(paraBirimi, tables).minorUnits
    if (toplamlar?.kind === 'container') {
      for (const alan of TWO_DECIMAL_FIELDS) {
        const oge = child(toplamlar, CBC, alan)
        if (oge === undefined) continue
        const oznitelik = attribute(oge, 'currencyID')
        if (oznitelik !== undefined && oznitelik !== paraBirimi) {
          ekle(
            'CURRENCY_MISMATCH',
            `${kokAdi}/cac:LegalMonetaryTotal/cbc:${alan}/@currencyID`,
            `Alan para birimi "${oznitelik}", belge para birimi "${paraBirimi}".`,
          )
        }
        if (oge.kind === 'leaf' && decimalPlaces(oge.text) !== basamak) {
          ekle(
            'DECIMAL_SCALE_MISMATCH',
            `${kokAdi}/cac:LegalMonetaryTotal/cbc:${alan}`,
            `"${paraBirimi}" ${String(basamak)} ondalık basamak ister, ` +
              `"${oge.text}" ${String(decimalPlaces(oge.text))} basamak yazılmış.`,
            'warning',
          )
        }
      }
    }
  }

  // ── Gerçek kişide vergi dairesi bloğu ────────────────────────────────
  // GİB paketine karşı XSD doğrulaması yapan bir ekip, gerçek kişi
  // tarafında `cac:PartyTaxScheme` bulunmaması gerektiğini bildirdi.
  for (const [oge, yol] of walk(root, kokAdi)) {
    if (!PARTY_ELEMENTS.has(oge.name) || oge.kind !== 'container') continue

    const kisi = child(oge, CAC, 'Person')
    if (kisi !== undefined && child(oge, CAC, 'PartyTaxScheme') !== undefined) {
      ekle(
        'NATURAL_PERSON_TAX_SCHEME',
        `${yol}/cac:PartyTaxScheme`,
        'Gerçek kişi tarafında vergi dairesi bloğu (cac:PartyTaxScheme) yazılmaz.',
      )
    }

    // ── Adresin zorunlu alanları ──────────────────────────────────────
    // GİB paketinde ilçe, il ve ülke zorunludur; stok OASIS şemasında
    // isteğe bağlı olsalar bile. Boş bir öğe geçer, hiç yazılmayan geçmez.
    const adres = child(oge, CAC, 'PostalAddress')
    if (adres !== undefined) {
      for (const alan of ['CitySubdivisionName', 'CityName'] as const) {
        if (text(adres, alan) === undefined) {
          ekle(
            'MISSING_MANDATORY_ADDRESS_FIELD',
            `${yol}/cac:PostalAddress/cbc:${alan}`,
            `Adreste "${alan}" zorunludur; GİB paketi bu alanı stok UBL'den farklı olarak şart koşar.`,
          )
        }
      }
      if (child(adres, CAC, 'Country') === undefined) {
        ekle(
          'MISSING_MANDATORY_ADDRESS_FIELD',
          `${yol}/cac:PostalAddress/cac:Country`,
          'Adreste ülke bloğu zorunludur.',
        )
      }
    }
  }

  // ── İhraç kayıtlı 702: GTİP ve alıcı satır kodu ──────────────────────
  // Muafiyet kodu 702 kullanıldığında HER satırda gümrük bilgisi aranır:
  // 12 haneli GTİP ve 11 haneli alıcı satır kodu.
  const muafiyetKodlari = new Set<string>()
  for (const [oge] of walk(root, kokAdi)) {
    if (oge.name === 'TaxExemptionReasonCode' && oge.kind === 'leaf') {
      muafiyetKodlari.add(oge.text)
    }
  }
  if (tip === 'IHRACKAYITLI' && muafiyetKodlari.has('702')) {
    for (const [i, satir] of satirlar.entries()) {
      const teslim = child(satir, CAC, 'Delivery')
      const sevkiyat = teslim === undefined ? undefined : child(teslim, CAC, 'Shipment')
      const mal = sevkiyat === undefined ? undefined : child(sevkiyat, CAC, 'GoodsItem')
      const gtip = mal === undefined ? undefined : text(mal, 'RequiredCustomsID')
      const birim =
        sevkiyat === undefined ? undefined : child(sevkiyat, CAC, 'TransportHandlingUnit')
      const beyanname = birim === undefined ? undefined : child(birim, CAC, 'CustomsDeclaration')
      const duzenleyen = beyanname === undefined ? undefined : child(beyanname, CAC, 'IssuerParty')
      const satirKodu =
        duzenleyen === undefined
          ? undefined
          : children(duzenleyen, CAC, 'PartyIdentification')
              .map((k) => child(k, CBC, 'ID'))
              .find((id) => id !== undefined && attribute(id, 'schemeID') === 'ALICIDIBSATIRKOD')

      if (gtip?.length !== 12) {
        ekle(
          'IHRACKAYITLI_MISSING_CUSTOMS_ID',
          `${kokAdi}/cac:InvoiceLine[${String(i + 1)}]/cac:Delivery`,
          '702 muafiyet kodunda her satırda 12 haneli GTİP numarası zorunludur.',
        )
      }
      if (satirKodu?.kind !== 'leaf' || satirKodu.text.length !== 11) {
        ekle(
          'IHRACKAYITLI_MISSING_BUYER_LINE_CODE',
          `${kokAdi}/cac:InvoiceLine[${String(i + 1)}]/cac:Delivery`,
          '702 muafiyet kodunda her satırda 11 haneli alıcı satır kodu (ALICIDIBSATIRKOD) zorunludur.',
        )
      }
    }
  }

  // ── Şarj hizmeti (SARJ / SARJANLIK) ──────────────────────────────────
  // Kurallar profile DEĞİL fatura tipine bakar.
  if (tip === 'SARJ' || tip === 'SARJANLIK') {
    const donem = child(root, CAC, 'InvoicePeriod')
    if (donem === undefined) {
      ekle(
        'ENERJI_MISSING_INVOICE_PERIOD',
        `${kokAdi}/cac:InvoicePeriod`,
        'Şarj hizmeti faturalarında fatura dönemi zorunludur.',
      )
    } else {
      for (const alan of ['StartDate', 'StartTime', 'EndDate', 'EndTime'] as const) {
        if (text(donem, alan) === undefined) {
          ekle(
            'ENERJI_INCOMPLETE_INVOICE_PERIOD',
            `${kokAdi}/cac:InvoicePeriod/cbc:${alan}`,
            `Şarj hizmeti faturasında dönem "${alan}" alanı zorunludur.`,
          )
        }
      }
    }

    const musteri = child(root, CAC, 'AccountingCustomerParty')
    const taraf = musteri === undefined ? undefined : child(musteri, CAC, 'Party')
    const plaka =
      taraf === undefined
        ? false
        : children(taraf, CAC, 'PartyIdentification').some((k) => {
            const id = child(k, CBC, 'ID')
            return id !== undefined && attribute(id, 'schemeID') === 'PLAKA'
          })
    if (!plaka) {
      ekle(
        'ENERJI_MISSING_PLATE',
        `${kokAdi}/cac:AccountingCustomerParty`,
        'Şarj hizmeti faturalarında alıcı tarafında plaka (schemeID="PLAKA") zorunludur.',
      )
    }
  }

  // SARJ'a özgü: ESU rapor kimliği. SARJANLIK bu kuralın KAPSAMINDA DEĞİL.
  if (tip === 'SARJ') {
    const esu = children(root, CAC, 'AdditionalDocumentReference').some((b) => {
      const id = child(b, CBC, 'ID')
      return id !== undefined && attribute(id, 'schemeID') === 'ESURaporID'
    })
    if (!esu) {
      ekle(
        'ENERJI_MISSING_ESU_REPORT',
        `${kokAdi}/cac:AdditionalDocumentReference`,
        'SARJ faturalarında schemeID="ESURaporID" taşıyan bir ek belge zorunludur.',
      )
    }
  }

  // ── Ödeme şekli kodu ─────────────────────────────────────────────────
  // Kod listesinden gelmeli; serbest metin kabul edilmez.
  for (const odeme of children(root, CAC, 'PaymentMeans')) {
    const kod = text(odeme, 'PaymentMeansCode')
    if (kod !== undefined && !isValidPaymentMeansCode(kod)) {
      ekle(
        'UNKNOWN_PAYMENT_MEANS_CODE',
        `${kokAdi}/cac:PaymentMeans/cbc:PaymentMeansCode`,
        `"${kod}" tanımlı bir ödeme şekli kodu değil.`,
      )
    }
  }

  // ── Kamu profili: aracı alıcı ────────────────────────────────────────
  if (profil === 'KAMU' && child(root, CAC, 'BuyerCustomerParty') === undefined) {
    ekle(
      'KAMU_MISSING_BUYER_CUSTOMER',
      `${kokAdi}/cac:BuyerCustomerParty`,
      'Kamu profilinde alıcı kurum (cac:BuyerCustomerParty) zorunludur.',
    )
  }

  // ── Demirbaş KDV (555) sıfır KDV ile kullanılamaz ────────────────────
  if (muafiyetKodlari.has('555')) {
    for (const vergiToplami of children(root, CAC, 'TaxTotal')) {
      for (const altToplam of children(vergiToplami, CAC, 'TaxSubtotal')) {
        const kategori = child(altToplam, CAC, 'TaxCategory')
        if (kategori === undefined || text(kategori, 'TaxExemptionReasonCode') !== '555') continue
        const oran = toDecimal(text(altToplam, 'Percent'))
        if (oran !== undefined && compare(oran, decimal('0')) === 0) {
          ekle(
            'DEMIRBAS_KDV_ZERO_RATE',
            `${kokAdi}/cac:TaxTotal/cac:TaxSubtotal/cbc:Percent`,
            '555 (demirbaş KDV) kodu sıfır KDV oranıyla kullanılamaz.',
          )
        }
      }
    }
  }

  // ── Yatırım teşvik ───────────────────────────────────────────────────
  const ytbKapsam =
    profil === 'YATIRIMTESVIK' ||
    (profil === 'EARSIVFATURA' && tip !== undefined && YTB_EARSIV_TYPES.has(tip))
  const ytbIade = tip !== undefined && YTB_RETURN_TYPES.has(tip)
  if (ytbKapsam && !ytbIade) {
    // Yatırım teşvik faturasında KDV oranı ve tutarı SIFIR OLAMAZ; teşvik
    // "vazgeçilen KDV" olarak gösterilir, hesap yine yapılır.
    for (const vergiToplami of children(root, CAC, 'TaxTotal')) {
      for (const altToplam of children(vergiToplami, CAC, 'TaxSubtotal')) {
        const kategori = child(altToplam, CAC, 'TaxCategory')
        const sema = kategori === undefined ? undefined : child(kategori, CAC, 'TaxScheme')
        if (sema === undefined || text(sema, 'TaxTypeCode') !== VAT_TAX_CODE) continue
        const oran = toDecimal(text(altToplam, 'Percent'))
        const tutar = toDecimal(text(altToplam, 'TaxAmount'))
        if (
          (oran !== undefined && compare(oran, decimal('0')) === 0) ||
          (tutar !== undefined && compare(tutar, decimal('0')) === 0)
        ) {
          ekle(
            'YTB_ZERO_VAT',
            `${kokAdi}/cac:TaxTotal/cac:TaxSubtotal`,
            'Yatırım teşvik faturasında KDV oranı ve tutarı sıfır olamaz.',
          )
        }
      }
    }

    // Harcama tipi 01 (makine-teçhizat) kaleminde marka ve model zorunlu.
    for (const [i, satir] of satirlar.entries()) {
      const kalem = child(satir, CAC, 'Item')
      if (kalem === undefined) continue
      const sinif = children(kalem, CAC, 'CommodityClassification')
        .map((c) => text(c, 'ItemClassificationCode'))
        .find((c) => c !== undefined)
      if (sinif !== '01') continue
      for (const alan of ['BrandName', 'ModelName'] as const) {
        if (text(kalem, alan) === undefined) {
          ekle(
            'YTB_MISSING_ITEM_DETAIL',
            `${kokAdi}/cac:InvoiceLine[${String(i + 1)}]/cac:Item/cbc:${alan}`,
            `Yatırım teşvik harcama tipi 01 kaleminde "${alan}" zorunludur.`,
          )
        }
      }
    }
  }

  return toResult(issues)
}
