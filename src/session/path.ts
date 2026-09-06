import type { InvoiceBuilderLineInput, InvoiceInput } from '../builders/index.js'

/**
 * Belge düzeyindeki bir alanın adı.
 *
 * Doğrulama bulgularının ve {@link DocumentInputError} hatalarının `path`
 * alanı bu yazımı kullanır; form alanı ile bulgu aynı anahtarla eşleşir.
 */
export type DocumentPath = Extract<keyof InvoiceInput, string>

/** Satır düzeyindeki bir alanın yolu — `lines[0].vatRate` gibi. */
export type LinePath = `lines[${number}].${Extract<keyof InvoiceBuilderLineInput, string>}`

/**
 * Fatura girdisindeki bir alanın yolu.
 *
 * Yollar **tipten türer**, elle tutulan ya da kod üretimiyle oluşturulan
 * bir liste değildir. Girdiye yeni bir alan eklendiğinde yol kümesi
 * kendiliğinden genişler; senkron tutmak için ayrı bir doğrulama adımına
 * gerek kalmaz.
 */
export type InvoicePath = DocumentPath | LinePath

/**
 * Bir yolun işaret ettiği değerin tipi.
 *
 * `setPath` ve `getPath` bu eşlemeyle derleme zamanında denetlenir:
 * `setPath('lines[0].vatRate', 'yirmi')` derlenmez.
 */
export type PathValue<P extends InvoicePath> = P extends `lines[${number}].${infer F}`
  ? F extends keyof InvoiceBuilderLineInput
    ? InvoiceBuilderLineInput[F]
    : never
  : P extends keyof InvoiceInput
    ? InvoiceInput[P]
    : never

/** Çözümlenmiş bir yol. */
export type ParsedPath =
  | { readonly kind: 'document'; readonly field: DocumentPath }
  | {
      readonly kind: 'line'
      readonly index: number
      readonly field: Extract<keyof InvoiceBuilderLineInput, string>
    }

/** `lines[12].vatRate` biçimini yakalar; dizin yalnızca rakamlardan oluşur. */
const LINE_PATTERN = /^lines\[(\d+)\]\.([A-Za-z][A-Za-z0-9]*)$/

/**
 * Bir yol dizgesini çözümler.
 *
 * Doğrulama bulgusundan gelen `path`'i form alanına bağlamak için
 * kullanılır: bulgunun satır düzeyinde mi belge düzeyinde mi olduğunu ve
 * hangi alanı gösterdiğini söyler.
 *
 * @param path - Yol dizgesi
 * @returns Çözümlenmiş yol; tanınmayan biçim için `undefined`
 *
 * @example
 * ```ts
 * parseInvoicePath('type')             // { kind: 'document', field: 'type' }
 * parseInvoicePath('lines[2].vatRate') // { kind: 'line', index: 2, field: 'vatRate' }
 * parseInvoicePath('lines')            // { kind: 'document', field: 'lines' }
 * parseInvoicePath('lines[a].x')       // undefined
 * ```
 */
export const parseInvoicePath = (path: string): ParsedPath | undefined => {
  const eslesme = LINE_PATTERN.exec(path)
  if (eslesme !== null) {
    const [, dizin, alan] = eslesme
    // Yakalama grupları desen eşleştiğinde her zaman dolu; tip daraltma için.
    if (dizin === undefined || alan === undefined) return undefined
    return {
      kind: 'line',
      index: Number(dizin),
      field: alan as Extract<keyof InvoiceBuilderLineInput, string>,
    }
  }
  // Belge alanları düz adlardır; köşeli ayraç ya da nokta taşıyan başka
  // bir biçim tanınmaz ve sessizce belge alanı sayılmaz.
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(path)) return { kind: 'document', field: path as DocumentPath }
  return undefined
}

/**
 * Bir satır alanının yolunu üretir.
 *
 * Dizgeyi elle kurmaktansa bu yardımcıyı kullanmak, alan adının yazım
 * hatasını derleme zamanında yakalar.
 *
 * @param index - Sıfır tabanlı satır dizini
 * @param field - Satır alanının adı
 * @returns Yol dizgesi
 *
 * @example
 * ```ts
 * linePath(0, 'vatRate') // 'lines[0].vatRate'
 * ```
 */
export const linePath = <F extends Extract<keyof InvoiceBuilderLineInput, string>>(
  index: number,
  field: F,
): `lines[${number}].${F}` => `lines[${String(index) as `${number}`}].${field}`

/**
 * Bir yoldaki değeri okur.
 *
 * @param input - Fatura girdisi
 * @param path - Okunacak yol
 * @returns Değer; yol tanınmıyorsa ya da satır yoksa `undefined`
 *
 * @example
 * ```ts
 * readInvoicePath(girdi, 'type')              // 'SATIS'
 * readInvoicePath(girdi, 'lines[0].vatRate')  // 20
 * ```
 */
export const readInvoicePath = <P extends InvoicePath>(
  input: InvoiceInput,
  path: P,
): PathValue<P> | undefined => {
  const cozum = parseInvoicePath(path)
  if (cozum === undefined) return undefined
  if (cozum.kind === 'document') return input[cozum.field] as PathValue<P> | undefined
  return input.lines[cozum.index]?.[cozum.field] as PathValue<P> | undefined
}
