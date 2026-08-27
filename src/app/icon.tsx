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
          backgroundColor: '#2563eb', // blue-600
          borderRadius: '50%',
          color: 'white',
          fontSize: 96,
          fontWeight: 'bold',
          flexDirection: 'column',
          lineHeight: 1.1,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span>Aqua</span>
          <span>Con</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
