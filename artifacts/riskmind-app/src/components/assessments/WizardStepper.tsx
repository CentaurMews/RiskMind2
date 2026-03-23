import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepSection {
  id: string;
  name: string;
}

interface WizardStepperProps {
  sections: StepSection[];
  currentIndex: number;
  completedSections: string[];
}

export function WizardStepper({ sections, currentIndex, completedSections }: WizardStepperProps) {
  const currentSection = sections[currentIndex];

  return (
    <>
      {/* Mobile: simple text */}
      <div className="md:hidden flex items-center justify-between text-sm text-muted-foreground py-2">
        <span className="font-medium text-foreground truncate">{currentSection?.name}</span>
        <span>Step {currentIndex + 1} of {sections.length}</span>
      </div>

      {/* Desktop: full stepper */}
      <div className="hidden md:flex items-center w-full py-2">
        {sections.map((section, index) => {
          const isCompleted = completedSections.includes(section.id);
          const isCurrent = index === currentIndex;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div key={section.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                {/* Dot */}
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full transition-colors",
                    "h-2.5 w-2.5",
                    isCompleted && "bg-primary",
                    isCurrent && "bg-primary",
                    isUpcoming && "border border-muted-foreground/40 bg-muted"
                  )}
                >
                  {isCompleted && (
                    <Check className="h-1.5 w-1.5 text-primary-foreground stroke-[3]" />
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    "mt-1 text-xs max-w-[80px] truncate text-center leading-tight",
                    isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={section.name}
                >
                  {section.name.length > 15 ? section.name.slice(0, 14) + "…" : section.name}
                </span>
              </div>

              {/* Connector line (not after last) */}
              {index < sections.length - 1 && (
                <div className="flex-1 h-px mx-2 mb-4">
                  <div
                    className={cn(
                      "h-full transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
