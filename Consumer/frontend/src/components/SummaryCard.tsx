type SummaryCardProps = {
  label: string;
  value: string | number;
  accent?: 'blue' | 'purple' | 'green' | 'orange';
};

const accentStyles: Record<
  NonNullable<SummaryCardProps['accent']>,
  { background: string; textColor: string }
> = {
  blue: { background: 'linear-gradient(135deg, #edf7f2, #f3f7f4)', textColor: '#1f7a4d' },
  purple: { background: 'linear-gradient(135deg, #f3f7f4, #ffffff)', textColor: '#1f7a4d' },
  green: { background: '#1f7a4d', textColor: '#ffffff' },
  orange: { background: 'linear-gradient(135deg, #ffffff, #f3f7f4)', textColor: '#000000' },
};

export function SummaryCard({ label, value, accent = 'blue' }: SummaryCardProps) {
  const palette = accentStyles[accent];
  return (
    <div
      className="summary-card"
      style={{
        background: palette.background,
        color: palette.textColor,
      }}
    >
      <h3 style={{ color: palette.textColor }}>{label}</h3>
      <p style={{ color: palette.textColor }}>{value}</p>
    </div>
  );
}

