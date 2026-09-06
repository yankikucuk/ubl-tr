import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'

/**
 * `session` katmanı bu üç kardeşin ÜSTÜNDEDİR ve üçünü de import edebilir.
 * Oturum, belgeyi kurar (builders), doğrular (validators) ve gerektiğinde
 * okur (parsers); bu üçünü tek bir yerde birleştirmek onun görevidir.
 * Kardeşlerin hiçbiri `session`'a bakamaz.
 */

/**
 * Kardeş izolasyonu uygulanan katmanlar. Bu üçü aynı seviyededir ve
 * birbirini ÇAĞIRAMAZ: bir doğrulayıcının belge üretmesi ya da bir
 * ayrıştırıcının doğrulayıcıyı çağırması, tek yönlü olması gereken veri
 * akışını çift yönlü hâle getirir. Ortak ihtiyaç `core` ya da `documents`
 * katmanına iner.
 */
const SIBLINGS = ['builders', 'parsers', 'validators']
const SIBLING_MESSAGE =
  'builders/parsers/validators birbirine bağımlı olamaz; ortak ihtiyaç core veya documents katmanına iner.'

/** Bir katmanın import etmesi YASAK olan yolları üretir. */
const forbid = (patterns, message) => ({
  'no-restricted-imports': [
    'error',
    { patterns: patterns.map((group) => ({ group: [group], message })) },
  ],
})

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'fixtures'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'import-x': importX },
    // `import-x/no-cycle` gerçek dosya yolunu çözebilen bir resolver OLMADAN
    // hiçbir şey rapor etmez: `.js` uzantılı bir TS import'unu (`./b.js` ->
    // `./b.ts`) haritalayamadığı için sessizce hiç ateşlenmez. Sessiz
    // etkisizlik, kapalı bir kuraldan daha tehlikelidir — kural açık görünür
    // ama hiçbir şey korumaz.
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
      // `import-x`'in ExportMap tabanlı kuralları bir dosyayı ayrıştırmadan
      // ÖNCE uzantısını bu listeye karşı kontrol eder; varsayılan liste
      // yalnızca `.js/.mjs/.cjs` içerir. Bu ayar olmadan her `.ts` dosyası
      // sessizce "geçersiz uzantı" sayılıp atlanır ve `no-cycle` resolver
      // doğru çalışsa bile hiçbir zaman gerçek bir döngü görmez.
      'import-x/extensions': ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
    },
    rules: {
      'import-x/no-cycle': ['error', { maxDepth: Infinity }],
      'import-x/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // `const { city, ...rest } = input()` — bir alanı KASTEN dışarıda
      // bırakma deyimi. `city` hiç okunmaz; amaç zaten onu `rest`ten
      // ayıklamak. ESLint'in `no-unused-vars` varsayılanı
      // (`ignoreRestSiblings: false`) bunu ihlal sayar; kod bunu genellikle
      // `void city` ile susturur — ama ESLint 10 ile gelen
      // `no-meaningless-void-operator` o hileyi de yasaklar. İki kural
      // çelişince tek çıkış, deyimi kuralın kendi seçeneğiyle tanıtmaktır.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // eslint.config.js tsconfig.json'un include listesine girmez (yalnızca
  // *.config.ts eşleşir); tip-farkında lint bu dosyada projectService hatası
  // üretir, bu yüzden burada kapatılır.
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // ── Katman: constants ─────────────────────────────────────────────────
  // Yaprak. GİB kod listeleri ve ad alanı URI'leri. Hiçbir şeye bakamaz.
  {
    files: ['src/constants/**/*.ts'],
    rules: forbid(
      [
        '**/core/**',
        '**/documents/**',
        '**/builders/**',
        '**/parsers/**',
        '**/validators/**',
        '**/session/**',
      ],
      'constants yaprak katmandır; hiçbir üst katmana bağımlı olamaz.',
    ),
  },
  // ── Katman: core ──────────────────────────────────────────────────────
  // XML yazıcı/okuyucu, ad alanı yönetimi, tarih ve tutar biçimlendirme.
  // UBL-TR'nin İÇERİĞİNİ bilmez, yalnızca XML'i bilir.
  {
    files: ['src/core/**/*.ts'],
    rules: forbid(
      ['**/documents/**', '**/builders/**', '**/parsers/**', '**/validators/**', '**/session/**'],
      'core katmanı yalnızca constants yaprağına bağımlı olabilir.',
    ),
  },
  // ── Katman: documents ─────────────────────────────────────────────────
  // UBL-TR belge tip modeli. Kardeşlerin üçü de bunu SERBESTÇE import eder;
  // bu yüzden aşağıdaki kardeş izolasyonu listesinde yer almaz.
  {
    files: ['src/documents/**/*.ts'],
    rules: forbid(
      ['**/builders/**', '**/parsers/**', '**/validators/**', '**/session/**'],
      'documents katmanı yalnızca core ve constants katmanlarına bağımlı olabilir.',
    ),
  },
  // ── Kardeş izolasyonu ─────────────────────────────────────────────────
  //
  // DİKKAT: flat config'te aynı dosya seti için aynı kuralın SONRAKİ bir
  // bloktaki ayarı, öncekini BİRLEŞTİRMEZ — YERİNE GEÇİRİR. Bu yüzden her
  // kardeşin tüm yasakları tek bir `patterns` dizisinde toplanır; ayrı
  // bloklara bölünürse yalnızca sonuncusu yürürlükte kalır ve diğerleri
  // hiçbir uyarı vermeden yok olur.
  //
  // Desenler AÇIK yazılır. `../*/**` gibi bir joker `../../core/index.js`
  // yolunu da yakalar (minimatch'te `*`, `..` segmentiyle eşleşir) ve her
  // meşru core import'u yanlış pozitif olur.
  ...SIBLINGS.map((self) => ({
    files: [`src/${self}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // DİKKAT (I2): session yasağı kardeş desenleriyle AYNI dizide
          // olmak ZORUNDA. Ayrı bir blok bu diziyi tamamen ezer ve kardeş
          // izolasyonu sessizce yok olur — canlı olarak yaşandı.
          patterns: [
            ...SIBLINGS.filter((other) => other !== self)
              .flatMap((other) => [`../${other}/**`, `../../${other}/**`])
              .map((group) => ({ group: [group], message: SIBLING_MESSAGE })),
            {
              group: ['**/session/**'],
              message: 'session en üst katmandır; alt katmanlar ona bağımlı olamaz.',
            },
          ],
        },
      ],
    },
  })),
  // Testler daha gevşek.
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  prettier,
)
