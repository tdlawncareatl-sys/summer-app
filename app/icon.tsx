import { ImageResponse } from 'next/og'

export const size = {
  width: 192,
  height: 192,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f4ee',
        }}
      >
        <div
          style={{
            width: 156,
            height: 156,
            borderRadius: 42,
            background: '#fffdfa',
            border: '3px solid #d7ccb9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 10px 30px rgba(60, 47, 34, 0.08)',
          }}
        >
          <div style={{ position: 'absolute', top: 34, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                border: '7px solid #f0a347',
                borderBottom: 'none',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', left: -20, top: 10, width: 12, height: 4, borderRadius: 999, background: '#f0a347', transform: 'rotate(-35deg)' }} />
              <div style={{ position: 'absolute', right: -20, top: 10, width: 12, height: 4, borderRadius: 999, background: '#f0a347', transform: 'rotate(35deg)' }} />
              <div style={{ position: 'absolute', top: -16, left: 16, width: 4, height: 12, borderRadius: 999, background: '#f0a347' }} />
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <div style={{ width: 36, height: 6, borderRadius: 999, background: '#2f8ba1' }} />
              <div style={{ width: 36, height: 6, borderRadius: 999, background: '#2f8ba1' }} />
            </div>
            <div
              style={{
                marginTop: 18,
                color: '#6b7444',
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-0.06em',
                fontFamily: 'sans-serif',
              }}
            >
              SP
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
