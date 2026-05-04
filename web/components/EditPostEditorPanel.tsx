'use client';

import type { ChangeEvent, LegacyRef, RefObject } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, Loader2, Save, X } from 'lucide-react';

function mediaSrc(url: string) {
  return url;
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url) || url.toLowerCase().includes('video');
}

export type EditPostEditorPanelProps = {
  title: string;
  subtitle?: string;
  editPostDraft: string;
  onDraftChange: (value: string) => void;
  editPostMediaUrls: string[];
  onMediaUrlsChange: (urls: string[]) => void;
  editPostSaving: boolean;
  editPostUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Extra chrome for full-page route (e.g. back affordance is outside this panel). */
  variant: 'page' | 'embedded';
};

export function EditPostEditorPanel({
  title,
  subtitle,
  editPostDraft,
  onDraftChange,
  editPostMediaUrls,
  onMediaUrlsChange,
  editPostSaving,
  editPostUploading,
  fileInputRef,
  onFilesSelected,
  onSave,
  onCancel,
  variant,
}: EditPostEditorPanelProps) {
  const moveMedia = (index: number, delta: -1 | 1) => {
    onMediaUrlsChange(
      (() => {
        const prev = editPostMediaUrls;
        const j = index + delta;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        const t = next[index]!;
        next[index] = next[j]!;
        next[j] = t;
        return next;
      })(),
    );
  };

  const removeAt = (index: number) => {
    onMediaUrlsChange(editPostMediaUrls.filter((_, i) => i !== index));
  };

  const headerPad = variant === 'page' ? 'px-4 py-4' : 'px-4 py-3.5';

  return (
    <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-[26px] border border-slate-200/90 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5">
      <div className={`flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white ${headerPad}`}>
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
          {subtitle ? <p className="text-xs font-semibold text-slate-500">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-label="Close editor"
          onClick={onCancel}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <label htmlFor="edit-post-textarea" className="sr-only">
          Post text
        </label>
        <textarea
          id="edit-post-textarea"
          value={editPostDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={variant === 'page' ? 8 : 6}
          placeholder="What is on your heart?"
          className="w-full resize-none rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 text-[15px] font-semibold leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />

        {editPostMediaUrls.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
              Drag order: use arrows on each tile
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {editPostMediaUrls.map((url, index) => {
                const video = isVideoUrl(url);
                return (
                  <div
                    key={`${url}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80"
                  >
                    {video ? (
                      <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={mediaSrc(url)} alt="" className="h-full w-full object-cover" />
                    )}
                    {editPostMediaUrls.length > 1 ? (
                      <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-1">
                        <button
                          type="button"
                          aria-label={`Move media ${index + 1} up`}
                          disabled={index === 0 || editPostUploading || editPostSaving}
                          onClick={() => moveMedia(index, -1)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-slate-950/75 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-800 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move media ${index + 1} down`}
                          disabled={index === editPostMediaUrls.length - 1 || editPostUploading || editPostSaving}
                          onClick={() => moveMedia(index, 1)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-slate-950/75 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-800 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Remove media"
                      onClick={() => removeAt(index)}
                      disabled={editPostUploading || editPostSaving}
                      className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-slate-950/75 text-white shadow-md backdrop-blur-sm transition hover:bg-rose-600 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <input
          ref={fileInputRef as LegacyRef<HTMLInputElement>}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => void onFilesSelected(e)}
        />
        <button
          type="button"
          disabled={editPostUploading || editPostSaving}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-slate-300 bg-slate-50 py-3.5 text-sm font-black text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/60 disabled:opacity-50"
        >
          {editPostUploading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : <ImageIcon className="h-5 w-5 text-blue-600" />}
          {editPostUploading ? 'Uploading…' : 'Add photos or videos'}
        </button>
      </div>

      <div className="flex gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={editPostSaving || editPostUploading}
          className="flex-1 rounded-[16px] border border-slate-200 bg-white py-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={
            editPostSaving || editPostUploading || (!editPostDraft.trim() && editPostMediaUrls.length === 0)
          }
          className="flex flex-[1.15] items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-black text-white shadow-md transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
        >
          {editPostSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
