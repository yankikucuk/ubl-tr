import type { Decimal } from '../core/index.js'

/**
 * Okunan bir belgedeki taraf.
 *
 * Yazma tarafındaki taraf tipinden farklıdır ve bu bilinçlidir: okurken
 * belgede ne varsa o gelir, hiçbir alan türetilmez ya da varsayılan
 * değerle doldurulmaz. `undefined` bir alan, belgede o öğenin **olmadığı**
 * anlamına gelir.
 */
export interface ParsedParty {
  /** Vergi numarası — birincil `cac:PartyIdentification`. */
  readonly taxNumber?: string | undefined
  /** Numaranın şeması (`VKN`, `TCKN` ya da özel bir rol kodu). */
  readonly taxNumberScheme?: string | undefined
  /** Ek tanımlayıcılar; birincil olan dâhil değildir. */
  readonly identifications: readonly {
    readonly schemeId?: string | undefined
    readonly value: string
  }[]
  /** Ünvan — `cac:PartyName/cbc:Name`. */
  readonly name?: string | undefined
  /** Ticaret unvanı — `cac:PartyLegalEntity/cbc:RegistrationName`. */
  readonly legalRegistrationName?: string | undefined
  /** Vergi dairesi — `cac:PartyTaxScheme/cac:TaxScheme/cbc:Name`. */
  readonly taxOffice?: string | undefined
  /** Adres alanları, belgedeki hâliyle. */
  readonly address?:
    | {
        readonly street?: string | undefined
        readonly buildingNumber?: string | undefined
        readonly district?: string | undefined
        readonly city?: string | undefined
        readonly postalCode?: string | undefined
        readonly subDistrict?: string | undefined
        readonly country?: string | undefined
      }
    | undefined
  /** Telefon. */
  readonly phone?: string | undefined
  /** Faks. */
  readonly fax?: string | undefined
  /** E-posta. */
  readonly email?: string | undefined
  /** Web sitesi. */
  readonly website?: string | undefined
  /** Gerçek kişi bilgileri. */
  readonly person?:
    | {
        readonly firstName?: string | undefined
        readonly familyName?: string | undefined
        readonly nationalityId?: string | undefined
        readonly identityDocumentId?: string | undefined
      }
    | undefined
}

/** Okunan bir vergi alt toplamı. */
export interface ParsedTaxSubtotal {
  /** Vergi türü kodu — `cbc:TaxTypeCode`. */
  readonly code?: string | undefined
  /** Verginin adı. */
  readonly name?: string | undefined
  /** Yüzde oranı. */
  readonly rate?: Decimal | undefined
  /** Matrah. */
  readonly taxableAmount?: Decimal | undefined
  /** Vergi tutarı. */
  readonly taxAmount?: Decimal | undefined
  /** Muafiyet sebebi kodu. */
  readonly exemptionCode?: string | undefined
  /** Muafiyet sebebi açıklaması. */
  readonly exemptionReason?: string | undefined
}

/** Okunan bir fatura satırı. */
export interface ParsedInvoiceLine {
  /** Satır numarası. */
  readonly id?: string | undefined
  /** Satır notları. */
  readonly notes: readonly string[]
  /** Miktar. */
  readonly quantity?: Decimal | undefined
  /** Birim kodu — `unitCode` özniteliği. */
  readonly unitCode?: string | undefined
  /** Satır tutarı. */
  readonly lineExtensionAmount?: Decimal | undefined
  /** Birim fiyat — `cac:Price/cbc:PriceAmount`. */
  readonly unitPrice?: Decimal | undefined
  /** Ürün adı. */
  readonly itemName?: string | undefined
  /** Marka. */
  readonly brandName?: string | undefined
  /** Model. */
  readonly modelName?: string | undefined
  /** Kalem ek tanımlayıcıları. */
  readonly identifications: readonly {
    readonly schemeId?: string | undefined
    readonly value: string
  }[]
  /** Satır düzeyindeki vergi alt toplamları. */
  readonly taxSubtotals: readonly ParsedTaxSubtotal[]
  /** İskonto tutarı — `cac:AllowanceCharge/cbc:Amount`. */
  readonly discountAmount?: Decimal | undefined
}

/** Okunan belge toplamları. */
export interface ParsedMonetaryTotal {
  /** Satır toplamı. */
  readonly lineExtensionAmount?: Decimal | undefined
  /** Vergi hariç toplam. */
  readonly taxExclusiveAmount?: Decimal | undefined
  /** Vergi dâhil toplam. */
  readonly taxInclusiveAmount?: Decimal | undefined
  /** İskonto toplamı. */
  readonly allowanceTotalAmount?: Decimal | undefined
  /** Ödenecek tutar. */
  readonly payableAmount?: Decimal | undefined
}

