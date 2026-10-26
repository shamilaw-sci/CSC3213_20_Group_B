export default function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-6 py-16 sm:py-24">
      <div className="bg-fd-muted h-4 w-40 rounded" />
      <div className="bg-fd-muted mt-6 h-14 max-w-2xl rounded-xl" />
      <div className="bg-fd-muted mt-5 h-6 max-w-3xl rounded" />
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-fd-border h-48 rounded-2xl border"
          />
        ))}
      </div>
    </main>
  );
}
