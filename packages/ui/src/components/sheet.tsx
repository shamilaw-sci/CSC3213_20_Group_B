'use client';

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { XIcon } from 'lucide-react';

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        `bg-overlay fixed inset-0 z-50 transition-opacity duration-150
        data-ending-style:opacity-0 data-starting-style:opacity-0`,
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          `bg-background fixed z-50 flex flex-col gap-4 shadow-lg
          transition-transform ease-in-out data-closed:duration-300
          data-open:duration-500`,
          side === 'right' &&
            `inset-y-0 right-0 h-full w-3/4 border-l
            data-ending-style:translate-x-full
            data-starting-style:translate-x-full sm:max-w-sm`,
          side === 'left' &&
            `inset-y-0 left-0 h-full w-3/4 border-r
            data-ending-style:-translate-x-full
            data-starting-style:-translate-x-full sm:max-w-sm`,
          side === 'top' &&
            `inset-x-0 top-0 h-auto border-b data-ending-style:-translate-y-full
            data-starting-style:-translate-y-full`,
          side === 'bottom' &&
            `inset-x-0 bottom-0 h-auto border-t
            data-ending-style:translate-y-full
            data-starting-style:translate-y-full`,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            className="hover:bg-accent hover:text-accent-foreground
              focus-visible:border-ring focus-visible:ring-ring/50
              text-muted-foreground absolute top-2 right-2 inline-flex size-11
              items-center justify-center rounded-md transition-colors
              focus-visible:ring-[3px] focus-visible:outline-none
              disabled:pointer-events-none disabled:opacity-50"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
