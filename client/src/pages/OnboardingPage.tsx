import { useState } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNavigate } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import { saveProfile }   from '@/features/profile/api'
import { logBodyWeight } from '@/features/dashboard/api'
import type { PrimaryGoal, FitnessLevel, ActivityLevel, Equipment } from '@/types/profile'

const STEPS = ['About You', 'Weight & Goal', 'Training', 'Lifestyle']

const GOALS: { value: PrimaryGoal; label: string; desc: string }[] = [
  { value: 'lose_fat',            label: 'Lose Fat',            desc: 'Reduce body fat while preserving muscle' },
  { value: 'build_muscle',        label: 'Build Muscle',        desc: 'Increase muscle mass and strength' },
  { value: 'maintain',            label: 'Maintain',            desc: 'Keep your current physique' },
  { value: 'improve_performance', label: 'Improve Performance', desc: 'Athletic endurance & performance' },
]
const LEVELS: { value: FitnessLevel; label: string; desc: string }[] = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Less than 1 year of consistent training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years of consistent training' },
  { value: 'advanced',     label: 'Advanced',     desc: '3+ years of serious training' },
]
const ACTIVITIES: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',      desc: 'Desk job, little daily movement' },
  { value: 'light',       label: 'Light',          desc: '1–3 light workouts per week' },
  { value: 'moderate',    label: 'Moderate',       desc: '3–5 workouts per week' },
  { value: 'active',      label: 'Active',         desc: '6–7 workouts per week' },
  { value: 'very_active', label: 'Very Active',    desc: 'Physical job + daily training' },
]
const EQUIP_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'bodyweight',       label: 'Bodyweight' },
  { value: 'resistance_bands', label: 'Bands' },
  { value: 'dumbbell',         label: 'Dumbbells' },
  { value: 'kettlebell',       label: 'Kettlebells' },
  { value: 'barbell',          label: 'Barbell' },
  { value: 'cables',           label: 'Cables' },
  { value: 'machines',         label: 'Machines' },
]

const STEP_HINTS = [
  'We need this to calculate your TDEE and personalize every engine.',
  "Your current weight sets calorie targets. Choose a goal we'll train toward together.",
  'This shapes your workout program — intensity, schedule, and available gear.',
  'Lifestyle factors affect recovery and daily energy expenditure.',
]

interface Props { onComplete: () => void }

