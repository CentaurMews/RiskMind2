import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { getScoreTier } from "./types";

interface ScoreGaugeProps {
  score: number;
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const tier = getScoreTier(score);
  const data = [{ value: score }];

  return (
    <div className="relative flex flex-col items-center">
      <RadialBarChart
        width={200}
        height={200}
        innerRadius={70}
        outerRadius={90}
        data={data}
        startAngle={90}
        endAngle={-270}
        barSize={12}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar
          dataKey="value"
          fill={tier.color}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
          cornerRadius={6}
          background={{ fill: "hsl(var(--muted))" }}
        />
      </RadialBarChart>

      {/* Center overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[28px] font-semibold leading-none">{Math.round(score)}</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
          {tier.label}
        </span>
      </div>
    </div>
  );
}
