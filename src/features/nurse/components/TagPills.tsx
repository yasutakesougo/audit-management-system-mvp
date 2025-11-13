import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import React from 'react';

export type TagPillsProps = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  'data-testid'?: string;
};

const TagPills: React.FC<TagPillsProps> = ({ options, value, onChange, 'data-testid': tid }) => {
  const toggle = (tag: string) => {
    const has = value.includes(tag);
    onChange(has ? value.filter((entry) => entry !== tag) : [...value, tag]);
  };

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" data-testid={tid ?? 'tag-pills'}>
      {options.map((tag) => {
        const active = value.includes(tag);
        return (
          <Chip
            key={tag}
            label={tag}
            clickable
            color={active ? 'primary' : 'default'}
            variant={active ? 'filled' : 'outlined'}
            onClick={() => toggle(tag)}
            data-testid={`tag-pill:${tag}`}
          />
        );
      })}
    </Stack>
  );
};

export default TagPills;
