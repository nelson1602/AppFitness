interface Props {
  className?: string
}

export const Skeleton = ({ className = '' }: Props) => (
  <div className={`animate-pulse rounded bg-surface-2 ${className}`} />
)
