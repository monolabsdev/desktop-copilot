import * as React from "react";
import { Input } from "@/components/ui/input";
import { keybindingFromEvent } from "@/shared/keybindings";

type KeybindInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function KeybindInput({
  value,
  onChange,
  className,
  ...props
}: KeybindInputProps) {
  const [isRecording, setIsRecording] = React.useState(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Backspace" || event.key === "Delete") {
      onChange("");
      return;
    }

    const next = keybindingFromEvent(event.nativeEvent);
    if (next) {
      onChange(next);
      setIsRecording(false);
    }
  };

  return (
    <Input
      {...props}
      value={value}
      readOnly
      onFocus={() => setIsRecording(true)}
      onBlur={() => setIsRecording(false)}
      onKeyDown={handleKeyDown}
      placeholder={isRecording ? "Press keys..." : "Click to record"}
      className={className}
    />
  );
}
