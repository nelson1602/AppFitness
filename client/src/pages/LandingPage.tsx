import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Activity, Brain, Dumbbell, Utensils, TrendingUp, Zap, Heart } from 'lucide-react'

export const LandingPage = () => {
  usePageTitle()
  const { t } = useTranslation()

  const FEATURES = [
    { icon: Brain,    key: 'aiCoach'       },
    { icon: Dumbbell, key: 'routines'      },
    { icon: Utensils, key: 'nutrition'     },
    { icon: TrendingUp, key: 'progress'   },
    { icon: Heart,    key: 'readiness'    },
    { icon: Activity, key: 'fitnessScore' },
  ] as const

  return (
  <div className="min-h-screen bg-background text-text-primary">

    {/* ── Nav ────────────────────────────────────────────────────────────────── */}
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary-muted flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="font-extrabold text-text-primary tracking-tight">AppFitness</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface"
          >
            {t('landing.signIn')}
          </Link>
          <Link
            to="/register"
            className="text-sm font-bold bg-primary text-black px-4 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            {t('landing.register')}
          </Link>
        </div>
      </div>
    </header>

    {/* ── Hero ───────────────────────────────────────────────────────────────── */}
    <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center animate-fade-in">
      <div className="inline-flex items-center gap-2 bg-primary-muted border border-primary/20 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-6">
        <Zap className="w-3 h-3" />
        {t('landing.badge')}
      </div>

      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 leading-tight">
        {t('landing.heading').split('.')[0]}.{' '}
        <span className="text-primary">{t('landing.heading').split('.')[1]?.trim()}</span>
      </h1>

      <p className="text-lg text-text-secondary max-w-xl mx-auto mb-8">
        {t('landing.subheading')}
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/register"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-black font-bold text-base px-8 py-3 rounded-xl hover:bg-primary-hover transition-colors shadow-glow"
        >
          {t('landing.cta1')} <span aria-hidden>→</span>
        </Link>
        <Link
          to="/login"
          className="w-full sm:w-auto inline-flex items-center justify-center text-base font-medium text-text-secondary hover:text-text-primary border border-border px-8 py-3 rounded-xl transition-colors hover:bg-surface"
        >
          {t('landing.cta2')}
        </Link>
      </div>
    </section>

    {/* ── Features ───────────────────────────────────────────────────────────── */}
    <section className="max-w-5xl mx-auto px-4 pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(({ icon: Icon, key }) => (
          <div
            key={key}
            className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary mb-1">{t(`landing.features.${key}.title`)}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{t(`landing.features.${key}.desc`)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* ── Bottom CTA ─────────────────────────────────────────────────────────── */}
    <section className="border-t border-border bg-surface">
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-3">
          {t('landing.ctaTitle')}
        </h2>
        <p className="text-text-secondary mb-6 max-w-md mx-auto">
          {t('landing.ctaSubtitle')}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-primary text-black font-bold text-base px-8 py-3 rounded-xl hover:bg-primary-hover transition-colors shadow-glow"
        >
          {t('landing.ctaBtn')} <span aria-hidden>→</span>
        </Link>
      </div>
    </section>

    {/* ── Footer ─────────────────────────────────────────────────────────────── */}
    <footer className="border-t border-border">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-text-secondary">AppFitness</span>
        </div>
        <span>{t('landing.footerTagline')}</span>
      </div>
    </footer>

  </div>
  )
}
