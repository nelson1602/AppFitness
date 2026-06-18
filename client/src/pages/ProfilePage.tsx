import { useState, useEffect } from 'react'
import { Spinner }     from '@/components/ui/Spinner'
import { ProfileForm } from '@/features/profile/components/ProfileForm'
import { fetchProfile } from '@/features/profile/api'
import type { UserProfile } from '@/types/profile'

export const ProfilePage = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    fetchProfile().then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [])

  const handleSaved = (p: UserProfile) => {
    setProfile(p)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Your Profile</h1>
        <p className="text-sm text-text-secondary mt-1">
          Accurate data here enables every engine to work optimally for you.
        </p>
      </div>

      {saved && (
        <div className="bg-primary/10 border border-primary/20 text-primary text-sm rounded-lg px-4 py-2.5">
          ✓ Profile saved successfully!
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-7 h-7 text-primary" />
        </div>
      ) : (
        <ProfileForm initial={profile} onSaved={handleSaved} />
      )}
    </div>
  )
}
