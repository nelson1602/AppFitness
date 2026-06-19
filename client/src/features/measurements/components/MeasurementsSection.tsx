import { useState, useEffect } from 'react'
import { Ruler, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card }    from '@/components/ui/Card'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { useToast } from '@/store/toast.store'
import { fetchMeasurements, saveMeasurement } from '../api'
import type { BodyMeasurement } from '@/types/measurement'

type NumericKey = 'bodyFatPct' | 'waistCm' | 'hipCm' | 'chestCm' | 'leftArmCm' | 'neckCm'

const DISPLAY_FIELDS: { key: NumericKey; label: string; unit: string }[] = [
  { key: 'bodyFatPct', label: 'Body Fat',  unit: '%'  },
  { key: 'waistCm',   label: 'Waist',     unit: 'cm' },
  { key: 'hipCm',     label: 'Hip',       unit: 'cm' },
  { key: 'chestCm',   label: 'Chest',     unit: 'cm' },
  { key: 'leftArmCm', label: 'Arm',       unit: 'cm' },
  { key: 'neckCm',    label: 'Neck',      unit: 'cm' },
]

const today = () => new Date().toISOString().split('T')[0]

export const MeasurementsSection = () => {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)

  const toast = useToast()

  const [date,    setDate]    = useState(today())
  const [bodyFat, setBodyFat] = useState('')
  const [waist,   setWaist]   = useState('')
  const [hip,     setHip]     = useState('')
  const [chest,   setChest]   = useState('')
  const [arm,     setArm]     = useState('')
  const [neck,    setNeck]    = useState('')

  useEffect(() => {
    fetchMeasurements().then(setMeasurements).catch(() => {})
  }, [])

  const latest = measurements[0] ?? null

  const handleSave = async () => {
    const payload = {
      date,
      ...(bodyFat ? { bodyFatPct: parseFloat(bodyFat) } : {}),
      ...(waist   ? { waistCm:    parseFloat(waist)   } : {}),
      ...(hip     ? { hipCm:      parseFloat(hip)     } : {}),
      ...(chest   ? { chestCm:    parseFloat(chest)   } : {}),
      ...(arm     ? { leftArmCm:  parseFloat(arm)     } : {}),
      ...(neck    ? { neckCm:     parseFloat(neck)    } : {}),
    }
    const hasValues = bodyFat || waist || hip || chest || arm || neck
    if (!hasValues) return

    setSaving(true)
    try {
      const saved = await saveMeasurement(payload)
      setMeasurements(prev => {
        const idx = prev.findIndex(m => m.date === saved.date)
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
        return [saved, ...prev]
      })
      setShowForm(false)
      setBodyFat(''); setWaist(''); setHip(''); setChest(''); setArm(''); setNeck('')
      toast('success', 'Measurements saved.')
    } catch {
      toast('error', 'Failed to save measurements.')
    } finally {
      setSaving(false)
    }
  }

  const chartData = [...measurements]
    .reverse()
    .slice(-12)
    .map(m => ({
      date:    m.date.slice(5),
      waist:   m.waistCm    ?? undefined,
      bodyFat: m.bodyFatPct ?? undefined,
    }))

  return (
    <Card className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-text-primary">Body Measurements</h2>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Log
          {showForm
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Latest snapshot */}
      {latest ? (
        <div className="grid grid-cols-3 gap-2">
          {DISPLAY_FIELDS.map(f => {
            const val = latest[f.key]
            if (val == null) return null
            return (
              <div key={f.key} className="bg-surface-2 rounded-lg px-3 py-2">
                <p className="text-xs text-text-muted">{f.label}</p>
                <p className="text-sm font-bold text-text-primary">{val}{f.unit}</p>
              </div>
            )
          })}
        </div>
      ) : !showForm ? (
        <p className="text-sm text-text-secondary text-center py-4">
          No measurements logged yet.
        </p>
      ) : null}

      {/* Log form */}
      {showForm && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Body Fat (%)"  type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="18.5" />
            <Input label="Waist (cm)"    type="number" step="0.1" value={waist}   onChange={e => setWaist(e.target.value)}   placeholder="82"   />
            <Input label="Hip (cm)"      type="number" step="0.1" value={hip}     onChange={e => setHip(e.target.value)}     placeholder="96"   />
            <Input label="Chest (cm)"    type="number" step="0.1" value={chest}   onChange={e => setChest(e.target.value)}   placeholder="100"  />
            <Input label="Arm (cm)"      type="number" step="0.1" value={arm}     onChange={e => setArm(e.target.value)}     placeholder="34"   />
            <Input label="Neck (cm)"     type="number" step="0.1" value={neck}    onChange={e => setNeck(e.target.value)}    placeholder="38"   />
          </div>
          <Button onClick={handleSave} isLoading={saving} className="w-full">
            Save Measurements
          </Button>
        </div>
      )}

      {/* Trend chart */}
      {chartData.length >= 2 && (
        <div className="flex flex-col gap-1 pt-1 border-t border-border">
          <p className="text-xs text-text-muted">Waist &amp; Body Fat Trend</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background:   'var(--color-surface)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize:     11,
                  }}
                  labelStyle={{ color: 'var(--color-text-secondary)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="waist"
                  name="Waist (cm)"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="bodyFat"
                  name="Body Fat (%)"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  )
}
