/** Doğrulama bulgusunun ağırlığı. */
export type IssueSeverity = 'error' | 'warning'

/** Tek bir doğrulama bulgusu. */
export interface ValidationIssue {
  /**
   * Makine tarafından okunacak, sürümler arası kararlı kod.
   *
   * Mesaj metni değişebilir; kararlar bu kod üzerinden verilmelidir.
   */
  readonly code: string
  /** Bulgunun belgedeki konumu, nitelikli adlarla (`Invoice/cac:InvoiceLine[1]`). */
  readonly path: string
  /** İnsan için açıklama. */
  readonly message: string
  /**
   * Ağırlık.
   *
   * `'error'` belgenin reddedileceği anlamına gelir; `'warning'` belgenin
   * geçerli olduğu ama beklenmedik bir şey içerdiği anlamına gelir.
   */
  readonly severity: IssueSeverity
}

/** Bir doğrulamanın sonucu. */
export interface ValidationResult {
  /** Hiç `'error'` ağırlıklı bulgu yoksa `true`. */
  readonly valid: boolean
  /** Bulunan tüm bulgular, belgedeki sıralarına göre. */
  readonly issues: readonly ValidationIssue[]
}

/**
 * Bulgu listesinden sonuç nesnesi kurar.
 *
 * @param issues - Bulgular
 * @returns Doğrulama sonucu
 *
 * @example
 * ```ts
 * toResult([]) // { valid: true, issues: [] }
 * ```
 */
export const toResult = (issues: readonly ValidationIssue[]): ValidationResult => ({
  valid: !issues.some((i) => i.severity === 'error'),
  issues,
})
