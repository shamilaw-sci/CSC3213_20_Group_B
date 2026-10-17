import { ImageResponse } from 'next/og';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ initials: string }> }
) {
  const { initials } = await params;
  const text = initials.toUpperCase().slice(0, 2);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#98989D',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span
        style={{
          color: '#ffffff',
          fontSize: 230,
          fontWeight: 300,
          letterSpacing: -4,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </div>,
    {
      width: 600,
      height: 600,
    }
  );
}
