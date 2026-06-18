import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { WeightEntry } from '@/types/dashboard'

const fmtDate = (s: string) => {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-text-primary font-semibold">{payload[0].value} kg</p>
    </div>
  )
}

interface WeightChartProps {
  data: WeightEntry[]
  onDeleteEntry?: (id: string) => void
}

export const WeightChart = ({ data }: WeightChartProps) => {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No weight entries yet — log your first one below
      </div>
    )
  }

  const yMin = Math.floor(Math.min(...data.map((d) => d.weight)) - 1)
  const yMax = Math.ceil(Math.max(...data.map((d) => d.weight)) + 1)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: '#666666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fill: '#666666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
          width={36}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#333333' }} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#CCFF00"
          strokeWidth={2}
          dot={{ fill: '#CCFF00', r: 3, strokeWidth: 0 }}
          activeDot={{ fill: '#CCFF00', r: 5, strokeWidth: 2, stroke: '#121212' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
