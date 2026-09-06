import {
  type CodeTables,
  currencyDefinition,
  DEFAULT_CURRENCY_CODE,
  DEFAULT_UNIT_CODE,
  taxDefinition,
  VAT_TAX_CODE,
  VAT_TAX_NAME,
  withholdingDefinition,
} from '../../constants/index.js'
import {
  add,
  compare,
  decimal,
  type Decimal,
  isZero,
  multiply,
  negate,
  percentage,
  rescale,
  subtract,
  sum,
} from '../../core/index.js'
import { DocumentInputError } from '../errors.js'

/** Sayı, metin ya da hazır ondalık olarak verilebilen değer. */
export type NumericInput = number | string | Decimal

/** Bir kaleme ait ek tanımlayıcı. */
export interface AdditionalItemIdentificationInput {
  /** Tanımlayıcının türü — `schemeID` özniteliği (ör. `KUNYENO`). */
  readonly schemeId: string
  /** Tanımlayıcının değeri. */
  readonly value: string
}

/** KDV dışında bir satıra uygulanan vergi. */
export interface LineTaxInput {
  /** GİB vergi türü kodu (ör. `0071` ÖTV 1. Liste). */
  readonly code: string
  /** Yüzde oranı. */
  readonly rate: NumericInput
}

/** Bir fatura satırının girdisi. */
export interface InvoiceLineInput {
  /** Ürün ya da hizmet adı. */
  readonly name: string
  /** Miktar. Kesirli olabilir. */
  readonly quantity: NumericInput
  /** Birim fiyat. Para biriminin ondalığından daha hassas olabilir. */
  readonly unitPrice: NumericInput
  /** UN/ECE Rec 20 birim kodu; varsayılan `C62` (adet). */
  readonly unitCode?: string
  /** KDV oranı yüzde olarak (%20 için `20`). */
  readonly vatRate: NumericInput
  /**
   * KDV matrahı — satır tutarından bağımsız verildiğinde.
   *
   * ÖZELMATRAH faturalarında KDV, satılan malın bedeli üzerinden değil
   * ayrı belirlenmiş bir matrah üzerinden hesaplanır: telefon kartı,
   * piyango bileti, ikinci el araç satışı gibi. Verildiğinde
   * `cbc:TaxableAmount` bu değerdir ve ek vergilerin matraha etkisi
   * UYGULANMAZ — matrahı kullanıcı zaten nihai hâliyle vermiştir.
   *
   * Verilmezse matrah satır tutarından türetilir ve ek vergilerin
   * artırıcı/azaltıcı etkisi işlenir.
   */
  readonly vatBaseAmount?: NumericInput
  /** İskonto oranı yüzde olarak. {@link discountAmount} ile birlikte verilemez. */
  readonly discountRate?: NumericInput
  /** İskonto tutarı. {@link discountRate} ile birlikte verilemez. */
  readonly discountAmount?: NumericInput
  /** KDV tevkifatı kodu (ör. `603`). Oran koddan gelir. */
  readonly withholdingCode?: string
  /** KDV muafiyet sebebi kodu (ör. `351`). */
  readonly exemptionCode?: string
  /** Muafiyet sebebinin açıklaması. */
  readonly exemptionReason?: string
  /** KDV dışındaki vergiler (ÖTV, damga vergisi, ÖİV …). */
  readonly taxes?: readonly LineTaxInput[]
  /**
   * Kaleme ait ek tanımlayıcılar — `cac:AdditionalItemIdentification`.
   *
   * Bazı profiller bunu zorunlu kılar: HKS'de her kalemde 19 karakterlik
   * künye numarası (`KUNYENO`), ilaç ve tıbbi cihazda takip numarası,
   * İDİS'te sistem numarası.
   */
  readonly additionalIdentifications?: readonly AdditionalItemIdentificationInput[]
  /**
   * Satır düzeyinde ek iskonto ve yükler.
   *
   * `discountRate` / `discountAmount` ile birlikte kullanılabilir: o ikisi
   * asıl iskontoyu, bu liste kalemi etkileyen diğer indirim ve masrafları
   * taşır. Hepsi `cbc:LineExtensionAmount`'a ve dolayısıyla KDV matrahına
   * girer.
   */
  readonly allowanceCharges?: readonly AllowanceChargeInput[]
}

