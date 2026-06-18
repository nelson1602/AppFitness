import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import type { WeeklyVolume } from '@/types/dashboard'

const fmtWeek = (s: string) => {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const fmtVol = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}`)

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted mb-1">{label ? fmtWeek(label) : ''}</p>
      <p className="text-text-primary font-semibold">{payload[0].value.toLocaleString()} kg vol</p>
    </div>
  )
}

export const VolumeChart = ({ data }: { data: WeeklyVolume[] }) => {
  if (data.every((d) => d.volume === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No workout data yet
      </div>
    )
  }

  const maxVol = Math.max(...data.map((d) => d.volume))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="week"
          tickFormatter={fmtWeek}
          tick={{ fill: '#666666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#666666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtVol}
          width={36}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#2A2A2A' }} />
        <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.volume === maxVol ? '#CCFF00' : '#2A2A2A'}
              stroke={entry.volume === maxVol ? 'none' : '#333333'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
