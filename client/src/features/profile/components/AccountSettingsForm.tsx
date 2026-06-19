import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Mail, Phone, Image, Lock } from 'lucide-react'
import axios from 'axios'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { useToast } from '@/store/toast.store'
import { updateAccount, changePassword } from '../api'
import type { User } from '@/types'

interface Props {
  user: User
  onAccountUpdated: (user: User) => void
}

export const AccountSettingsForm = ({ user, onAccountUpdated }: Props) => {
  const { t } = useTranslation()

  // Account fields
  const [email,     setEmail]     = useState(user.email)
  const [phone,     setPhone]     = useState(user.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const [savingAccount, setSavingAccount] = useState(false)

  // Password fields
  const [currentPwd,    setCurrentPwd]    = useState('')
  const [newPwd,        setNewPwd]        = useState('')
  const [showCurrentPwd,setShowCurrentPwd]= useState(false)
  const [showNewPwd,    setShowNewPwd]    = useState(false)
  const [savingPwd,     setSavingPwd]     = useState(false)

  const toast = useToast()

  const handleAccountSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSavingAccount(true)
    try {
      const updated = await updateAccount({
        email:     email !== user.email ? email : undefined,
        phone:     phone || undefined,
        avatarUrl: avatarUrl || undefined,
      })
      onAccountUpdated(updated)
      toast('success', t('errors.accountUpdated'))
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? t('errors.updateFailed'))
        : t('errors.updateFailed')
      toast('error', msg)
    } finally {
      setSavingAccount(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPwd.length < 8) {
      toast('error', t('errors.passwordShort'))
      return
    }
    setSavingPwd(true)
    try {
      await changePassword({ currentPassword: currentPwd, newPassword: newPwd })
      setCurrentPwd('')
      setNewPwd('')
      toast('success', t('errors.passwordChanged'))
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? t('errors.passwordFailed'))
        : t('errors.passwordFailed')
      toast('error', msg)
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Account Info */}
      <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">{t('profile.accountInfo')}</h3>

        <Input
          label={t('profile.email')}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
        />
        <Input
          label={t('profile.phone')}
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          leftIcon={<Phone className="w-4 h-4" />}
          placeholder="+1 555 000 0000"
        />
        <Input
          label={t('profile.avatarUrl')}
          type="url"
          value={avatarUrl}
          onChange={e => setAvatarUrl(e.target.value)}
          leftIcon={<Image className="w-4 h-4" />}
          placeholder="https://..."
          hint={t('profile.avatarHint')}
        />

        {avatarUrl && (
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt="Avatar preview"
              className="w-14 h-14 rounded-full object-cover border border-border"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="text-xs text-text-muted">{t('profile.avatarPreview')}</span>
          </div>
        )}

        <Button type="submit" isLoading={savingAccount} className="w-full">
          {t('profile.saveAccount')}
        </Button>
      </form>

      <div className="border-t border-border" />

      {/* Change Password */}
      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">{t('profile.changePassword')}</h3>

        <Input
          label={t('profile.currentPassword')}
          type={showCurrentPwd ? 'text' : 'password'}
          value={currentPwd}
          onChange={e => setCurrentPwd(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowCurrentPwd(v => !v)}
              className="text-text-muted hover:text-text-secondary transition-colors"
              tabIndex={-1}
            >
              {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          autoComplete="current-password"
        />

        <Input
          label={t('profile.newPassword')}
          type={showNewPwd ? 'text' : 'password'}
          value={newPwd}
          onChange={e => setNewPwd(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowNewPwd(v => !v)}
              className="text-text-muted hover:text-text-secondary transition-colors"
              tabIndex={-1}
            >
              {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          hint={t('profile.passwordHint')}
          autoComplete="new-password"
        />

        <Button type="submit" isLoading={savingPwd} className="w-full">
          {t('profile.changePasswordBtn')}
        </Button>
      </form>

      <div className="border-t border-border" />

      {/* Preferences — Language */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">{t('profile.preferences')}</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{t('profile.language')}</span>
          <LanguageSelector />
        </div>
      </div>
    </div>
  )
}