/** Hesaplanmış bir vergi alt toplamı. */
export interface TaxSubtotal {
  /** Vergi türü kodu. */
  readonly code: string
  /** Verginin adı. */
  readonly name: string
  /** Yüzde oranı. */
  readonly rate: Decimal
  /** Verginin matrahı. */
  readonly taxableAmount: Decimal
  /** Vergi tutarı. */
  readonly taxAmount: Decimal
  /**
   * KDV muafiyet sebebi kodu.
   *
   * İstisna faturalarında bu kod hem satır hem belge düzeyindeki
   * `cac:TaxCategory` bloklarında yazılır. Yalnızca satır düzeyinde
   * yazmak, belge düzeyindeki kategoriyi kodsuz bırakır ve GİB'in istisna
   * denetimi orada da kodu arar.
   */
  readonly exemptionCode?: string
  /** Muafiyet sebebinin açıklaması. */
  readonly exemptionReason?: string
}

/**
 * İskonto ya da ek yük — `cac:AllowanceCharge`.
 *
 * Hem satır hem belge düzeyinde kullanılır. `amount` zorunludur;
 * `multiplierFactor` ve `baseAmount` yalnızca belgeye yazılan açıklayıcı
 * alanlardır, tutar onlardan hesaplanmaz. Böylece kaynağı ne olursa olsun
 * (elle girilen tutar, oran, karma) belgeye giren sayı tek ve kesindir.
 *
 * Etkisi düzeye göre değişir:
 *
 * - **Satır düzeyinde** tutar `cbc:LineExtensionAmount`'a girer, dolayısıyla
 *   KDV matrahını da değiştirir. Satırın tek bir KDV oranı olduğu için bu
 *   iyi tanımlıdır.
 * - **Belge düzeyinde** tutar vergiden SONRA `cbc:PayableAmount`'a uygulanır;
 *   KDV yeniden hesaplanmaz. Satırlar farklı oranlar taşıyabildiğinden
 *   belge düzeyinde bir iskontonun hangi oranı azaltacağı tanımsızdır.
 *   KDV matrahını da düşürmesi gereken bir iskonto satıra yazılmalıdır.
 */
export interface AllowanceChargeInput {
  /** `true` ek yük (masraf), `false` iskonto — `cbc:ChargeIndicator`. */
  readonly isCharge: boolean
  /** Tutar — `cbc:Amount`. */
  readonly amount: NumericInput
  /** Gerekçe kodu — `cbc:AllowanceChargeReasonCode`. */
  readonly reasonCode?: string
  /** Gerekçe — `cbc:AllowanceChargeReason`. */
  readonly reason?: string
  /**
   * Çarpan, **yüzde** olarak — `cbc:MultiplierFactorNumeric`.
   *
   * `10` verilirse belgeye `0.1` yazılır; satır iskontosundaki
   * `discountRate` ile aynı sözleşme.
   */
  readonly multiplierFactor?: NumericInput
  /** Çarpanın uygulandığı baz tutar — `cbc:BaseAmount`. */
  readonly baseAmount?: NumericInput
}

