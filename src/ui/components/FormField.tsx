import { ReactNode, useId } from 'react';
import clsx from 'clsx';

type FormFieldProps = {
  label: ReactNode;
  children: (id: string) => ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  labelClassName?: string;
  hintClassName?: string;
};

export function FormField({
  label,
  children,
  required,
  hint,
  className,
  labelClassName,
  hintClassName,
}: FormFieldProps) {
  const controlId = useId();
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={controlId} className={clsx('text-sm font-medium text-gray-700', labelClassName)}>
        {label}
        {required ? <span className="ml-1 text-red-500" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only">（必須）</span> : null}
      </label>
      {children(controlId)}
      {hint ? (
        <span className={clsx('text-xs text-gray-500', hintClassName)}>{hint}</span>
      ) : null}
    </div>
  );
}
