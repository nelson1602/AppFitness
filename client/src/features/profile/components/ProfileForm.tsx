import { useState, FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import { saveProfile } from '../api'
import type { UserProfile, Equipment, PrimaryGoal, FitnessLevel, ActivityLevel } from '@/types/profile'

const GOALS: { value: PrimaryGoal; label: string }[] = [
  { value: 'lose_fat',            label: 'Lose Fat' },
  { value: 'build_muscle',        label: 'Build Muscle' },
  { value: 'maintain',            label: 'Maintain' },
  { value: 'improve_performance', label: 'Improve Performance' },
]
const LEVELS: { value: FitnessLevel; label: string }[] = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced' },
]
const ACTIVITIES: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary',   label: 'Sedentary (desk job)' },
  { value: 'light',       label: 'Light (1–3 days/wk)' },
  { value: 'moderate',    label: 'Moderate (3–5 days/wk)' },
  { value: 'active',      label: 'Active (6–7 days/wk)' },
  { value: 'very_active', label: 'Very Active (athlete)' },
]
const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'barbell',          label: 'Barbell' },
  { value: 'dumbbell',         label: 'Dumbbell' },
  { value: 'machines',         label: 'Machines' },
  { value: 'cables',           label: 'Cables' },
  { value: 'bodyweight',       label: 'Bodyweight' },
  { value: 'kettlebell',       label: 'Kettlebell' },
  { value: 'resistance_bands', label: 'Resistance Bands' },
]

function SelectField<T extends string>({
  label, value, onChange, options,
}: {
  label:   string
  value:   T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

interface Props {
  initial:  UserProfile | null
  onSaved:  (p: UserProfile) => void
}

export const ProfileForm = ({ initial, onSaved }: Props) => {
  const [birthDate,    setBirthDate]    = useState(initial?.birthDate    ?? '')
  const [gender,       setGender]       = useState(initial?.gender       ?? 'male')
  const [heightCm,     setHeightCm]     = useState(String(initial?.heightCm ?? ''))
  const [goal,         setGoal]         = useState<PrimaryGoal>(initial?.primaryGoal ?? 'maintain')
  const [targetWeight, setTargetWeight] = useState(String(initial?.targetWeightKg ?? ''))
  const [targetDate,   setTargetDate]   = useState(initial?.targetDate   ?? '')
  const [level,        setLevel]        = useState<FitnessLevel>(initial?.fitnessLevel ?? 'intermediate')
  const [activity,     setActivity]     = useState<ActivityLevel>(initial?.activityLevel ?? 'moderate')
  const [trainDays,    setTrainDays]    = useState(String(initial?.trainingDaysPerWeek ?? '3'))
  const [duration,     setDuration]     = useState(String(initial?.sessionDurationMins ?? '60'))
  const [equipment,    setEquipment]    = useState<Equipment[]>(initial?.equipment ?? [])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const toggleEquip = (e: Equipment) =>
    setEquipment(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await saveProfile({
        birthDate:           birthDate   || undefined,
        gender:              gender      || undefined,
        heightCm:            parseFloat(heightCm)     || undefined,
        primaryGoal:         goal,
        targetWeightKg:      parseFloat(targetWeight) || undefined,
        targetDate:          targetDate  || undefined,
        fitnessLevel:        level,
        activityLevel:       activity,
        trainingDaysPerWeek: parseInt(trainDays)  || 3,
        sessionDurationMins: parseInt(duration)   || 60,
        equipment,
      })
      onSaved(saved)
    } catch {
      setError('Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <p className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2">{error}</p>
      )}

      {/* Anthropometrics */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Anthropometrics</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date of Birth" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Gender</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input label="Height (cm)" type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" />
        </div>
      </section>

      {/* Goals */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Goal</h3>
        <SelectField label="Primary Goal" value={goal} onChange={setGoal} options={GOALS} />
        {(goal === 'lose_fat' || goal === 'build_muscle') && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Target Weight (kg)" type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="75" />
            <Input label="Target Date" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
        )}
      </section>

      {/* Experience & Activity */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Experience & Lifestyle</h3>
        <SelectField label="Fitness Level" value={level}    onChange={setLevel}    options={LEVELS} />
        <SelectField label="Activity Level" value={activity} onChange={setActivity} options={ACTIVITIES} />
      </section>

      {/* Schedule */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Training Schedule</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Days per week" type="number" min="1" max="7" value={trainDays} onChange={e => setTrainDays(e.target.value)} />
          <Input label="Session length (min)" type="number" min="15" max="240" value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
      </section>

      {/* Equipment */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Available Equipment</h3>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleEquip(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                equipment.includes(opt.value)
                  ? 'bg-primary text-background'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary border border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <Button type="submit" isLoading={saving} className="w-full">
        Save Profile
      </Button>
    </form>
  )
}
