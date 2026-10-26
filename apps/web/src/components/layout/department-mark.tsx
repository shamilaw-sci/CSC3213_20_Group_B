export function DepartmentMark() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="border-primary text-primary flex size-10 shrink-0
          items-center justify-center rounded-full border text-xs font-bold
          tracking-[0.12em]"
      >
        SCS
      </span>
      <span className="min-w-0 leading-none">
        <span
          className="text-muted-foreground block text-[0.65rem] font-medium
            tracking-[0.12em] uppercase"
        >
          Department of
        </span>
        <span
          className="block truncate font-serif text-sm font-semibold
            sm:text-base"
        >
          Statistics &amp; Computer Science
        </span>
        <span
          className="text-muted-foreground mt-1 hidden text-[0.65rem]
            tracking-[0.12em] uppercase sm:block"
        >
          University of Peradeniya
        </span>
      </span>
    </span>
  );
}
