'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Frequency = 'daily' | 'weekly' | 'monthly';

interface SchedulePickerProps {
  value: string;
  onChange: (cron: string) => void;
  disabled?: boolean;
}

const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

function parseCron(cron: string): {
  frequency: Frequency;
  hour: string;
  minute: string;
  weekdays: string[];
  day: string;
} {
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    return { frequency: 'daily', hour: '09', minute: '00', weekdays: ['1'], day: '1' };
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  let frequency: Frequency = 'daily';
  let weekdays: string[] = ['1'];
  let day = '1';

  if (dayOfMonth !== '*') {
    frequency = 'monthly';
    day = dayOfMonth;
  } else if (dayOfWeek !== '*') {
    frequency = 'weekly';
    weekdays = dayOfWeek.split(',');
  }

  return {
    frequency,
    hour: hour.padStart(2, '0'),
    minute: minute.padStart(2, '0'),
    weekdays,
    day,
  };
}

function toCron(
  frequency: Frequency,
  hour: string,
  minute: string,
  weekdays: string[],
  day: string
): string {
  const min = parseInt(minute, 10).toString();
  const hr = parseInt(hour, 10).toString();

  switch (frequency) {
    case 'daily':
      return `${min} ${hr} * * *`;
    case 'weekly':
      return `${min} ${hr} * * ${weekdays.join(',')}`;
    case 'monthly':
      return `${min} ${hr} ${day} * *`;
  }
}

export function SchedulePicker({ value, onChange, disabled }: SchedulePickerProps) {
  const parsed = React.useMemo(() => parseCron(value), [value]);
  const [frequency, setFrequency] = React.useState<Frequency>(parsed.frequency);
  const [hour, setHour] = React.useState(parsed.hour);
  const [minute, setMinute] = React.useState(parsed.minute);
  const [weekdays, setWeekdays] = React.useState<string[]>(parsed.weekdays);
  const [day, setDay] = React.useState(parsed.day);

  const updateCron = React.useCallback(
    (
      newFrequency: Frequency,
      newHour: string,
      newMinute: string,
      newWeekdays: string[],
      newDay: string
    ) => {
      const cron = toCron(newFrequency, newHour, newMinute, newWeekdays, newDay);
      onChange(cron);
    },
    [onChange]
  );

  const handleFrequencyChange = (newFrequency: Frequency) => {
    setFrequency(newFrequency);
    updateCron(newFrequency, hour, minute, weekdays, day);
  };

  const handleHourChange = (newHour: string) => {
    setHour(newHour);
    updateCron(frequency, newHour, minute, weekdays, day);
  };

  const handleMinuteChange = (newMinute: string) => {
    setMinute(newMinute);
    updateCron(frequency, hour, newMinute, weekdays, day);
  };

  const handleWeekdayToggle = (weekday: string) => {
    const newWeekdays = weekdays.includes(weekday)
      ? weekdays.filter((w) => w !== weekday)
      : [...weekdays, weekday].sort();
    if (newWeekdays.length === 0) return;
    setWeekdays(newWeekdays);
    updateCron(frequency, hour, minute, newWeekdays, day);
  };

  const handleDayChange = (newDay: string) => {
    setDay(newDay);
    updateCron(frequency, hour, minute, weekdays, newDay);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Frequency</Label>
        <Select value={frequency} onValueChange={handleFrequencyChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Time</Label>
        <div className="flex items-center gap-2">
          <Select value={hour} onValueChange={handleHourChange} disabled={disabled}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={minute} onValueChange={handleMinuteChange} disabled={disabled}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {frequency === 'weekly' && (
        <div className="space-y-2">
          <Label>Days of Week</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((wd) => (
              <button
                key={wd.value}
                type="button"
                disabled={disabled}
                onClick={() => handleWeekdayToggle(wd.value)}
                className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                  weekdays.includes(wd.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-input'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {wd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {frequency === 'monthly' && (
        <div className="space-y-2">
          <Label>Day of Month</Label>
          <Select value={day} onValueChange={handleDayChange} disabled={disabled}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Cron: <code className="bg-muted px-1 rounded">{value}</code>
      </p>
    </div>
  );
}
