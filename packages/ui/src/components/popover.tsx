'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from 'cn';
import * as React from 'react';

interface PopoverAnchorContextValue {
  anchor: HTMLDivElement | null;
  setAnchor: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
}

const PopoverAnchorContext =
  React.createContext<PopoverAnchorContextValue | null>(null);

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
  const context = React.useMemo(() => ({ anchor, setAnchor }), [anchor]);

  return (
    <PopoverAnchorContext value={context}>
      <PopoverPrimitive.Root data-slot="popover" {...props} />
    </PopoverAnchorContext>
  );
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  const anchorContext = React.useContext(PopoverAnchorContext);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        anchor={anchorContext?.anchor ?? undefined}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            `bg-popover text-popover-foreground z-50 w-72
            origin-(--transform-origin) rounded-md border p-4 shadow-md
            outline-hidden transition-[opacity,scale] duration-150 ease-out
            data-ending-style:scale-95 data-ending-style:opacity-0
            data-starting-style:scale-95 data-starting-style:opacity-0
            motion-reduce:transition-none`,
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  className,
  ref,
  ...props
}: React.ComponentProps<'div'>) {
  const anchorContext = React.useContext(PopoverAnchorContext);
  const setAnchor = anchorContext?.setAnchor;
  const mergedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      setAnchor?.(element);

      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    },
    [ref, setAnchor]
  );

  return (
    <div
      ref={mergedRef}
      data-slot="popover-anchor"
      className={className}
      {...props}
    />
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-1 text-sm', className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('font-medium', className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
