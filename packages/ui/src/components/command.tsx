'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#components/dialog';

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        `bg-popover text-popover-foreground flex size-full flex-col
        overflow-hidden rounded-md`,
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn('top-[12dvh] overflow-hidden p-0', className)}
        centered={false}
        showCloseButton={false}
      >
        <Command
          className="**:[[cmdk-group-heading]]:text-muted-foreground
            **:data-[slot=command-input-wrapper]:pr-12
            [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0
            [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-item]_svg]:size-5
            **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium
            **:[[cmdk-group]]:px-2 **:[[cmdk-input]]:h-12 **:[[cmdk-item]]:px-2
            **:[[cmdk-item]]:py-3"
        >
          {children}
        </Command>
        {showCloseButton ? (
          <DialogClose
            type="button"
            aria-label="Close search"
            aria-keyshortcuts="Escape"
            className="text-muted-foreground bg-muted/60 hover:bg-muted
              hover:text-foreground focus-visible:border-ring
              focus-visible:ring-ring/50 absolute top-3 right-3 inline-flex h-6
              min-w-8 items-center justify-center rounded-sm border px-1.5
              font-mono text-[10px] font-medium tracking-wide transition-colors
              focus-visible:ring-2 focus-visible:outline-none!"
          >
            Esc
          </DialogClose>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="group focus-within:border-ring/60 focus-within:bg-muted/40 flex
        h-12 items-center gap-2 border-b px-3 transition-colors"
    >
      <SearchIcon
        className="size-4 shrink-0 opacity-50 transition-opacity
          group-focus-within:opacity-100"
      />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          `placeholder:text-muted-foreground flex size-full bg-transparent
          text-sm outline-hidden focus-visible:outline-none!
          disabled:cursor-not-allowed disabled:opacity-50`,
          className
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        `text-foreground **:[[cmdk-group-heading]]:text-muted-foreground
        overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2
        **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs
        **:[[cmdk-group-heading]]:font-medium`,
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('bg-border -mx-1 h-px', className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        `data-[selected=true]:bg-accent
        data-[selected=true]:text-accent-foreground
        [&_svg:not([class*='text-'])]:text-muted-foreground relative flex
        cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm
        outline-hidden select-none data-[disabled=true]:pointer-events-none
        data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none
        [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        className
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        'text-muted-foreground ml-auto text-xs tracking-widest',
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