/** Hesaplanmış bir satır. */
export interface CalculatedLine {
  /** Satırın bir tabanlı sıra numarası; `cbc:ID` olarak yazılır. */
  readonly id: number
  /** Hesaplamanın kaynağı olan girdi. */
  readonly input: InvoiceLineInput
  /** Ondalığa çevrilmiş miktar. */
  readonly quantity: Decimal
  /** Ondalığa çevrilmiş birim fiyat. */
  readonly unitPrice: Decimal
  /** Ondalığa çevrilmiş KDV oranı (yüzde). */
  readonly vatRate: Decimal
  /** Miktar × birim fiyat; **yuvarlanmamış**. */
  readonly grossAmount: Decimal
  /** İskonto tutarı. */
  readonly discountAmount: Decimal
  /** Satır düzeyindeki ek iskontoların toplamı. */
  readonly allowanceAmount: Decimal
  /** Satır düzeyindeki ek yüklerin toplamı. */
  readonly chargeAmount: Decimal
  /** İskonto ve yükler işlenmiş satır tutarı — `cbc:LineExtensionAmount`. */
  readonly lineExtensionAmount: Decimal
  /** Ek vergilerle değişmiş KDV matrahı. */
  readonly vatBase: Decimal
  /** KDV tutarı. */
  readonly vatAmount: Decimal
  /** Tevkifat tutarı; tevkifat kodu verilmemişse `undefined`. */
  readonly withholdingAmount?: Decimal
  /** KDV dışındaki vergiler. */
  readonly taxes: readonly TaxSubtotal[]
}

/** Hesaplanmış bir faturanın tamamı. */
export interface CalculatedInvoice {
  /** Belgenin para birimi. */
  readonly currencyCode: string
  /** Hesaplanmış satırlar. */
  readonly lines: readonly CalculatedLine[]
  /** Orana göre gruplanmış KDV alt toplamları. */
  readonly vatSubtotals: readonly TaxSubtotal[]
  /** KDV dışındaki vergilerin alt toplamları. */
  readonly otherTaxSubtotals: readonly TaxSubtotal[]
  /** Tevkifat alt toplamları. */
  readonly withholdingSubtotals: readonly TaxSubtotal[]
  /** Satır toplamı — `cbc:LineExtensionAmount`. */
  readonly lineExtensionAmount: Decimal
  /** İskonto toplamı — `cbc:AllowanceTotalAmount`. */
  readonly allowanceTotalAmount: Decimal
  /**
   * Ek yük toplamı — `cbc:ChargeTotalAmount`.
   *
   * Satır ve belge düzeyindeki yüklerin toplamı; yük yoksa sıfırdır ve
   * öğe belgeye yazılmaz.
   */
  readonly chargeTotalAmount: Decimal
  /** Vergi hariç toplam — `cbc:TaxExclusiveAmount`. */
  readonly taxExclusiveAmount: Decimal
  /** Vergi dâhil toplam — `cbc:TaxInclusiveAmount`. */
  readonly taxInclusiveAmount: Decimal
  /** Toplam KDV. */
  readonly vatTotalAmount: Decimal
  /**
   * KDV dışı vergilerin mutlak toplamı.
   *
   * `cac:TaxTotal/cbc:TaxAmount` bu değer ile toplam KDV'nin toplamıdır;
   * işaret uygulanmaz.
   */
  readonly otherTaxTotalAmount: Decimal
  /** Toplam tevkifat. */
  readonly withholdingTotalAmount: Decimal
  /** Ödenecek tutar — `cbc:PayableAmount`. */
  readonly payableAmount: Decimal
}

/** Girdiyi ondalığa çevirir. */
const toDecimal = (value: NumericInput): Decimal =>
  typeof value === 'object' ? value : decimal(value)

/** Aynı kod ve orandaki alt toplamları birleştirir. */
const mergeSubtotals = (items: readonly TaxSubtotal[]): TaxSubtotal[] => {
  const gruplar: TaxSubtotal[] = []
  for (const item of items) {
    const mevcut = gruplar.findIndex(
      (g) => g.code === item.code && compare(g.rate, item.rate) === 0,
    )
    const bulunan = gruplar[mevcut]
    if (bulunan === undefined) {
      gruplar.push(item)
      continue
    }
    gruplar[mevcut] = {
      ...bulunan,
      taxableAmount: add(bulunan.taxableAmount, item.taxableAmount),
      taxAmount: add(bulunan.taxAmount, item.taxAmount),
    }
  }
  return gruplar
}

