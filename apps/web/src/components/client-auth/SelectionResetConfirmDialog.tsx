import { Button } from '@/components/ui/button';

interface SelectionResetConfirmDialogProps {
  titleId: string;
  descriptionId: string;
  title: string;
  /** Number of currently selected assets, echoed in the consequence sentence. */
  selectionCount: number;
  /** What the reset does, as the sentence after "You have selected N account(s). " */
  consequence: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Surface-specific container classes (padding/width differ per call site). */
  className?: string;
}

/**
 * The one reset-confirmation alertdialog (review #34): switching business and
 * post-save change-selection were maintained as copies that differed only in
 * four strings. Destructive, so it stays a plain alertdialog — role, labelled
 * title, described body — with no animation to distract from the choice.
 */
export function SelectionResetConfirmDialog({
  titleId,
  descriptionId,
  title,
  selectionCount,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
  className = 'w-full space-y-3 border-2 border-black bg-card p-4 dark:border-white',
}: SelectionResetConfirmDialogProps) {
  return (
    <div role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId} className={className}>
      <h3 id={titleId} className="text-lg font-bold text-[var(--ink)] font-display">
        {title}
      </h3>
      <p id={descriptionId} className="text-sm text-muted-foreground">
        You have selected {selectionCount} {selectionCount === 1 ? 'account' : 'accounts'}.{' '}
        {consequence}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
