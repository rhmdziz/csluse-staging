"use client";

import { useId, type ComponentProps } from "react";

import { Input } from "@/components/ui";

import { BATCH_OPTIONS } from "@/constants/batches";

type BatchInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  options?: string[];
};

export default function BatchInput({
  value,
  onChange,
  options = BATCH_OPTIONS,
  ...props
}: BatchInputProps) {
  const listId = useId();

  return (
    <>
      <Input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={listId}
        inputMode="numeric"
        maxLength={4}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