/**
 * Tek bir fatura satırını hesaplar.
 *
 * Hesap sırası mevzuatın gerektirdiği sıradır ve **hiçbir adımda yuvarlama
 * yapılmaz**; yuvarlama yalnızca tutar XML'e yazılırken uygulanır. Ara
 * adımlarda yuvarlamak, çok satırlı faturalarda `cac:LegalMonetaryTotal`
 * ile satır toplamlarının bir-iki kuruş tutmamasına yol açar ve GİB bunu
 * çapraz denetler.
 *
 * 1. Brüt tutar = miktar × birim fiyat
 * 2. İskonto = orandan ya da doğrudan tutardan
 * 3. Satır tutarı = brüt − iskonto
 * 4. Ek vergiler (ÖTV, damga vergisi …) KDV matrahını artırır ya da azaltır
 * 5. KDV = değişmiş matrah × oran
 * 6. Tevkifat = KDV × tevkifat oranı
 *
 * @param input - Satır girdisi
 * @param id - Satırın bir tabanlı sıra numarası
 * @returns Hesaplanmış satır
 * @throws {RangeError} İskonto oranı ve tutarı birlikte verilmişse, ya da
 * bilinmeyen bir vergi/tevkifat kodu kullanılmışsa
 *
 * @example
 * ```ts
 * calculateLine({ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }, 1)
 * // lineExtensionAmount 1000, vatAmount 200
 * ```
 *
 * @example Tevkifatlı satır
 * ```ts
 * calculateLine(
 *   { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
 *   1,
 * )
 * // vatAmount 200, withholdingAmount 140 (200 × %70)
 * ```
 */
export const calculateLine = (
  input: InvoiceLineInput,
  id: number,
  tables?: CodeTables,
): CalculatedLine => {
  const quantity = toDecimal(input.quantity)
  const unitPrice = toDecimal(input.unitPrice)
  const grossAmount = multiply(quantity, unitPrice)

  if (input.discountRate !== undefined && input.discountAmount !== undefined) {
    throw new DocumentInputError(
      'DISCOUNT_RATE_AND_AMOUNT',
      `lines[${String(id - 1)}].discountRate`,
      `Satır ${String(id)}: iskonto oranı ve tutarı birlikte verilemez; biri seçilmelidir.`,
    )
  }
  const discountAmount =
    input.discountAmount !== undefined
      ? toDecimal(input.discountAmount)
      : input.discountRate !== undefined
        ? percentage(grossAmount, toDecimal(input.discountRate))
        : decimal('0', 2)

  const kalemler = input.allowanceCharges ?? []
  const allowanceAmount = sum(
    kalemler.filter((k) => !k.isCharge).map((k) => toDecimal(k.amount)),
    2,
  )
  const chargeAmount = sum(
    kalemler.filter((k) => k.isCharge).map((k) => toDecimal(k.amount)),
    2,
  )

  // Satır düzeyindeki iskonto ve yükler satır tutarına girer; KDV matrahı
  // da bu tutardan türediği için vergi doğru tabandan hesaplanır.
  const lineExtensionAmount = add(
    subtract(subtract(grossAmount, discountAmount), allowanceAmount),
    chargeAmount,
  )

  // Ek vergilerin KDV matrahına üç ayrı etkisi olabilir ve üçü de gerçek:
  // ÖTV matrahı ARTIRIR (KDV, ÖTV dâhil tutar üzerinden alınır), damga
  // vergisi gibi olanlar AZALTIR, stopaj ise matrahı hiç etkilemez ama
  // ödenecek tutardan düşer.
  const acikMatrah = input.vatBaseAmount === undefined ? undefined : toDecimal(input.vatBaseAmount)
  let vatBase = acikMatrah ?? lineExtensionAmount
  const taxes: TaxSubtotal[] = []
  for (const tax of input.taxes ?? []) {
    const tanim = taxDefinition(tax.code, tables)
    if (tanim === undefined) {
      throw new DocumentInputError(
        'UNKNOWN_TAX_TYPE_CODE',
        `lines[${String(id - 1)}].taxes`,
        `Satır ${String(id)}: bilinmeyen vergi türü kodu "${tax.code}".`,
      )
    }
    const rate = toDecimal(tax.rate)
    const taxAmount = percentage(lineExtensionAmount, rate)
    // Matrah açıkça verildiyse dokunulmaz: kullanıcının bildirdiği
    // özel matrahı ek vergilerle oynatmak onu yanlış yapardı.
    if (acikMatrah === undefined) {
      if (tanim.vatBaseEffect === 'increase') vatBase = add(vatBase, taxAmount)
      else if (tanim.vatBaseEffect === 'decrease') vatBase = subtract(vatBase, taxAmount)
    }
    taxes.push({
      code: tanim.code,
      name: tanim.shortName,
      rate,
      taxableAmount: lineExtensionAmount,
      taxAmount,
    })
  }

  const vatRate = toDecimal(input.vatRate)
  const vatAmount = percentage(vatBase, vatRate)

  let withholdingAmount: Decimal | undefined
  if (input.withholdingCode !== undefined) {
    const tanim = withholdingDefinition(input.withholdingCode, tables)
    if (tanim === undefined) {
      throw new DocumentInputError(
        'UNKNOWN_WITHHOLDING_CODE',
        `lines[${String(id - 1)}].withholdingCode`,
        `Satır ${String(id)}: bilinmeyen tevkifat kodu "${input.withholdingCode}".`,
      )
    }
    withholdingAmount = percentage(vatAmount, decimal(tanim.rate))
  }

  const temel = {
    id,
    input,
    quantity,
    unitPrice,
    vatRate,
    grossAmount,
    discountAmount,
    allowanceAmount,
    chargeAmount,
    lineExtensionAmount,
    vatBase,
    vatAmount,
    taxes,
  }
  return withholdingAmount === undefined ? temel : { ...temel, withholdingAmount }
}

