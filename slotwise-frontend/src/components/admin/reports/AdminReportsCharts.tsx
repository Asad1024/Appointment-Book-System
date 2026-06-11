'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = {
  brand: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#94a3b8',
};

const STATUS_PIE_COLORS = [
  CHART_COLORS.emerald,
  CHART_COLORS.brand,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.slate,
];

export type LineChartPoint = {
  date: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShows: number;
};
export type PieChartPoint = { name: string; value: number };
export type ServiceChartPoint = { name: string; revenue: number; fullName: string };

export function AdminReportsLineChart({ data }: { data: LineChartPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-text-secondary">No appointments in this period.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.slate} opacity={0.35} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={CHART_COLORS.slate} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={CHART_COLORS.slate} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="appointments"
            name="Appointments"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke={CHART_COLORS.emerald}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="cancelled"
            name="Cancelled"
            stroke={CHART_COLORS.red}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="noShows"
            name="No-shows"
            stroke={CHART_COLORS.amber}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminReportsStatusPieChart({ data }: { data: PieChartPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-text-secondary">No status data for this period.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={96}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminReportsServiceBarChart({
  data,
  currency,
}: {
  data: ServiceChartPoint[];
  currency: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-text-secondary">No service revenue in this period.</p>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.slate} opacity={0.35} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke={CHART_COLORS.slate} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11 }}
            stroke={CHART_COLORS.slate}
          />
          <Tooltip
            formatter={(value) => [
              new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
              }).format(Number(value)),
              'Revenue',
            ]}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ''
            }
          />
          <Bar dataKey="revenue" fill={CHART_COLORS.emerald} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
