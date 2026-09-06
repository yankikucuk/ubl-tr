import type { InvoiceBuilderLineInput, InvoiceInput } from '../builders/index.js'
import {
  type CodeTables,
  InvoiceProfile,
  InvoiceType,
  isValidWithholdingCode,
  withholdingDefinition,
  YTB_TYPES,
  ZERO_VAT_WITHOUT_EXEMPTION_TYPES,
} from '../constants/index.js'
import { compare, decimal } from '../core/index.js'

/**
 * Bir önerinin ağırlığı.
 *
 * Öneriler **engelleyici değildir**. Doğrulama bulgusuyla karıştırılmamalı:
 * bulgu belgenin reddedileceğini söyler, öneri daha iyi bir kurulum işaret
 * eder. Aynı alan için ikisi paralel üretilebilir.
 */
export type SuggestionSeverity = 'recommended' | 'optional'

/** Kullanıcıya sunulan bir öneri. */
export interface Suggestion {
  /**
   * Kuralın kimliği — `alan/konu` biçiminde.
   *
   * Mesaj metni değişebilir; kararlar bu kimlik üzerinden verilmelidir.
   */
  readonly id: string
  /** Önerinin ilgili olduğu alanın yolu (ör. `lines[0].exemptionCode`). */
  readonly path: string
  /** Önerilen değer; `undefined` "kullanıcı doldurmalı" demektir. */
  readonly value?: string | undefined
  /** Türkçe gerekçe. */
  readonly reason: string
  /** Ağırlık. */
  readonly severity: SuggestionSeverity
}

/** Öneri kuralı. */
export interface SuggestionRule {
  /** Kural kimliği. */
  readonly id: string
  /**
   * Kuralı çalıştırır.
   *
   * @param input - Mevcut fatura girdisi
   * @param tables - Gömülü kod tablolarının önüne geçen ek tanımlar
   * @returns Üretilen öneriler; kural bu duruma uymuyorsa boş dizi
   */
  readonly run: (input: InvoiceInput, tables?: CodeTables) => readonly Suggestion[]
}

const oner = (
  id: string,
  path: string,
  reason: string,
  severity: SuggestionSeverity,
  value?: string,
): Suggestion =>
  value === undefined ? { id, path, reason, severity } : { id, path, value, reason, severity }

const sifirKdv = (line: InvoiceBuilderLineInput): boolean => {
  try {
    const oran = typeof line.vatRate === 'object' ? line.vatRate : decimal(line.vatRate)
    return compare(oran, decimal('0')) === 0
  } catch {
    return false
  }
}

/**
 * Yerleşik öneri kuralları.
 *
 * Her kural, mevzuatın izin verdiği ama kullanıcının kaçırdığı bir kurulumu
 * işaret eder. Kurallar **engellemez**; belgenin geçerliliğini
 * {@link validateInvoiceRules} söyler.
 */
