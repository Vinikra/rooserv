import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isBusy?: boolean;
  tone?: 'danger' | 'warning';
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  isBusy = false,
  tone = 'warning',
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const isDanger = tone === 'danger';
  const accentClasses = isDanger
    ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-800';
  const confirmClasses = isDanger
    ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
    : 'bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClasses}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="confirmation-dialog-title" className="text-lg font-black text-slate-900">
                {title}
              </h2>
              <p id="confirmation-dialog-description" className="mt-1 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Fechar confirmação"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            data-dialog-initial-focus
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`rounded-xl px-4 py-3 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-60 ${confirmClasses}`}
          >
            {isBusy ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
