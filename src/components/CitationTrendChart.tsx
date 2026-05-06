// src/components/CitationTrendChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoryFile } from '../../scripts/lib/probe-types.ts';

interface Props {
  history: HistoryFile;
}

const MODEL_LABELS: Record<string, string> = {
  'anthropic/claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'openai/gpt-4o': 'GPT-4o',
  'perplexity/llama-3-sonar-large-online': 'Perplexity (web)',
  'google/gemini-2.0-pro': 'Gemini 2.0 Pro',
};

const MODEL_COLORS: Record<string, string> = {
  'anthropic/claude-sonnet-4-6': '#B45309',
  'openai/gpt-4o': '#1D4ED8',
  'perplexity/llama-3-sonar-large-online': '#16A34A',
  'google/gemini-2.0-pro': '#9333EA',
};

export default function CitationTrendChart({ history }: Props) {
  const data = history.map(entry => ({
    date: entry.runDate.slice(0, 10),
    ...Object.fromEntries(
      Object.entries(entry.byModel).map(([k, v]) => [k, v.citedPct]),
    ),
    overall: entry.overall.citedPct,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DDD8CF" />
          <XAxis dataKey="date" stroke="#57534E" />
          <YAxis stroke="#57534E" label={{ value: 'cited%', angle: -90, position: 'insideLeft', fill: '#57534E' }} />
          <Tooltip />
          <Legend />
          {Object.entries(MODEL_LABELS).map(([key, label]) => (
            <Line key={key} type="monotone" dataKey={key} name={label} stroke={MODEL_COLORS[key]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