export const SUGGESTION_RULES: readonly SuggestionRule[] = [
  {
    id: 'kdv/sifir-kdv-muafiyet-kodu',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      (ZERO_VAT_WITHOUT_EXEMPTION_TYPES as readonly string[]).includes(input.type)
        ? []
        : input.lines.flatMap((line, i) =>
            sifirKdv(line) && line.exemptionCode === undefined
              ? [
                  oner(
                    'kdv/sifir-kdv-muafiyet-kodu',
                    `lines[${String(i)}].exemptionCode`,
                    'KDV sıfır olan kalemde muafiyet sebebi kodu bekleniyor; ' +
                      'bu fatura tipinde sıfır KDV kendiliğinden açıklanmış sayılmaz.',
                    'recommended',
                  ),
                ]
              : [],
          ),
  },
  {
    id: 'tevkifat/kod-tip-uyumu',
    run: (input: InvoiceInput): readonly Suggestion[] => {
      const tevkifatliSatir = input.lines.some((l) => l.withholdingCode !== undefined)
      if (!tevkifatliSatir || input.type === InvoiceType.TEVKIFAT) return []
      if (input.type === InvoiceType.IADE) return []
      return [
        oner(
          'tevkifat/kod-tip-uyumu',
          'type',
          'Kalemlerde tevkifat kodu var; fatura tipi TEVKIFAT olmalı. ' +
            'Tevkifatlı iade için tip IADE seçilir — TEVKIFATIADE tevkifat taşıyamaz.',
          'recommended',
          InvoiceType.TEVKIFAT,
        ),
      ]
    },
  },
  {
    id: 'tevkifat/gecersiz-kod',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      input.lines.flatMap((line, i) =>
        line.withholdingCode !== undefined && !isValidWithholdingCode(line.withholdingCode)
          ? [
              oner(
                'tevkifat/gecersiz-kod',
                `lines[${String(i)}].withholdingCode`,
                `"${line.withholdingCode}" tanımlı bir tevkifat kodu değil. ` +
                  'GİB kodu ve oranı birlikte denetler; serbest oranlı kod kabul edilmez.',
                'recommended',
              ),
            ]
          : [],
      ),
  },
  {
    id: 'ihrackayitli/702-gumruk-bilgisi',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      input.type !== InvoiceType.IHRAC_KAYITLI
        ? []
        : input.lines.flatMap((line, i) => {
            if (line.exemptionCode !== '702') return []
            const eksik: Suggestion[] = []
            if (line.delivery?.customsTariffNumber === undefined) {
              eksik.push(
                oner(
                  'ihrackayitli/702-gumruk-bilgisi',
                  `lines[${String(i)}].delivery.customsTariffNumber`,
                  '702 muafiyet kodunda 12 haneli GTİP numarası zorunludur.',
                  'recommended',
                ),
              )
            }
            if (line.delivery?.customsDeclaration === undefined) {
              eksik.push(
                oner(
                  'ihrackayitli/702-gumruk-bilgisi',
                  `lines[${String(i)}].delivery.customsDeclaration`,
                  '702 muafiyet kodunda 11 haneli alıcı satır kodu (ALICIDIBSATIRKOD) zorunludur.',
                  'recommended',
                ),
              )
            }
            return eksik
          }),
  },
  {
    id: 'ihracat/teslim-sarti',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      input.profile !== InvoiceProfile.IHRACAT
        ? []
        : input.lines.flatMap((line, i) =>
            line.delivery?.deliveryTermCode === undefined
              ? [
                  oner(
                    'ihracat/teslim-sarti',
                    `lines[${String(i)}].delivery.deliveryTermCode`,
                    'İhracat faturasında teslim şekli (Incoterms) beklenir: FOB, CIF, EXW …',
                    'optional',
                  ),
                ]
              : [],
          ),
  },
  {
    id: 'doviz/kur-zorunlu',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      input.currencyCode !== undefined &&
      input.currencyCode !== 'TRY' &&
      input.exchangeRate === undefined
        ? [
            oner(
              'doviz/kur-zorunlu',
              'exchangeRate',
              `Belge para birimi "${input.currencyCode}"; Türk lirası karşılığı için kur gereklidir.`,
              'recommended',
            ),
          ]
        : [],
  },
  {
    id: 'enerji/donem-ve-plaka',
    run: (input: InvoiceInput): readonly Suggestion[] => {
      if (input.type !== InvoiceType.SARJ && input.type !== InvoiceType.SARJ_ANLIK) return []
      const eksik: Suggestion[] = []
      if (input.invoicePeriod === undefined) {
        eksik.push(
          oner(
            'enerji/donem-ve-plaka',
            'invoicePeriod',
            'Şarj hizmeti faturalarında fatura dönemi zorunludur.',
            'recommended',
          ),
        )
      }
      const plaka = input.customer.identifications?.some((k) => k.schemeId === 'PLAKA') ?? false
      if (!plaka) {
        eksik.push(
          oner(
            'enerji/donem-ve-plaka',
            'customer.identifications',
            'Şarj hizmeti faturalarında alıcı tarafında plaka (schemeID="PLAKA") zorunludur.',
            'recommended',
          ),
        )
      }
      if (input.type === InvoiceType.SARJ) {
        const esu = input.additionalDocuments?.some((b) => b.schemeId === 'ESURaporID') ?? false
        if (!esu) {
          eksik.push(
            oner(
              'enerji/donem-ve-plaka',
              'additionalDocuments',
              'SARJ faturalarında schemeID="ESURaporID" taşıyan bir ek belge zorunludur.',
              'recommended',
            ),
          )
        }
      }
      return eksik
    },
  },
  {
    id: 'yatirim-tesvik/kalem-ayrintilari',
    run: (input: InvoiceInput): readonly Suggestion[] => {
      const kapsam =
        input.profile === InvoiceProfile.YATIRIM_TESVIK ||
        (YTB_TYPES as readonly string[]).includes(input.type)
      if (!kapsam) return []
      const eksik: Suggestion[] = []
      if (input.contractDocument === undefined) {
        eksik.push(
          oner(
            'yatirim-tesvik/kalem-ayrintilari',
            'contractDocument',
            'Yatırım teşvik faturasında teşvik belgesi numarası (YTBNO) beklenir.',
            'recommended',
          ),
        )
      }
      for (const [i, line] of input.lines.entries()) {
        if (line.classificationCode === undefined) {
          eksik.push(
            oner(
              'yatirim-tesvik/kalem-ayrintilari',
              `lines[${String(i)}].classificationCode`,
              'Yatırım teşvikte harcama tipi kodu beklenir: 01 makine-teçhizat, 02 inşaat.',
              'recommended',
            ),
          )
          continue
        }
        if (line.classificationCode !== '01') continue
        for (const [alan, ad] of [
          ['brandName', 'markası'],
          ['modelName', 'modeli'],
        ] as const) {
          if (line[alan] === undefined) {
            eksik.push(
              oner(
                'yatirim-tesvik/kalem-ayrintilari',
                `lines[${String(i)}].${alan}`,
                `Harcama tipi 01 kaleminde ürün ${ad} zorunludur.`,
                'recommended',
              ),
            )
          }
        }
      }
      return eksik
    },
  },
  {
    id: 'kamu/araci-alici',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      input.profile === InvoiceProfile.KAMU && input.buyerCustomer === undefined
        ? [
            oner(
              'kamu/araci-alici',
              'buyerCustomer',
              'Kamu profilinde alıcı kurum bilgisi zorunludur.',
              'recommended',
            ),
          ]
        : [],
  },
  {
    id: 'hks/kunye-numarasi',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      input.profile !== InvoiceProfile.HKS
        ? []
        : input.lines.flatMap((line, i) =>
            (line.additionalIdentifications ?? []).some((k) => k.schemeId === 'KUNYENO')
              ? []
              : [
                  oner(
                    'hks/kunye-numarasi',
                    `lines[${String(i)}].additionalIdentifications`,
                    'HKS profilinde her kalemde 19 karakterli künye numarası zorunludur.',
                    'recommended',
                  ),
                ],
          ),
  },
  {
    id: 'iade/asil-fatura-atfi',
    run: (input: InvoiceInput): readonly Suggestion[] =>
      (input.type === InvoiceType.IADE || input.type === InvoiceType.TEVKIFAT_IADE) &&
      input.billingReference === undefined
        ? [
            oner(
              'iade/asil-fatura-atfi',
              'billingReference',
              'İade faturasında iade edilen faturaya atıf zorunludur.',
              'recommended',
            ),
          ]
        : [],
  },
  {
    id: 'tevkifat/oran-bilgisi',
    run: (input: InvoiceInput, tables?: CodeTables): readonly Suggestion[] =>
      input.lines.flatMap((line, i) => {
        if (line.withholdingCode === undefined) return []
        const tanim = withholdingDefinition(line.withholdingCode, tables)
        if (tanim === undefined) return []
        return [
          oner(
            'tevkifat/oran-bilgisi',
            `lines[${String(i)}].withholdingCode`,
            `"${tanim.code}" — ${tanim.name}. Oran %${String(tanim.rate)}; ` +
              'oran koddan gelir, ayrıca girilmez.',
            'optional',
            tanim.code,
          ),
        ]
      }),
  },
]

