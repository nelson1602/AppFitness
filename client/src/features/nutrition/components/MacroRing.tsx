interface MacroRingProps {
  protein: number
  carbs: number
  fat: number
}

const R = 48
const CX = 64
const CY = 64
const CIRC = 2 * Math.PI * R
const STROKE = 14

const SEGMENTS = [
  { key: 'protein', color: '#3B82F6', factor: 4 },
  { key: 'carbs',   color: '#F59E0B', factor: 4 },
  { key: 'fat',     color: '#EF4444', factor: 9 },
] as const

export const MacroRing = ({ protein, carbs, fat }: MacroRingProps) => {
  const values = { protein, carbs, fat }
  const calValues = SEGMENTS.map((s) => values[s.key] * s.factor)
  const total = Math.max(calValues.reduce((a, b) => a + b, 0), 1)
  const totalCals = Math.round(protein * 4 + carbs * 4 + fat * 9)
  const empty = totalCals === 0

  let cumFraction = 0

  return (
    <svg width={128} height={128} viewBox="0 0 128 128">
      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#2A2A2A" strokeWidth={STROKE} />

      {!empty &&
        SEGMENTS.map((seg, i) => {
          const fraction = calValues[i] / total
          const len = fraction * CIRC
          const rotation = cumFraction * 360 - 90
          cumFraction += fraction
          return (
            <circle
              key={seg.key}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${len} ${CIRC - len}`}
              transform={`rotate(${rotation} ${CX} ${CY})`}
            />
          )
        })}

      {/* Center label */}
      <text x={CX} y={CY - 7} textAnchor="middle" fill="#FFFFFF" fontSize={20} fontWeight="700" fontFamily="Inter, sans-serif">
        {totalCals}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fill="#666666" fontSize={11} fontFamily="Inter, sans-serif">
        kcal
      </text>
    </svg>
  )
}
