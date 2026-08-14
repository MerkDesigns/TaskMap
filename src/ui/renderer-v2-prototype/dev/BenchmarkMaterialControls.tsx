// DEV/PROTOTYPE ONLY — do not port with Renderer V2 production implementation.
import { ActionIcon, ColorInput, Group, Slider, Text, TextInput } from "@mantine/core";
import { IconRestore } from "@tabler/icons-react";

export function ResettableText({ label, value, resetValue, onChange }: TextControlProps) {
  return (
    <Group align="end" gap={6} wrap="nowrap">
      <TextInput
        label={label}
        description="Tokens: {number}, {status}"
        size="xs"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="flex-1"
      />
      <ResetButton label={label} onClick={() => onChange(resetValue)} />
    </Group>
  );
}

interface TextControlProps {
  readonly label: string;
  readonly value: string;
  readonly resetValue: string;
  readonly onChange: (value: string) => void;
}

export function ResettableSlider({
  label,
  value,
  resetValue,
  minimum,
  maximum,
  step,
  onChange,
}: SliderControlProps) {
  return (
    <div>
      <Group justify="space-between" gap="xs" mb={4}>
        <Text size="xs" fw={600}>
          {label} · {Number.isInteger(value) ? value : value.toFixed(2)}
        </Text>
        <ResetButton label={label} onClick={() => onChange(resetValue)} />
      </Group>
      <Slider
        value={value}
        min={minimum}
        max={maximum}
        step={step}
        thumbLabel={label}
        onChange={onChange}
      />
    </div>
  );
}

interface SliderControlProps {
  readonly label: string;
  readonly value: number;
  readonly resetValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

export function ResettableColor({ label, value, resetValue, onChange }: TextControlProps) {
  return (
    <Group align="end" gap={6} wrap="nowrap">
      <ColorInput
        label={label}
        size="xs"
        value={value}
        popoverProps={{ withinPortal: false }}
        onChange={onChange}
        className="flex-1"
      />
      <ResetButton label={label} onClick={() => onChange(resetValue)} />
    </Group>
  );
}

function ResetButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <ActionIcon size="sm" variant="subtle" aria-label={`Reset ${label}`} onClick={onClick}>
      <IconRestore size={13} />
    </ActionIcon>
  );
}
