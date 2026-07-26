import * as React from "react"
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChartContainer } from "./chart-container"

interface LineChartSeries {
  dataKey: string
  label?: React.ReactNode
  color?: string
}

interface LineChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, unknown>[]
  xAxisDataKey: string
  series: LineChartSeries[]
  accessibleLabel?: string
  valueFormatter?: (value: number) => React.ReactNode
  xAxisFormatter?: (value: string) => React.ReactNode
}

const seriesColors = [
  "var(--primary)",
  "var(--secondary)",
  "var(--accent)",
  "var(--finance-accent)",
  "var(--ai-accent)",
  "var(--neutral-600)",
]

export function LineChart({
  data,
  xAxisDataKey,
  series,
  accessibleLabel,
  valueFormatter,
  xAxisFormatter,
  className,
  ...props
}: LineChartProps) {
  const uniqueSeriesColors = series.map((s, i) => s.color || seriesColors[i % seriesColors.length])

  return (
    <ChartContainer
      className={["w-full", className || ""].filter(Boolean).join(" ")}
      {...props}
    >
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey={xAxisDataKey}
              tickFormatter={(value) => {
                if (xAxisFormatter && typeof value === "string") return xAxisFormatter(value) as unknown as string
                return value as string
              }}
              stroke="var(--text-muted)"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tickFormatter={(value) => {
                if (valueFormatter && typeof value === "number") return valueFormatter(value) as unknown as string
                return String(value)
              }}
              stroke="var(--text-muted)"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                borderRadius: "0.5rem",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
            />
            {series.map((s, i) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={typeof s.label === "string" ? s.label : s.label !== undefined ? String(s.label) : undefined}
                stroke={uniqueSeriesColors[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      {accessibleLabel && (
        <div className="sr-only">{accessibleLabel}</div>
      )}
    </ChartContainer>
  )
}