/**
 * Bir fatura girdisi için önerileri üretir.
 *
 * Öneriler engelleyici değildir: kullanıcıyı daha doğru bir kuruluma
 * yönlendirir. Belgenin reddedilip reddedilmeyeceğini doğrulayıcılar söyler.
 * Aynı alan için hem bulgu hem öneri üretilebilir; ikisi ayrı kanaldır.
 *
 * @param input - Fatura girdisi
 * @param rules - Kullanılacak kurallar; varsayılan {@link SUGGESTION_RULES}
 * @returns Üretilen öneriler
 *
 * @example
 * ```ts
 * const oneriler = suggest({ ...girdi, currencyCode: 'EUR' })
 * oneriler[0]?.id     // 'doviz/kur-zorunlu'
 * oneriler[0]?.path   // 'exchangeRate'
 * ```
 *
 * @example Kendi kuralını eklemek
 * ```ts
 * suggest(girdi, [
 *   ...SUGGESTION_RULES,
 *   { id: 'sirket/musteri-no', run: (i) => (i.customer.identifications ? [] : [
 *     { id: 'sirket/musteri-no', path: 'customer.identifications',
 *       reason: 'Müşteri numarası eklenmeli.', severity: 'optional' },
 *   ]) },
 * ])
 * ```
 */
