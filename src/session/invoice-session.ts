import {
  buildInvoice,
  buildInvoiceXml,
  type BuildInvoiceOptions,
  type InvoiceBuilderLineInput,
  type InvoiceInput,
  type PartyIdentificationInput,
  type PartyInput,
} from '../builders/index.js'
import type {
  ExemptionDefinition,
  InvoiceProfileId,
  InvoiceTypeCode,
  WithholdingDefinition,
} from '../constants/index.js'
import type { CodeTables } from '../constants/index.js'
import type { XmlElement } from '../core/index.js'
import { type CalculatedInvoice, DocumentInputError } from '../documents/index.js'
import {
  validateInvoiceRules,
  validateStructure,
  type ValidationIssue,
} from '../validators/index.js'

import {
  allowedProfilesForType,
  allowedTypesForProfile,
  availableExemptions,
  availableWithholdings,
  type CustomerLiability,
  deriveFieldVisibility,
  deriveLineFieldVisibility,
  type FieldVisibility,
  type LineFieldVisibility,
} from './field-visibility.js'
import { suggest, type Suggestion, type SuggestionRule } from './suggestion.js'

/** Bir nesnenin iç içe kısmi hâli. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends object | undefined
      ? DeepPartial<NonNullable<T[K]>> | undefined
      : T[K]
}

/**
 * Bir tipin isteğe bağlı alan adları.
 *
 * `clear` yalnızca isteğe bağlı alanları kabul eder; zorunlu bir alanı
 * silmek belgeyi kurulamaz hâle getirir. Liste elle tutulmaz, tipten
 * türer — girdiye yeni bir isteğe bağlı alan eklendiğinde `clear` onu
 * kendiliğinden kabul eder.
 */
type OptionalKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? K : never
}[keyof T]

/** {@link InvoiceSession.clear} ile temizlenebilen belge alanları. */
export type ClearableField = OptionalKeys<InvoiceInput>

/** {@link InvoiceSession.clearLine} ile temizlenebilen satır alanları. */
export type ClearableLineField = OptionalKeys<InvoiceBuilderLineInput>

/** Kimlik listesi taşıyabilen taraflar. */
export type IdentificationParty = 'supplier' | 'customer' | 'buyerCustomer'

/** Oturumun o anki türetilmiş durumu. */
export interface SessionState {
  /** Mevcut fatura girdisi. */
  readonly input: InvoiceInput
  /**
   * Hesaplanmış tutarlar; girdi hesaplanamıyorsa `undefined`.
   *
   * Hesaplama başarısızsa {@link SessionState.issues} nedeni söyler.
   */
  readonly totals?: CalculatedInvoice | undefined
  /** Belge düzeyinde hangi alanların anlamlı olduğu. */
  readonly fields: FieldVisibility
  /** Her satır için alan görünürlükleri; satırlarla aynı sırada. */
  readonly lineFields: readonly LineFieldVisibility[]
  /** Mevcut tiple kullanılabilen profiller. */
  readonly allowedProfiles: readonly InvoiceProfileId[]
  /** Mevcut profilde kullanılabilen tipler. */
  readonly allowedTypes: readonly InvoiceTypeCode[]
  /** Mevcut tipte kullanılabilen muafiyet kodları. */
  readonly availableExemptions: readonly ExemptionDefinition[]
  /** Mevcut tipte kullanılabilen tevkifat kodları. */
  readonly availableWithholdings: readonly WithholdingDefinition[]
  /** İhracat oturumu mu; `IHRACAT` profilinin listede kalmasını belirler. */
  readonly isExport: boolean
  /**
   * Oturumun mükellefiyet varsayımı; verilmemişse `undefined`.
   *
   * `undefined` iken profil ve tip listeleri süzülmez — kütüphane alıcının
   * mükellef olup olmadığını **tahmin etmez**.
   */
  readonly liability?: CustomerLiability | undefined
  /**
   * Doğrulama bulguları.
   *
   * Girdiden değil, **üretilen belgeden** çıkarılır: yapısal doğrulama ve
   * iş kuralları gerçek XML üzerinde çalışır. Bu, girdi düzeyinde denetim
   * yapan bir tasarımdan daha kapsamlıdır — belgeye dönüşürken ortaya çıkan
   * hatalar da yakalanır.
   */
  readonly issues: readonly ValidationIssue[]
  /** Öneriler; engelleyici değildir. */
  readonly suggestions: readonly Suggestion[]
  /** Hiç `'error'` ağırlıklı bulgu yoksa `true`. */
  readonly valid: boolean
}

