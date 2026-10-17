'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type EditorModeValue = 'form' | 'json-view' | 'json-edit';

interface SourceOption<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
}

interface EditorViewControlsProps<SourceValue extends string> {
  sourceValue?: SourceValue;
  sourceOptions?: SourceOption<SourceValue>[];
  onSourceChange?: (value: SourceValue) => void;
  modeValue: EditorModeValue;
  onModeChange: (value: EditorModeValue) => void;
  disableJsonEdit?: boolean;
  className?: string;
}

const modeOptions: SourceOption<EditorModeValue>[] = [
  { value: 'form', label: 'Form' },
  { value: 'json-view', label: 'View JSON' },
  { value: 'json-edit', label: 'Edit JSON' },
];

export function EditorViewControls<SourceValue extends string>({
  sourceValue,
  sourceOptions = [],
  onSourceChange,
  modeValue,
  onModeChange,
  disableJsonEdit = false,
  className,
}: EditorViewControlsProps<SourceValue>) {
  const hasSource = Boolean(sourceValue && sourceOptions.length);

  return (
    <div
      className={cn(
        'grid w-full gap-2',
        hasSource ? 'sm:grid-cols-2' : 'sm:grid-cols-1',
        className
      )}
    >
      {hasSource && sourceValue ? (
        <div className="min-w-0">
          <Label className="mb-1.5 block text-xs">Source</Label>
          <Select
            value={sourceValue}
            onValueChange={(value) => onSourceChange?.(value as SourceValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sourceOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="min-w-0">
        <Label className="mb-1.5 block text-xs">Advanced</Label>
        <Select
          value={modeValue}
          onValueChange={(value) => onModeChange(value as EditorModeValue)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {modeOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.value === 'json-edit' && disableJsonEdit}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
