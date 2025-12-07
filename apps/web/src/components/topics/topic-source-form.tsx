'use client';

import { useState } from 'react';
import { X, Check, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface SourceFormData {
  id?: number;
  name: string;
  url: string;
  description?: string;
}

interface TopicSourceFormProps {
  source?: SourceFormData;
  onSave: (data: SourceFormData) => void;
  onCancel: () => void;
  isNew?: boolean;
}

export function TopicSourceForm({ source, onSave, onCancel, isNew = false }: TopicSourceFormProps) {
  const [name, setName] = useState(source?.name || '');
  const [url, setUrl] = useState(source?.url || '');
  const [description, setDescription] = useState(source?.description || '');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  const validate = () => {
    const newErrors: { name?: string; url?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      try {
        new URL(url);
      } catch {
        newErrors.url = 'Must be a valid URL';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave({
        id: source?.id,
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
      });
    }
  };

  return (
    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Input
            placeholder="Source name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>
        <div>
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={errors.url ? 'border-destructive' : ''}
          />
          {errors.url && <p className="text-xs text-destructive mt-1">{errors.url}</p>}
        </div>
      </div>
      <Input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave}>
          <Check className="h-4 w-4 mr-1" />
          {isNew ? 'Add' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

interface SourceItemProps {
  source: SourceFormData;
  onEdit: () => void;
  onDelete: () => void;
}

export function SourceItem({ source, onEdit, onDelete }: SourceItemProps) {
  return (
    <div className="flex items-start gap-2 p-2 border rounded-md bg-muted/20 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{source.name}</span>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {source.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {source.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
          {source.url}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