/** {@link InvoiceSession} seçenekleri. */
export interface InvoiceSessionOptions {
  /** Belge üretim seçenekleri; {@link buildInvoiceXml} ile aynı. */
  readonly build?: BuildInvoiceOptions
  /** Kullanılacak öneri kuralları; varsayılan yerleşik kümedir. */
  readonly suggestionRules?: readonly SuggestionRule[]
  /**
   * Alıcının mükellefiyet durumu; verilirse profil ve tip listeleri daralır.
   *
   * Bu bilgi GİB'in e-Fatura mükellef listesinden gelir. Kütüphane listeyi
   * sorgulamaz — sonucu siz verirsiniz. Bkz. {@link CustomerLiability}.
   */
  readonly liability?: CustomerLiability
  /**
   * Gömülü GİB kod tablolarının önüne geçen ek tanımlar.
   *
   * Oturum bu tabloyu **hepsine birden** dağıtır: hesaplama, belge üretimi,
   * doğrulama, öneriler ve seçim listeleri. Tek yerde verilir, her yerde
   * tutarlı davranır — belgeyi bir tabloyla üretip başkasıyla doğrulama
   * riski yoktur. Bkz. {@link CodeTables}.
   *
   * @example
   * ```ts
   * new InvoiceSession(girdi, {
   *   codeTables: {
   *     exemptions: [
   *       { code: '999', name: 'Yeni istisna', taxType: 'KDV', documentType: 'ISTISNA' },
   *     ],
   *   },
   * })
   * ```
   */
  readonly codeTables?: CodeTables
  /**
   * İhracat oturumu mu.
   *
   * `liability: 'einvoice'` ile birlikte `IHRACAT` profilinin listede
   * kalmasını sağlar; ihracat faturası e-Fatura mükellefine düzenlenir.
   */
  readonly isExport?: boolean
}

/** Durum değiştiğinde çağrılan dinleyici. */
/**
 * Durumu değiştiren işlemin ne olduğu.
 *
 * Tek bir durum dinleyicisi çoğu form için yeterlidir, ama bazı kararlar
 * **neyin** değiştiğini bilmeyi gerektirir: bir satırın silinme animasyonu,
 * tip değişince alanı sıfırlamak, önceki değere dönmeyi öneren bir "geri
 * al" düğmesi.
 *
 * Her bildirimde `previousInput` bulunur; tip, profil ya da herhangi bir
 * alanın önceki değeri buradan okunur. Ayrı bir olay yayıcı
 * (`EventEmitter`) kullanılmadı — kütüphanenin çalışma zamanı bağımlılığı
 * yoktur ve tarayıcıda da çalışır.
 *
 * @example Tip değişimini ve satır silmeyi yakalamak
 * ```ts
 * oturum.subscribe((state, degisim) => {
 *   if (degisim.previousInput.type !== state.input.type) tipDegistiUyar()
 *   if (degisim.kind === 'line-removed') satirSilmeAnimasyonu(degisim.index)
 * })
 * ```
 */
export type SessionChange = { readonly previousInput: InvoiceInput } & (
  | { readonly kind: 'patch' }
  | { readonly kind: 'cleared'; readonly keys: readonly ClearableField[] }
  | { readonly kind: 'line-added'; readonly index: number }
  | {
      readonly kind: 'line-updated'
      readonly index: number
      readonly previousLine: InvoiceBuilderLineInput
    }
  | {
      readonly kind: 'line-removed'
      readonly index: number
      readonly previousLine: InvoiceBuilderLineInput
    }
  | {
      readonly kind: 'line-cleared'
      readonly index: number
      readonly keys: readonly ClearableLineField[]
    }
  | { readonly kind: 'lines-replaced' }
  | { readonly kind: 'identifications-changed'; readonly party: IdentificationParty }
)

/**
 * Durum değiştiğinde çağrılan dinleyici.
 *
 * İkinci parametre isteğe bağlıdır: `(state) => …` yazan bir dinleyici
 * değişiklik ayrıntısını görmezden gelir ve çalışmayı sürdürür.
 */
export type SessionListener = (state: SessionState, change: SessionChange) => void

