export default function EmptyChart({
  message = 'No data available',
}: {
  message?: string
}) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-dome-border">
      <p className="text-sm text-dome-muted">{message}</p>
    </div>
  )
}
