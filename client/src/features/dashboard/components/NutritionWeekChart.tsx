import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { DailyNutrition } from '@/types/dashboard'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((a, p) => a + p.value, 0)
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 text-xs shadow-lg min-w-[120px]">
      <p className="text-text-muted mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-text-primary font-mono">{p.value}g</span>
        </div>
      ))}
      <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between">
        <span className="text-text-muted">Total</span>
        <span className="text-text-primary font-semibold font-mono">{total} kcal</span>
      </div>
    </div>
  )
}

export const NutritionWeekChart = ({ data }: { data: DailyNutrition[] }) => {
  const hasData = data.some((d) => d.calories > 0)

  // Convert protein/carbs/fat grams to kcal for the stacked chart
  const chartData = data.map((d, i) => ({
    day: DAY_LABELS[i] ?? d.date,
    Protein: d.protein * 4,
    Carbs: d.carbs * 4,
    Fat: d.fat * 9,
  }))

  if (!hasData) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No nutrition data this week
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barSize={24}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: '#666666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#666666', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
          width={36}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#2A2A2A' }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#A0A0A0', paddingTop: 8 }}
        />
        <Bar dataKey="Protein" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Carbs"   stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Fat"     stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