/**
 * Bir nesneden verilen anahtarları çıkarır.
 *
 * Anahtarların hiçbiri nesnede yoksa `undefined` döner; çağıran bunu
 * "değişiklik yok" olarak okur ve dinleyicileri boşuna uyandırmaz.
 */
const omit = <T extends object>(kaynak: T, anahtarlar: readonly PropertyKey[]): T | undefined => {
  const kume = new Set<PropertyKey>(anahtarlar)
  const girdiler = Object.entries(kaynak).filter(([anahtar]) => !kume.has(anahtar))
  if (girdiler.length === Object.keys(kaynak).length) return undefined
  return Object.fromEntries(girdiler) as T
}

/** İki nesneyi derin birleştirir; `undefined` değerler yok sayılır. */
const merge = <T>(hedef: T, yama: DeepPartial<T> | undefined): T => {
  if (yama === undefined) return hedef
  const sonuc: Record<string, unknown> = { ...(hedef as Record<string, unknown>) }
  for (const [anahtar, deger] of Object.entries(yama as Record<string, unknown>)) {
    if (deger === undefined) continue
    const mevcut = sonuc[anahtar]
    if (
      typeof deger === 'object' &&
      !Array.isArray(deger) &&
      typeof mevcut === 'object' &&
      mevcut !== null &&
      !Array.isArray(mevcut)
    ) {
      sonuc[anahtar] = merge(mevcut, deger as DeepPartial<unknown>)
    } else {
      sonuc[anahtar] = deger
    }
  }
  return sonuc as T
}

/**
 * Değişebilir bir fatura oturumu.
 *
 * Form arayüzleri için tasarlanmıştır: girdi değiştikçe tutarları yeniden
 * hesaplar, hangi alanların anlamlı olduğunu söyler, doğrulama bulgularını
 * ve önerileri günceller.
 *
 * **Doğrulama girdi üzerinde değil, üretilen belge üzerinde çalışır.**
 * Girdiyi denetleyen bir tasarım, belgeye dönüşürken ortaya çıkan hataları
 * göremez; oturum her değişiklikte belgeyi kurup gerçek XML'i denetler.
 *
 * Değişiklikler {@link InvoiceSession.patch} ile tipli olarak yapılır.
 * Yol tabanlı güncelleme için {@link InvoiceSession.setLine} ve satır
 * yardımcıları vardır; bu, üretilmiş yol sabitlerine gerek bırakmaz.
 *
 * @example Temel kullanım
 * ```ts
 * const oturum = new InvoiceSession(girdi)
 * oturum.state.valid                    // false
 * oturum.state.issues[0]?.code          // 'KAMU_MISSING_BUYER_CUSTOMER'
 * oturum.state.suggestions[0]?.reason   // 'Kamu profilinde alıcı kurum …'
 * ```
 *
 * @example Alan görünürlüğüyle form kurmak
 * ```ts
 * const { fields, lineFields } = oturum.state
 * if (fields.billingReference) gosterIadeAtfiAlani()
 * if (lineFields[0]?.delivery) gosterTeslimAlanlari(0)
 * ```
 *
 * @example Değişikliği dinlemek
 * ```ts
 * const birak = oturum.subscribe((state) => yenidenCiz(state))
 * oturum.patch({ currencyCode: 'EUR' })
 * birak()
 * ```
 */
export class InvoiceSession {
  #input: InvoiceInput
  readonly #options: InvoiceSessionOptions
  readonly #listeners = new Set<SessionListener>()
  #state: SessionState

  /**
   * @param input - Başlangıç fatura girdisi
   * @param options - Üretim ve öneri seçenekleri
   */
  constructor(input: InvoiceInput, options: InvoiceSessionOptions = {}) {
    this.#input = input
    this.#options = options
    this.#state = this.#derive()
  }

  /** Oturumun o anki türetilmiş durumu. */
  get state(): SessionState {
    return this.#state
  }

  /** Mevcut fatura girdisi. */
  get input(): InvoiceInput {
    return this.#input
  }

