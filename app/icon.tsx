import { ImageResponse } from 'next/og'

export const size = {
  width: 192,
  height: 192,
}

export const contentType = 'image/png'

function BrandMark({ scale = 1 }: { scale?: number }) {
  const sunSize = 52 * scale
  const rayLength = 16 * scale
  const rayWidth = 5 * scale
  const waveWidth = 78 * scale
  const waveHeight = 10 * scale

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12 * scale,
      }}
    >
      <div
        style={{
          width: 96 * scale,
          height: 88 * scale,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: sunSize,
            height: sunSize,
            borderRadius: 999,
            border: `${6 * scale}px solid #ef9a3d`,
            background: '#fffaf3',
          }}
        />
        {[
          { top: 0, left: 48 * scale - rayWidth / 2, rotate: 0 },
          { top: 14 * scale, left: 12 * scale, rotate: -45 },
          { top: 14 * scale, right: 12 * scale, rotate: 45 },
          { top: 41 * scale, left: 0, rotate: -90 },
          { top: 41 * scale, right: 0, rotate: 90 },
        ].map((ray, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: rayWidth,
              height: rayLength,
              borderRadius: 999,
              background: '#ef9a3d',
              ...(ray.top !== undefined ? { top: ray.top } : {}),
              ...(ray.left !== undefined ? { left: ray.left } : {}),
              ...(ray.right !== undefined ? { right: ray.right } : {}),
              transform: `rotate(${ray.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8 * scale,
          marginTop: -6 * scale,
        }}
      >
        <div
          style={{
            width: waveWidth,
            height: waveHeight,
            borderRadius: 999,
            border: `${4 * scale}px solid #338ea6`,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        />
        <div
          style={{
            width: waveWidth - 10 * scale,
            height: waveHeight,
            borderRadius: 999,
            border: `${4 * scale}px solid #338ea6`,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        />
      </div>
    </div>
  )
}

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
          background: 'linear-gradient(180deg, #fcf8f2 0%, #f3ede4 100%)',
        }}
      >
        <div
          style={{
            width: 154,
            height: 154,
            borderRadius: 42,
            background: '#fffdfa',
            border: '3px solid #dfd2c2',
            boxShadow: '0 12px 32px rgba(60, 47, 34, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BrandMark />
        </div>
      </div>
    ),
    size,
  )
}
