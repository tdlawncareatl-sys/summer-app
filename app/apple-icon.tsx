import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
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
            width: 148,
            height: 148,
            borderRadius: 38,
            background: '#fffdfa',
            border: '3px solid #d7ccb9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7444',
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: '-0.08em',
            fontFamily: 'sans-serif',
            boxShadow: '0 10px 30px rgba(60, 47, 34, 0.08)',
          }}
        >
          SP
        </div>
      </div>
    ),
    size,
  )
}