/** Okunan bir e-fatura belgesi. */
export interface ParsedInvoice {
  /** Belge profili. */
  readonly profile?: string | undefined
  /** Fatura tipi. */
  readonly type?: string | undefined
  /** Belge numarası. */
  readonly id?: string | undefined
  /** ETTN. */
  readonly uuid?: string | undefined
  /** Düzenleme tarihi. */
  readonly issueDate?: string | undefined
  /** Düzenleme saati. */
  readonly issueTime?: string | undefined
  /** Belge para birimi. */
  readonly currencyCode?: string | undefined
  /** Belge notları; yazıyla tutar notu da bunların arasındadır. */
  readonly notes: readonly string[]
  /** Satıcı. */
  readonly supplier?: ParsedParty | undefined
  /** Alıcı. */
  readonly customer?: ParsedParty | undefined
  /** Aracı alıcı. */
  readonly buyerCustomer?: ParsedParty | undefined
  /** Satırlar. */
  readonly lines: readonly ParsedInvoiceLine[]
  /** Belge düzeyindeki vergi alt toplamları. */
  readonly taxSubtotals: readonly ParsedTaxSubtotal[]
  /** Tevkifat alt toplamları. */
  readonly withholdingSubtotals: readonly ParsedTaxSubtotal[]
  /** Toplam vergi — `cac:TaxTotal/cbc:TaxAmount`. */
  readonly taxAmount?: Decimal | undefined
  /** Toplam tevkifat. */
  readonly withholdingTaxAmount?: Decimal | undefined
  /** Belge toplamları. */
  readonly totals: ParsedMonetaryTotal
  /** İade atfı. */
  readonly billingReference?:
    | {
        readonly id?: string | undefined
        readonly issueDate?: string | undefined
        readonly uuid?: string | undefined
        readonly documentTypeCode?: string | undefined
      }
    | undefined
  /** Sipariş atfı. */
  readonly orderReference?:
    { readonly id?: string | undefined; readonly issueDate?: string | undefined } | undefined
  /** Ödeme bilgisi. */
  readonly paymentMeans?:
    | {
        readonly meansCode?: string | undefined
        readonly dueDate?: string | undefined
        readonly accountNumber?: string | undefined
        readonly note?: string | undefined
      }
    | undefined
  /** Döviz kuru. */
  readonly exchangeRate?:
    | {
        readonly sourceCurrencyCode?: string | undefined
        readonly targetCurrencyCode?: string | undefined
        readonly rate?: Decimal | undefined
      }
    | undefined
  /** Genel belge atıfları. */
  readonly additionalDocuments: readonly {
    readonly id?: string | undefined
    readonly issueDate?: string | undefined
    readonly documentTypeCode?: string | undefined
    readonly documentType?: string | undefined
    readonly description?: string | undefined
  }[]
}

/** Okunan bir e-İrsaliye satırı. */
export interface ParsedDespatchLine {
  /** Satır numarası. */
  readonly id?: string | undefined
  /** Sevk edilen miktar. */
  readonly quantity?: Decimal | undefined
  /** Birim kodu. */
  readonly unitCode?: string | undefined
  /** Ürün adı. */
  readonly itemName?: string | undefined
  /** Kalem ek tanımlayıcıları. */
  readonly identifications: readonly {
    readonly schemeId?: string | undefined
    readonly value: string
  }[]
}

/** Okunan bir e-İrsaliye belgesi. */
export interface ParsedDespatchAdvice {
  /** Belge profili. */
  readonly profile?: string | undefined
  /** İrsaliye tipi. */
  readonly type?: string | undefined
  /** Belge numarası. */
  readonly id?: string | undefined
  /** ETTN. */
  readonly uuid?: string | undefined
  /** Düzenleme tarihi. */
  readonly issueDate?: string | undefined
  /** Düzenleme saati. */
  readonly issueTime?: string | undefined
  /** Belge notları. */
  readonly notes: readonly string[]
  /** Malı gönderen. */
  readonly supplier?: ParsedParty | undefined
  /** Malı teslim alan. */
  readonly customer?: ParsedParty | undefined
  /** Sevkiyat bilgisi. */
  readonly shipment?:
    | {
        readonly id?: string | undefined
        readonly actualDespatchDate?: string | undefined
        readonly actualDespatchTime?: string | undefined
        readonly carrierParty?: ParsedParty | undefined
        readonly drivers: readonly {
          readonly firstName?: string | undefined
          readonly familyName?: string | undefined
          readonly nationalityId?: string | undefined
        }[]
        readonly licensePlates: readonly {
          readonly plateNumber: string
          readonly schemeId?: string | undefined
        }[]
      }
    | undefined
  /** Satırlar. */
  readonly lines: readonly ParsedDespatchLine[]
}