/** {@link calculateInvoice} girdisi. */
export interface InvoiceTotalsInput {
  /** Fatura satırları; en az bir tane olmalı. */
  readonly lines: readonly InvoiceLineInput[]
  /**
   * Belge düzeyinde iskonto ve ek yükler.
   *
   * Vergiden SONRA ödenecek tutara uygulanır; KDV yeniden hesaplanmaz.
   * Bkz. {@link AllowanceChargeInput}.
   */
  readonly allowanceCharges?: readonly AllowanceChargeInput[]
  /** ISO 4217 para birimi kodu; varsayılan `TRY`. */
  readonly currencyCode?: string
  /**
   * Gömülü GİB kod tablolarının önüne geçen ek tanımlar.
   *
   * GİB yeni bir vergi türü, tevkifat ya da para birimi tanımı
   * yayımladığında sürüm beklemeden kullanmayı sağlar. Bkz.
   * {@link CodeTables}.
   */
  readonly codeTables?: CodeTables
}

/**
 * Bir faturanın tüm tutarlarını hesaplar.
 *
 * Alt toplamlar, aynı vergi kodu ve oranındaki satırlar birleştirilerek
 * kurulur — UBL-TR'de her `(kod, oran)` çifti için tek bir
 * `cac:TaxSubtotal` bulunur. Tevkifat da aynı biçimde gruplanır.
 *
 * Ödenecek tutar tevkifat düşülerek bulunur: tevkifat edilen KDV'yi satıcı
 * tahsil etmez, alıcı doğrudan beyan eder.
 *
 * @param input - Satırlar ve para birimi
 * @returns Hesaplanmış fatura tutarları
 * @throws {RangeError} Satır listesi boşsa ya da bir satır geçersizse
 *
 * @example Tek satır
 * ```ts
 * const t = calculateInvoice({
 *   lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
 * })
 * formatAmount(t.lineExtensionAmount) // '1000.00'
 * formatAmount(t.payableAmount)       // '1200.00'
 * ```
 *
 * @example Çoklu KDV oranı — her oran ayrı alt toplam
 * ```ts
 * const t = calculateInvoice({
 *   lines: [
 *     { name: 'Temel gıda', quantity: 10, unitPrice: 10, vatRate: 1 },
 *     { name: 'İndirimli', quantity: 10, unitPrice: 20, vatRate: 10 },
 *     { name: 'Standart', quantity: 10, unitPrice: 30, vatRate: 20 },
 *   ],
 * })
 * t.vatSubtotals.length // 3
 * ```
 *
 * @example Tevkifat ödenecek tutardan düşer
 * ```ts
 * const t = calculateInvoice({
 *   lines: [
 *     { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
 *   ],
 * })
 * formatAmount(t.vatTotalAmount)         // '200.00'
 * formatAmount(t.withholdingTotalAmount) // '140.00'
 * formatAmount(t.payableAmount)          // '1060.00'
 * ```
 */
