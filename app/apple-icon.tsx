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
          background: 'linear-gradient(180deg, #fcf8f2 0%, #f3ede4 100%)',
        }}
      >
        <div
          style={{
            width: 146,
            height: 146,
            borderRadius: 38,
            background: '#fffdfa',
            border: '3px solid #dfd2c2',
            boxShadow: '0 12px 32px rgba(60, 47, 34, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: '5px solid #ef9a3d',
                background: '#fffaf3',
              }}
            />
            {[
              { top: 0, left: 34 },
              { top: 12, left: 8, rotate: -45 },
              { top: 12, right: 8, rotate: 45 },
              { top: 32, left: 0, rotate: -90 },
              { top: 32, right: 0, rotate: 90 },
            ].map((ray, index) => (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 12,
                  borderRadius: 999,
                  background: '#ef9a3d',
                  ...(ray.top !== undefined ? { top: ray.top } : {}),
                  ...(ray.left !== undefined ? { left: ray.left } : {}),
                  ...(ray.right !== undefined ? { right: ray.right } : {}),
                  transform: `rotate(${ray.rotate ?? 0}deg)`,
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              marginTop: -4,
            }}
          >
            <div
              style={{
                width: 62,
                height: 8,
                borderRadius: 999,
                border: '3px solid #338ea6',
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: 'transparent',
              }}
            />
            <div
              style={{
                width: 54,
                height: 8,
                borderRadius: 999,
                border: '3px solid #338ea6',
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: 'transparent',
              }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  )
}
