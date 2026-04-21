"use client";


import { useMemo, useState } from "react";

import { format } from "date-fns";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  DatePicker,
  Input,
} from "@/components/ui";

import { cn } from "@/lib/core";

export type SelectOption = {
  value: string;
  label: string;
};

export function combineDateTime(date: Date | undefined, time: string) {
  if (!date || !time) return "";
  return `${format(date, "yyyy-MM-dd")}T${time}`;
}

export function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function isSameCalendarDay(a?: Date, b?: Date) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getMinSelectableTime(date: Date | undefined, today: Date) {
  if (!isSameCalendarDay(date, today)) return undefined;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

type ComboboxFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  required?: boolean;
  showClear?: boolean;
  onChange: (value: string) => void;
};

export function DashboardComboboxField({
  label,
  value,
  options,
  placeholder,
  emptyText,
  disabled,
  required,
  showClear = false,
  onChange,
}: ComboboxFieldProps) {
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      <Combobox<SelectOption>
        items={filteredOptions}
        value={selectedOption}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        onInputValueChange={(inputValue) => setQuery(inputValue)}
        onValueChange={(nextValue) => {
          onChange(nextValue?.value ?? "");
          setQuery("");
        }}
      >
        <ComboboxInput
          disabled={disabled}
          placeholder={placeholder}
          showClear={showClear}
          className="h-11 w-full rounded-md border-slate-300 bg-white shadow-xs [&_[data-slot=input-group-control]]:h-11 [&_[data-slot=input-group-control]]:px-3 [&_[data-slot=input-group-control]]:text-sm"
        />
        <ComboboxContent className="border border-slate-200 bg-white">
          <ComboboxList>
            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
            {filteredOptions.map((option, index) => (
              <ComboboxItem key={option.value} value={option} index={index}>
                {option.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

type DateTimePickerFieldProps = {
  id: string;
  label: string;
  date: Date | undefined;
  time: string;
  disabled?: boolean;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  minTime?: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
};

export function DashboardDateTimePickerField({
  id,
  label,
  date,
  time,
  disabled,
  required = true,
  minDate,
  maxDate,
  minTime,
  onDateChange,
  onTimeChange,
}: DateTimePickerFieldProps) {
  return (
    <div className="w-full space-y-1.5">
      <label
        htmlFor={`${id}-time`}
        className="text-xs font-medium text-slate-600"
      >
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <DatePicker
          value={date}
          onChange={onDateChange}
          disabled={disabled}
          defaultMonth={date}
          clearable={!required}
          calendarDisabled={
            minDate || maxDate
              ? (calendarDate) =>
                  (minDate ? calendarDate < minDate : false) ||
                  (maxDate ? calendarDate > maxDate : false)
              : undefined
          }
          className="w-full sm:flex-1"
          buttonClassName={cn("w-full", !date && "text-slate-400")}
        />
        <Input
          type="time"
          id={`${id}-time`}
          value={time}
          onChange={(event) => onTimeChange(event.target.value)}
          step="60"
          min={minTime}
          placeholder="HH:MM"
          className="h-11 border-slate-300 bg-white px-3 focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200 sm:w-36"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