export const calculateInvoice = (input: InvoiceTotalsInput): CalculatedInvoice => {
  if (input.lines.length === 0) {
    throw new DocumentInputError('NO_LINES', 'lines', 'Fatura en az bir satır içermelidir.')
  }
  const currencyCode = input.currencyCode ?? DEFAULT_CURRENCY_CODE
  const scale = currencyDefinition(currencyCode, input.codeTables).minorUnits
  const lines = input.lines.map((line, index) => calculateLine(line, index + 1, input.codeTables))

  const vatSubtotals = mergeSubtotals(
    lines.map((line) => {
      const temel = {
        code: VAT_TAX_CODE,
        name: VAT_TAX_NAME,
        rate: toDecimal(line.input.vatRate),
        taxableAmount: line.vatBase,
        taxAmount: line.vatAmount,
      }
      // Muafiyet bilgisi belge düzeyindeki alt toplama da taşınır.
      const { exemptionCode, exemptionReason } = line.input
      if (exemptionCode === undefined && exemptionReason === undefined) return temel
      return {
        ...temel,
        ...(exemptionCode === undefined ? {} : { exemptionCode }),
        ...(exemptionReason === undefined ? {} : { exemptionReason }),
      }
    }),
  )

  const otherTaxSubtotals = mergeSubtotals(lines.flatMap((line) => line.taxes))

  const withholdingSubtotals = mergeSubtotals(
    lines.flatMap((line) => {
      const kod = line.input.withholdingCode
      if (kod === undefined || line.withholdingAmount === undefined) return []
      const tanim = withholdingDefinition(kod, input.codeTables)
      if (tanim === undefined) return []
      return [
        {
          code: kod,
          name: tanim.name,
          rate: decimal(tanim.rate),
          taxableAmount: line.vatAmount,
          taxAmount: line.withholdingAmount,
        },
      ]
    }),
  )

  const lineExtensionAmount = sum(
    lines.map((l) => l.lineExtensionAmount),
    scale,
  )
  const belgeKalemleri = input.allowanceCharges ?? []
  const belgeIskontosu = sum(
    belgeKalemleri.filter((k) => !k.isCharge).map((k) => toDecimal(k.amount)),
    scale,
  )
  const belgeYuku = sum(
    belgeKalemleri.filter((k) => k.isCharge).map((k) => toDecimal(k.amount)),
    scale,
  )

  // `cbc:AllowanceTotalAmount` GİB örneklerinde satır iskontolarının
  // toplamıdır ve ödenecek tutardan AYRICA düşülmez — satır tutarından
  // zaten düşülmüştür. Belge düzeyindeki iskonto ise satırlara hiç
  // girmediği için ödenecek tutara uygulanır; ikisi aynı öğede toplanır
  // ama ödenecek tutara etkileri farklıdır.
  const allowanceTotalAmount = sum(
    [...lines.map((l) => l.discountAmount), ...lines.map((l) => l.allowanceAmount), belgeIskontosu],
    scale,
  )
  const chargeTotalAmount = sum([...lines.map((l) => l.chargeAmount), belgeYuku], scale)
  const vatTotalAmount = sum(
    lines.map((l) => l.vatAmount),
    scale,
  )
  const withholdingTotalAmount = sum(
    withholdingSubtotals.map((t) => t.taxAmount),
    scale,
  )

  // Vergi toplamı iki farklı biçimde gerekir ve ikisi aynı sayı DEĞİLDİR:
  //
  //  - `cac:TaxTotal/cbc:TaxAmount` alt toplamların MUTLAK toplamıdır;
  //    stopaj orada da pozitif görünür.
  //  - `cbc:TaxInclusiveAmount` hesabında ise stopaj gibi vergiler EKSİ
  //    girer, çünkü satıcı o tutarı tahsil etmez; alıcı doğrudan vergi
  //    dairesine öder.
  //
  // Ayrım kaçırıldığında ödenecek tutar iki kat stopaj kadar yanlış çıkar:
  // %23 gelir stopajlı 15.000 TL'lik bir faturada 14.550 yerine 21.450.
  const otherTaxTotalAbsolute = sum(
    otherTaxSubtotals.map((s) => s.taxAmount),
    scale,
  )
  const otherTaxTotalSigned = sum(
    otherTaxSubtotals.map((s) =>
      taxDefinition(s.code, input.codeTables)?.deductsFromTotal === true
        ? negate(s.taxAmount)
        : s.taxAmount,
    ),
    scale,
  )

  // `cbc:TaxExclusiveAmount` vergi HARİÇ tutardır ve satır toplamına eşittir.
  // Ek vergiler buraya GİRMEZ — KDV matrahını değiştirseler bile. Eklemek,
  // ÖTV'li bir faturada vergi hariç toplamı ÖTV kadar şişirir.
  const taxExclusiveAmount = lineExtensionAmount
  const taxInclusiveAmount = add(add(taxExclusiveAmount, vatTotalAmount), otherTaxTotalSigned)
  const payableAmount = add(
    subtract(subtract(taxInclusiveAmount, withholdingTotalAmount), belgeIskontosu),
    belgeYuku,
  )

  return {
    currencyCode,
    lines,
    vatSubtotals,
    otherTaxSubtotals,
    withholdingSubtotals,
    lineExtensionAmount: rescale(lineExtensionAmount, scale),
    allowanceTotalAmount: rescale(allowanceTotalAmount, scale),
    chargeTotalAmount: rescale(chargeTotalAmount, scale),
    taxExclusiveAmount: rescale(taxExclusiveAmount, scale),
    taxInclusiveAmount: rescale(taxInclusiveAmount, scale),
    vatTotalAmount: rescale(vatTotalAmount, scale),
    otherTaxTotalAmount: rescale(otherTaxTotalAbsolute, scale),
    withholdingTotalAmount: rescale(withholdingTotalAmount, scale),
    payableAmount: rescale(payableAmount, scale),
  }
}

/**
 * Bir satırın birim kodunu döndürür; verilmemişse varsayılanı kullanır.
 *
 * @param line - Satır girdisi
 * @returns UN/ECE Rec 20 birim kodu
 *
 * @example
 * ```ts
 * lineUnitCode({ name: 'x', quantity: 1, unitPrice: 1, vatRate: 20 }) // 'C62'
 * ```
 */
export const lineUnitCode = (line: InvoiceLineInput): string => line.unitCode ?? DEFAULT_UNIT_CODE

/**
 * Bir faturada hiç KDV olup olmadığını söyler.
 *
 * İstisna ve ihraç kayıtlı faturalarda KDV sıfırdır; bu durumda muafiyet
 * sebebi kodu zorunlu hâle gelir.
 *
 * @param totals - Hesaplanmış fatura
 * @returns Toplam KDV sıfırsa `true`
 *
 * @example
 * ```ts
 * isVatFree(calculateInvoice({ lines: [{ name: 'x', quantity: 1, unitPrice: 100, vatRate: 0 }] }))
 * // true
 * ```
 */
export const isVatFree = (totals: CalculatedInvoice): boolean => isZero(totals.vatTotalAmount)
