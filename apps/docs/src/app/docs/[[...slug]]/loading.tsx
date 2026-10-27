export default function DocumentationLoading() {
  return (
    <>
      <main
        className="grid justify-items-center [grid-area:main]"
        data-layout-main=""
      >
        <article
          id="nd-page"
          data-layout-content=""
          className="flex w-full max-w-[900px] min-w-0 animate-pulse flex-col
            gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14"
        >
          <div className="bg-fd-muted h-4 w-32 rounded" />
          <div className="bg-fd-muted mt-2 h-10 w-3/4 rounded" />
          <div className="bg-fd-muted h-5 w-full rounded" />
          <div className="bg-fd-muted mt-8 h-64 w-full rounded-xl" />
        </article>
      </main>
      <div
        id="nd-toc-placeholder"
        className="xl:layout:[--fd-toc-width:268px] hidden"
      />
    </>
  );
}
