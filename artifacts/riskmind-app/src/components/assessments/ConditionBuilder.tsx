import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import type { BranchCondition, AssessmentQuestion } from "./types";

interface ConditionBuilderProps {
  conditions: BranchCondition[];
  availableQuestions: AssessmentQuestion[];
  onChange: (conditions: BranchCondition[]) => void;
}

export function ConditionBuilder({
  conditions,
  availableQuestions,
  onChange,
}: ConditionBuilderProps) {
  const addCondition = () => {
    const newCondition: BranchCondition = {
      questionId: availableQuestions[0]?.id ?? "",
      operator: "equals",
      value: "",
      action: "show",
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    patch: Partial<BranchCondition>
  ) => {
    onChange(
      conditions.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  return (
    <div className="space-y-2">
      {conditions.length === 0 && (
        <p className="text-xs text-muted-foreground">No conditions defined.</p>
      )}
      {conditions.map((condition, index) => (
        <div
          key={index}
          className="flex items-center gap-2 flex-wrap rounded-md border border-border p-2 bg-muted/30"
        >
          {/* Question selector */}
          <Select
            value={condition.questionId}
            onValueChange={(v) => updateCondition(index, { questionId: v })}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Select question" />
            </SelectTrigger>
            <SelectContent>
              {availableQuestions.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.text.length > 40 ? q.text.slice(0, 40) + "…" : q.text || `Question ${q.id.slice(0, 6)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator */}
          <Select
            value={condition.operator}
            onValueChange={(v) =>
              updateCondition(index, {
                operator: v as BranchCondition["operator"],
              })
            }
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">equals</SelectItem>
              <SelectItem value="contains">contains</SelectItem>
              <SelectItem value="greater_than">greater than</SelectItem>
            </SelectContent>
          </Select>

          {/* Value */}
          <Input
            className="w-28 h-8 text-xs"
            placeholder="Value"
            value={String(condition.value)}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
          />

          {/* Show / Hide toggle */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Hide</Label>
            <Switch
              checked={condition.action === "show"}
              onCheckedChange={(checked) =>
                updateCondition(index, { action: checked ? "show" : "hide" })
              }
              className="scale-90"
            />
            <Label className="text-xs text-muted-foreground">Show</Label>
          </div>

          {/* Remove */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => removeCondition(index)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
        onClick={addCondition}
        disabled={availableQuestions.length === 0}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Condition
      </Button>
    </div>
  );
}
