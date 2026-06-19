import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const

export const LanguageSelector = () => {
  const { i18n } = useTranslation()
  const current = i18n.language

  const change = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('appLanguage', code)
  }

  return (
    <div className="flex gap-1.5" role="group" aria-label="Language">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => change(code)}
          aria-pressed={current === code}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            current === code
              ? 'bg-primary text-white'
              : 'bg-surface-2 text-text-secondary hover:text-text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