export const suggest = (
  input: InvoiceInput,
  rules: readonly SuggestionRule[] = SUGGESTION_RULES,
  tables?: CodeTables,
): readonly Suggestion[] => rules.flatMap((rule) => rule.run(input, tables))

/** İki öneri kümesi arasındaki fark. */
export interface SuggestionDiff {
  /** Sonraki kümede olup öncekinde olmayan öneriler. */
  readonly added: readonly Suggestion[]
  /** Önceki kümede olup sonrakinde olmayan öneriler. */
  readonly removed: readonly Suggestion[]
  /** İkisinde de bulunan öneriler; sonraki kümedeki hâlleriyle. */
  readonly kept: readonly Suggestion[]
}

/**
 * Bir öneriyi kimliğinden ve yolundan tanımlar.
 *
 * Yalnızca kimlik yetmez: aynı kural birden çok satır için ateşlenebilir
 * ve bunlar ayrı önerilerdir. Gerekçe metni anahtara **girmez** — metnin
 * düzeltilmesi öneriyi "yeni" göstermemelidir.
 */
const suggestionKey = (s: Suggestion): string => `${s.id} ${s.path}`

/**
 * İki öneri kümesini karşılaştırır.
 *
 * Arayüzün yalnızca değişeni vurgulaması içindir: her yazı tuşunda tüm
 * öneri listesini yeniden çizmek yerine, eklenen öneri belirir ve
 * karşılanan öneri sönümlenerek kaybolur.
 *
 * @param before - Önceki öneriler
 * @param after - Sonraki öneriler
 * @returns Eklenen, kaldırılan ve korunan öneriler
 *
 * @example
 * ```ts
 * const once = suggest(girdi)
 * const sonra = suggest({ ...girdi, currencyCode: 'USD' })
 * diffSuggestions(once, sonra).added.map((s) => s.id) // ['doviz/kur-zorunlu']
 * ```
 */
export const diffSuggestions = (
  before: readonly Suggestion[],
  after: readonly Suggestion[],
): SuggestionDiff => {
  const oncekiler = new Set(before.map(suggestionKey))
  const sonrakiler = new Set(after.map(suggestionKey))
  return {
    added: after.filter((s) => !oncekiler.has(suggestionKey(s))),
    removed: before.filter((s) => !sonrakiler.has(suggestionKey(s))),
    kept: after.filter((s) => oncekiler.has(suggestionKey(s))),
  }
}
