import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 512,
  height: 512,
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
          backgroundColor: '#005fa8',
          borderRadius: '50%',
          fontFamily: 'sans-serif',
          fontWeight: 700,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 86 }}>
          <span style={{ color: '#ffffff', letterSpacing: '-2px' }}>Aqua</span>
          <span style={{ color: '#78c9ea', letterSpacing: '-2px' }}>Con</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
