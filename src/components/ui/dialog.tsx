'use client';
import * as React from 'react';
import * as Primitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/ui';
export const Dialog=Primitive.Root;
export const DialogTrigger=Primitive.Trigger;
export const DialogClose=Primitive.Close;
export const DialogTitle=Primitive.Title;
export const DialogDescription=Primitive.Description;
export const DialogContent=React.forwardRef<React.ComponentRef<typeof Primitive.Content>,React.ComponentPropsWithoutRef<typeof Primitive.Content>>(function DialogContent({className,children,...props},ref) {
  return <Primitive.Portal><Primitive.Overlay data-ui="dialog-overlay" /><Primitive.Content {...props} ref={ref} data-ui="dialog-content" className={cn('tw:rounded-ah-lg tw:border tw:border-solid tw:border-hairline tw:p-ah-16 tw:shadow-ah-card',className)}>{children}</Primitive.Content></Primitive.Portal>;
});
