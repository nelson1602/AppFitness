import { useState, useEffect } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import { Spinner }              from '@/components/ui/Spinner'
import { ProfileForm }          from '@/features/profile/components/ProfileForm'
import { AccountSettingsForm }  from '@/features/profile/components/AccountSettingsForm'
import { fetchProfile }         from '@/features/profile/api'
import { useAuthStore }         from '@/store/auth.store'
import { useToast }             from '@/store/toast.store'
import type { UserProfile }     from '@/types/profile'
import type { User }            from '@/types'

type Tab = 'profile' | 'account'

export const ProfilePage = () => {
  usePageTitle('Profile')
  const { t } = useTranslation()
  const [tab,     setTab]    = useState<Tab>('profile')
  const [profile, setProfile]= useState<UserProfile | null>(null)
  const [loading, setLoading]= useState(true)

  const { user, setAuth } = useAuthStore()
  const toast = useToast()

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile', label: t('profile.tabs.profile') },
    { id: 'account', label: t('profile.tabs.account') },
  ]

  useEffect(() => {
    fetchProfile().then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [])

  const handleProfileSaved = (p: UserProfile) => {
    setProfile(p)
    toast('success', t('errors.profileSaved'))
  }

  const handleAccountUpdated = (updated: User) => {
    setAuth({ user: updated })
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('profile.title')}</h1>
        <p className="text-sm text-text-secondary mt-1">
          {t('profile.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 p-1 rounded-lg">
        {TABS.map(tab_ => (
          <button
            key={tab_.id}
            onClick={() => setTab(tab_.id)}
            className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
              tab === tab_.id
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="w-7 h-7 text-primary" />
            </div>
          ) : (
            <ProfileForm initial={profile} onSaved={handleProfileSaved} />
          )}
        </>
      )}

      {tab === 'account' && user && (
        <AccountSettingsForm user={user} onAccountUpdated={handleAccountUpdated} />
      )}
    </div>
  )
}
