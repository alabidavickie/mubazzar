import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/icon";

const controlBase =
  "w-full rounded-lg border-[1.5px] border-line bg-card px-3.5 py-3 font-sans text-body-lg text-ink shadow-[0_1px_2px_rgb(14_41_75/0.04)] outline-none transition placeholder:text-ink-subtle focus:border-navy focus:ring-4 focus:ring-navy/15 aria-[invalid=true]:border-urgent aria-[invalid=true]:ring-urgent/15";

export interface FieldProps {
  label: string;
  icon?: IconName;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}

/** Label + control + hint + inline error, wired with aria-describedby / aria-invalid. */
export function Field({ label, icon, required, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-label-md font-semibold text-navy">
        {icon ? <Icon name={icon} className="text-base" /> : null}
        {label}
        {required ? (
          <span aria-hidden="true" className="text-urgent">
            *
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-body-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-body-sm font-semibold text-urgent">
          <Icon name="error" className="text-sm" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "min-h-20 resize-y", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <Icon
        name="expand_more"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xl text-ink-muted"
      />
    </div>
  );
});
