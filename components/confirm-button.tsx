'use client';

import { type ReactNode, type RefObject } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function ConfirmButton({
  formRef,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'default',
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  triggerClassName,
  disabled,
  children,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  triggerSize?: 'default' | 'xs' | 'sm' | 'lg';
  triggerClassName?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type='button'
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
            disabled={disabled}
          />
        }
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