export const OnboardingPage = ({ onComplete }: Props) => {
  usePageTitle('Onboarding')
  const navigate = useNavigate()
  const [step, setStepp] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Step 0
  const [birthDate, setBirthDate] = useState('')
  const [gender,    setGender]    = useState('male')
  const [heightCm,  setHeightCm]  = useState('')

  // Step 1
  const [weight,       setWeight]       = useState('')
  const [goal,         setGoal]         = useState<PrimaryGoal>('build_muscle')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetDate,   setTargetDate]   = useState('')

  // Step 2
  const [level,        setLevel]        = useState<FitnessLevel>('beginner')
  const [yearsTrain,   setYearsTrain]   = useState('0')
  const [trainDays,    setTrainDays]    = useState('3')
  const [sessionMins,  setSessionMins]  = useState('60')
  const [equipment,    setEquipment]    = useState<Equipment[]>(['bodyweight'])

  // Step 3
  const [activity,   setActivity]   = useState<ActivityLevel>('moderate')
  const [occupation, setOccupation] = useState('')
  const [sleep,      setSleep]      = useState('7')
  const [stress,     setStress]     = useState('3')

  const toggleEquip = (e: Equipment) =>
    setEquipment(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])

  const canProceed = () => {
    if (step === 0) return !!(birthDate && heightCm)
    if (step === 1) return !!(weight)
    return true
  }

  const finish = async () => {
    setSaving(true)
    setError('')
    const today = new Date().toISOString().split('T')[0]
    try {
      await Promise.all([
        saveProfile({
          birthDate,
          gender,
          heightCm:            parseFloat(heightCm),
          primaryGoal:         goal,
          targetWeightKg:      targetWeight ? parseFloat(targetWeight) : undefined,
          targetDate:          targetDate   || undefined,
          fitnessLevel:        level,
          yearsTraining:       parseFloat(yearsTrain) || 0,
          trainingDaysPerWeek: parseInt(trainDays)    || 3,
          sessionDurationMins: parseInt(sessionMins)  || 60,
          equipment,
          activityLevel:       activity,
          occupation:          occupation || undefined,
          sleepHours:          parseFloat(sleep)  || 7,
          stressLevel:         parseInt(stress)   || 3,
        }),
        logBodyWeight({ weight: parseFloat(weight), date: today }),
      ])
      onComplete()
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const next = () => { if (step < STEPS.length - 1) setStepp(s => s + 1); else finish() }
  const back = () => setStepp(s => s - 1)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <Dumbbell className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-text-primary">AppFitness</span>
      </div>

      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex items-start gap-0 mb-6">
          {STEPS.map((name, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Dot + connector line */}
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 transition-colors duration-300 ${i <= step ? 'bg-primary' : 'bg-surface-2'}`} />
                )}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                  i < step  ? 'bg-primary text-white' :
                  i === step ? 'bg-primary/20 border-2 border-primary text-primary' :
                               'bg-surface-2 border border-border text-text-muted'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 transition-colors duration-300 ${i < step ? 'bg-primary' : 'bg-surface-2'}`} />
                )}
              </div>
              {/* Step label */}
              <span className={`text-xs text-center leading-tight transition-colors ${
                i === step ? 'text-primary font-medium' : 'text-text-muted'
              }`}>
                {name}
              </span>
            </div>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-1">{STEPS[step]}</h1>
        <p className="text-sm text-text-secondary mb-6">{STEP_HINTS[step]}</p>

        {error && (
          <p className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2 mb-4">{error}</p>
        )}

        {/* ── Step 0: About You ──────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Date of Birth"
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {['male', 'female', 'other'].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      gender === g
                        ? 'bg-primary text-white'
                        : 'bg-surface-2 border border-border text-text-secondary hover:border-primary/50'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Height (cm)"
              type="number"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value)}
              placeholder="175"
            />
          </div>
        )}

        {/* ── Step 1: Weight & Goal ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Current Weight (kg)"
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="75"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Primary Goal</label>
              <div className="flex flex-col gap-2">
                {GOALS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoal(g.value)}
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                      goal === g.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface-2 hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${
                      goal === g.value ? 'border-primary bg-primary' : 'border-border'
                    }`} />
                    <div>
                      <p className={`text-sm font-semibold ${goal === g.value ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {g.label}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{g.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {(goal === 'lose_fat' || goal === 'build_muscle') && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Target Weight (kg)" type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="70" />
                <Input label="Target Date"        type="date"   value={targetDate}   onChange={e => setTargetDate(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Training ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Experience Level</label>
              <div className="flex flex-col gap-2">
                {LEVELS.map(l => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLevel(l.value)}
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                      level === l.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface-2 hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${
                      level === l.value ? 'border-primary bg-primary' : 'border-border'
                    }`} />
                    <div>
                      <p className={`text-sm font-semibold ${level === l.value ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {l.label}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{l.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Years training" type="number" min="0" max="50" value={yearsTrain}  onChange={e => setYearsTrain(e.target.value)}  placeholder="0" />
              <Input label="Days / week"    type="number" min="1" max="7"  value={trainDays}   onChange={e => setTrainDays(e.target.value)}   placeholder="3" />
              <Input label="Min / session"  type="number" min="15" max="240" value={sessionMins} onChange={e => setSessionMins(e.target.value)} placeholder="60" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-text-secondary">Available Equipment</label>
              <div className="flex flex-wrap gap-2">
                {EQUIP_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleEquip(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      equipment.includes(opt.value)
                        ? 'bg-primary text-white'
                        : 'bg-surface-2 border border-border text-text-secondary hover:border-primary/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Lifestyle ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Daily Activity Level</label>
              <div className="flex flex-col gap-2">
                {ACTIVITIES.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setActivity(a.value)}
                    className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors ${
                      activity === a.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface-2 hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${
                      activity === a.value ? 'border-primary bg-primary' : 'border-border'
                    }`} />
                    <div>
                      <p className={`text-sm font-semibold ${activity === a.value ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {a.label}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Occupation (optional)"
              type="text"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              placeholder="e.g. Office worker, construction..."
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary">Sleep (hrs/night)</label>
                <select
                  value={sleep}
                  onChange={e => setSleep(e.target.value)}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  {['5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10'].map(v => (
                    <option key={v} value={v}>{v} hrs</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary">Stress Level</label>
                <select
                  value={stress}
                  onChange={e => setStress(e.target.value)}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="1">1 — Very low</option>
                  <option value="2">2 — Low</option>
                  <option value="3">3 — Moderate</option>
                  <option value="4">4 — High</option>
                  <option value="5">5 — Very high</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="secondary" onClick={back} className="flex-1">
              Back
            </Button>
          )}
          <Button
            onClick={next}
            isLoading={saving}
            disabled={!canProceed()}
            className="flex-1"
          >
            {step === STEPS.length - 1 ? 'Finish Setup' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