  /**
   * Durum değişikliklerini dinler.
   *
   * @param listener - Her değişiklikte çağrılacak işlev
   * @returns Dinlemeyi bırakan işlev
   *
   * @example
   * ```ts
   * const birak = oturum.subscribe((s) => console.log(s.valid))
   * birak()
   * ```
   */
  subscribe(listener: SessionListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /**
   * Girdiyi kısmi bir yamayla günceller ve durumu yeniden türetir.
   *
   * Yama derin birleştirilir: verilmeyen alanlar korunur. Diziler
   * **değiştirilir**, birleştirilmez — satır listesini kısmen güncellemek
   * için {@link InvoiceSession.setLine} kullanın.
   *
   * @param patch - Kısmi güncelleme
   * @returns Yeni durum
   *
   * @example
   * ```ts
   * oturum.patch({ currencyCode: 'EUR', exchangeRate: { rate: 36.75 } })
   * oturum.patch({ supplier: { taxOffice: 'Kadıköy' } }) // diğer taraf alanları korunur
   * ```
   */
  patch(patch: DeepPartial<InvoiceInput>): SessionState {
    const previousInput = this.#input
    this.#input = merge(this.#input, patch)
    return this.#update({ kind: 'patch', previousInput })
  }

  /**
   * Belge düzeyinde bir ya da daha çok alanı temizler.
   *
   * {@link InvoiceSession.patch} `undefined` değerleri **yok sayar** —
   * derin birleştirmede `undefined`, "bu alana dokunma" demektir; olmayan
   * bir alanı yamayla silmek mümkün değildir. Alanı gerçekten kaldırmak
   * bu işin ayrı bir çağrısıdır.
   *
   * Zorunlu alanlar (`id`, `uuid`, `issueDate`, `profile`, `type`, taraflar,
   * `lines`) tip düzeyinde kabul edilmez; onları temizlemek belgeyi
   * kurulamaz hâle getirir, silmek değil değiştirmek gerekir.
   *
   * @param keys - Temizlenecek isteğe bağlı alan adları
   * @returns Yeni durum
   *
   * @example Tip değişince anlamsızlaşan alanı kaldırmak
   * ```ts
   * oturum.patch({ type: InvoiceType.SATIS })
   * oturum.clear('billingReference')   // iade atfı artık anlamsız
   * ```
   *
   * @example Birden çok alanı birlikte
   * ```ts
   * oturum.clear('paymentMeans', 'orderReference', 'invoicePeriod')
   * ```
   */
  clear(...keys: readonly ClearableField[]): SessionState {
    const sonraki = omit(this.#input, keys)
    if (sonraki === undefined) return this.#state
    const previousInput = this.#input
    this.#input = sonraki
    return this.#update({ kind: 'cleared', keys, previousInput })
  }

  /**
   * Bir satırda bir ya da daha çok alanı temizler.
   *
   * {@link InvoiceSession.clear} ile aynı gerekçe: `setLine` de derin
   * birleştirme yapar ve `undefined` yamayı yok sayar.
   *
   * @param index - Sıfır tabanlı satır sırası
   * @param keys - Temizlenecek isteğe bağlı satır alanları
   * @returns Yeni durum
   * @throws {RangeError} Sıra geçerli değilse
   *
   * @example KDV oranı sıfırdan çıkınca muafiyet kodunu kaldırmak
   * ```ts
   * oturum.setLine(0, { vatRate: 20 })
   * oturum.clearLine(0, 'exemptionCode', 'exemptionReason')
   * ```
   */
  clearLine(index: number, ...keys: readonly ClearableLineField[]): SessionState {
    const mevcut = this.#input.lines[index]
    if (mevcut === undefined) {
      throw new RangeError(
        `Satır ${String(index)} yok; belgede ${String(this.#input.lines.length)} satır var.`,
      )
    }
    const kalem = omit(mevcut, keys)
    if (kalem === undefined) return this.#state
    const previousInput = this.#input
    const satirlar = [...this.#input.lines]
    satirlar[index] = kalem
    this.#input = { ...this.#input, lines: satirlar }
    return this.#update({ kind: 'line-cleared', index, keys, previousInput })
  }

  /**
   * Bir tarafın kimlik listesinden bir kaydı siler.
   *
   * Sonraki sıralar kayar; liste boşalırsa alan tümden kaldırılır. Sıra
   * geçerli değilse bir şey olmaz — form akışında silme düğmesine iki kez
   * basılması hata değil, yinelenen bir istektir.
   *
   * @param party - Kimliği taşıyan taraf
   * @param index - Sıfır tabanlı kimlik sırası
   * @returns Yeni durum
   *
   * @example
   * ```ts
   * oturum.removeIdentification('customer', 0)
   * ```
   */
  removeIdentification(party: IdentificationParty, index: number): SessionState {
    const taraf = this.#input[party]
    const liste = taraf?.identifications
    if (taraf === undefined || liste === undefined || index < 0 || index >= liste.length)
      return this.#state
    const kalan = liste.filter((_, i) => i !== index)
    return this.#setIdentifications(party, taraf, kalan)
  }

  /**
   * Bir tarafın kimlik listesini tümüyle değiştirir.
   *
   * Boş liste verilirse alan kaldırılır. Bunun sebebi Schematron'dur:
   * `schemeID` taşımayan boş bir `cac:PartyIdentification` öğesi belgeyi
   * geçersiz kılar; yazmamak doğru davranıştır.
   *
   * @param party - Kimliği taşıyan taraf
   * @param identifications - Yeni kimlik listesi
   * @returns Yeni durum
   * @throws {RangeError} Taraf girdide yoksa
   *
   * @example
   * ```ts
   * oturum.setIdentifications('customer', [{ schemeId: 'MUSTERINO', value: 'M-42' }])
   * ```
   */
  setIdentifications(
    party: IdentificationParty,
    identifications: readonly PartyIdentificationInput[],
  ): SessionState {
    const taraf = this.#input[party]
    if (taraf === undefined) {
      throw new RangeError(`"${party}" tarafı girdide yok; önce tarafı ekleyin.`)
    }
    return this.#setIdentifications(party, taraf, identifications)
  }

  /** Kimlik listesini yazar; boş liste alanı kaldırır. */
  #setIdentifications(
    party: IdentificationParty,
    taraf: PartyInput,
    identifications: readonly PartyIdentificationInput[],
  ): SessionState {
    const yeni =
      identifications.length === 0
        ? (omit(taraf, ['identifications']) ?? taraf)
        : { ...taraf, identifications }
    const previousInput = this.#input
    this.#input = { ...this.#input, [party]: yeni }
    return this.#update({ kind: 'identifications-changed', party, previousInput })
  }

  /**
   * Satır ekler.
   *
   * @param line - Eklenecek satır
   * @returns Yeni durum
   *
   * @example
   * ```ts
   * oturum.addLine({ name: 'Ürün', quantity: 1, unitPrice: 100, vatRate: 20 })
   * ```
   */
  addLine(line: InvoiceBuilderLineInput): SessionState {
    const previousInput = this.#input
    this.#input = { ...this.#input, lines: [...this.#input.lines, line] }
    return this.#update({ kind: 'line-added', index: this.#input.lines.length - 1, previousInput })
  }

  /**
   * Bir satırı kısmi yamayla günceller.
   *
   * @param index - Sıfır tabanlı satır sırası
   * @param patch - Kısmi güncelleme
   * @returns Yeni durum
   * @throws {RangeError} Sıra geçerli değilse
   *
   * @example
   * ```ts
   * oturum.setLine(0, { vatRate: 10, exemptionCode: '351' })
   * ```
   */
  setLine(index: number, patch: DeepPartial<InvoiceBuilderLineInput>): SessionState {
    const mevcut = this.#input.lines[index]
    if (mevcut === undefined) {
      throw new RangeError(
        `Satır ${String(index)} yok; belgede ${String(this.#input.lines.length)} satır var.`,
      )
    }
    const previousInput = this.#input
    const yeni = [...this.#input.lines]
    yeni[index] = merge(mevcut, patch)
    this.#input = { ...this.#input, lines: yeni }
    return this.#update({ kind: 'line-updated', index, previousLine: mevcut, previousInput })
  }

  /**
   * Satır siler.
   *
   * @param index - Sıfır tabanlı satır sırası
   * @returns Yeni durum
   * @throws {RangeError} Sıra geçerli değilse
   *
   * @example
   * ```ts
   * oturum.removeLine(1)
   * ```
   */
  removeLine(index: number): SessionState {
    const previousLine = this.#input.lines[index]
    if (previousLine === undefined) {
      throw new RangeError(
        `Satır ${String(index)} yok; belgede ${String(this.#input.lines.length)} satır var.`,
      )
    }
    const previousInput = this.#input
    this.#input = {
      ...this.#input,
      lines: this.#input.lines.filter((_, i) => i !== index),
    }
    return this.#update({ kind: 'line-removed', index, previousLine, previousInput })
  }

  /**
   * Satır listesini tümüyle değiştirir.
   *
   * @param lines - Yeni satırlar
   * @returns Yeni durum
   *
   * @example
   * ```ts
   * oturum.setLines(sepettekiUrunler.map(toLine))
   * ```
   */
  setLines(lines: readonly InvoiceBuilderLineInput[]): SessionState {
    const previousInput = this.#input
    this.#input = { ...this.#input, lines }
    return this.#update({ kind: 'lines-replaced', previousInput })
  }

  /**
   * Belgeyi öğe ağacı olarak kurar.
   *
   * @returns Kök öğe ve hesaplanmış tutarlar
   * @throws {RangeError} Girdi belgeye dönüştürülemiyorsa
   *
   * @example
   * ```ts
   * const { root } = oturum.build()
   * ```
   */
  build(): { readonly root: XmlElement; readonly totals: CalculatedInvoice } {
    return buildInvoice(this.#input, this.#buildOptions())
  }

  /**
   * Belgeyi XML olarak üretir.
   *
   * @param options - Üretim seçenekleri; oturumunkileri geçersiz kılar
   * @returns UBL-TR XML belgesi
   * @throws {RangeError} Girdi belgeye dönüştürülemiyorsa
   *
   * @example
   * ```ts
   * if (oturum.state.valid) gonder(oturum.toXml())
   * ```
   */
  toXml(options?: BuildInvoiceOptions): string {
    return buildInvoiceXml(this.#input, options ?? this.#buildOptions())
  }

  /**
   * Üretim seçeneklerini kod tablosuyla birleştirir.
   *
   * `codeTables` oturum düzeyinde verilir; `build` seçenekleri kendi
   * tablosunu taşıyorsa o üstün gelir — daha özel olan kazanır.
   */
  #buildOptions(): BuildInvoiceOptions {
    const build = this.#options.build ?? {}
    const tables = this.#options.codeTables
    if (tables === undefined) return build
    return { codeTables: tables, ...build }
  }

  /** Durumu yeniden türetir ve dinleyicilere haber verir. */
  #update(change: SessionChange): SessionState {
    this.#state = this.#derive()
    for (const listener of this.#listeners) listener(this.#state, change)
    return this.#state
  }

  /** Girdiden türetilmiş durumu hesaplar. */
  #derive(): SessionState {
    const input = this.#input
    const liability = this.#options.liability
    const tables = this.#options.codeTables
    const isExport = this.#options.isExport ?? false
    // `profile` ve `type` girdide zorunludur; yalnızca para birimi
    // isteğe bağlıdır ve verilmediğinde varsayılan Türk lirasıdır.
    const baglam = {
      profile: input.profile,
      type: input.type,
      currencyCode: input.currencyCode ?? 'TRY',
    }
    const fields = deriveFieldVisibility(baglam)
    const lineFields = input.lines.map(() => deriveLineFieldVisibility(baglam))

    let totals: CalculatedInvoice | undefined
    let issues: readonly ValidationIssue[]
    try {
      // Doğrulama GERÇEK BELGE üzerinde yapılır. Girdiyi denetleyen bir
      // tasarım, belgeye dönüşürken ortaya çıkan hataları göremez.
      const { root, totals: hesap } = buildInvoice(input, this.#buildOptions())
      totals = hesap
      issues = [
        ...validateStructure(root).issues,
        ...validateInvoiceRules(root, tables === undefined ? {} : { codeTables: tables }).issues,
      ]
    } catch (error) {
      // Üretim reddedildiğinde de alan düzeyinde geri bildirim verilir:
      // DocumentInputError hangi girdi alanından geldiğini taşır, form o
      // alanı işaretleyebilir. Yalnızca beklenmeyen hatalar 'input'a düşer.
      issues = [
        error instanceof DocumentInputError
          ? { code: error.code, path: error.path, severity: 'error', message: error.message }
          : {
              code: 'BUILD_FAILED',
              path: 'input',
              severity: 'error',
              message: error instanceof Error ? error.message : String(error),
            },
      ]
    }

    return {
      input,
      totals,
      fields,
      lineFields,
      allowedProfiles: allowedProfilesForType(input.type, liability, isExport),
      isExport,
      allowedTypes: allowedTypesForProfile(input.profile, liability),
      liability,
      availableExemptions: availableExemptions(input.type, tables),
      availableWithholdings: availableWithholdings(input.type, tables),
      issues,
      suggestions: suggest(input, this.#options.suggestionRules, tables),
      valid: !issues.some((i) => i.severity === 'error'),
    }
  }
}
