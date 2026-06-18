import { useState, FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { logBodyWeight } from '@/features/dashboard/api'
import type { WeightEntry } from '@/types/dashboard'

const toDateStr = (d: Date) => d.toISOString().split('T')[0]

interface LogWeightModalProps {
  open: boolean
  onClose: () => void
  onSaved: (entry: WeightEntry) => void
  latestWeight?: number | null
}

export const LogWeightModal = ({ open, onClose, onSaved, latestWeight }: LogWeightModalProps) => {
  const [weight, setWeight] = useState(latestWeight?.toString() ?? '')
  const [date, setDate] = useState(toDateStr(new Date()))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const w = parseFloat(weight)
    if (!w || w <= 0) { setError('Enter a valid weight'); return }
    setSaving(true)
    setError('')
    try {
      const entry = await logBodyWeight({ weight: w, date, notes: notes || undefined })
      onSaved(entry)
      onClose()
      setNotes('')
    } catch {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log body weight">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {error && (
          <p className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2">{error}</p>
        )}

        <Input
          label="Weight (kg)"
          type="number"
          step="0.1"
          min="20"
          max="500"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="75.0"
          required
          autoFocus
        />

        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={toDateStr(new Date())}
        />

        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Morning, fasted"
        />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
