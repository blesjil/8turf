'use client';

import { useState, type ReactNode, type RefObject } from 'react';

export function ConfirmButton({
  formRef,
  message,
  confirmLabel = 'Confirm',
  tone = 'default',
  triggerClassName,
  disabled,
  children,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  triggerClassName: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type='button'
        disabled={disabled}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
          onClick={() => setOpen(false)}
        >
          <div
            className='w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg'
            onClick={(e) => e.stopPropagation()}
          >
            <p className='text-sm mb-6'>{message}</p>
            <div className='flex justify-end gap-3'>
              <button
                type='button'
                className='text-sm text-foreground/60 hover:text-foreground cursor-pointer'
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type='button'
                className={
                  tone === 'danger'
                    ? 'text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 cursor-pointer'
                    : 'text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 cursor-pointer'
                }
                onClick={() => {
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
