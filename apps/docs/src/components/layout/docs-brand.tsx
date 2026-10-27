import Image from 'next/image';

export function DocsBrand() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/favicon/logo-symbol-icon.svg"
        alt="University of Peradeniya crest"
        width={32}
        height={32}
        className="size-8 shrink-0 object-contain"
        priority
      />
      <span className="truncate">SCS Documentation</span>
    </span>
  );
}
