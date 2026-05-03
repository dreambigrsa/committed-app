'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Nudity or sexual content',
  'Copyright violation',
  'False information',
  'Other',
] as const;

type Props = {
  open: boolean;
  reportedName: string;
  onClose: () => void;
  onSubmit: (reason: string, description: string) => Promise<void>;
};

export default function ReportUserModal({ open, reportedName, onClose, onSubmit }: Props) {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedReason('');
      setDescription('');
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Choose a reason for this report.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(selectedReason, description.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-user-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
            <h2 id="report-user-title" className="text-lg font-black text-slate-950">
              Report {reportedName}
            </h2>
          </div>
          <button type="button" onClick={() => !submitting && onClose()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">Reports are reviewed by moderators. Misuse may affect your account.</p>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-black uppercase text-slate-500">Reason</p>
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={submitting}
                onClick={() => setSelectedReason(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  selectedReason === r ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } disabled:opacity-50`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase text-slate-500">Details (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={3}
            className="mt-1 w-full resize-none rounded-[16px] border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            placeholder="Add context that helps reviewers…"
          />
        </label>

        {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 rounded-[16px] border border-slate-200 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !selectedReason}
            onClick={() => void handleSubmit()}
            className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-red-600 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}
