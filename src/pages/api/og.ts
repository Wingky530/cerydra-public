import { ImageResponse } from '@vercel/og';
import { CERYDRA_BOLD_B64, CERYDRA_THIN_B64 } from '../../lib/fonts-base64';

export const config = { runtime: 'edge' };

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const fontBold = b64ToBuffer(CERYDRA_BOLD_B64);
const fontThin = b64ToBuffer(CERYDRA_THIN_B64);

const FONT = 'Cerydra';

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const title = url.searchParams.get('title') || 'Cerydra';
  const episode = url.searchParams.get('episode') || '';
  const cover = url.searchParams.get('cover') || '';
  const synopsis = url.searchParams.get('synopsis') || '';
  const score = url.searchParams.get('score') || '';
  const genres = url.searchParams.get('genres') || '';
  const type = url.searchParams.get('type') || 'anime';

  const truncatedSynopsis = synopsis.length > 250 ? synopsis.slice(0, 250) + '…' : synopsis;
  const titlePrefix = type === 'watch' ? 'watch/' : 'anime/';
  const titleFontSize = title.length > 50 ? 30 : 38;
  const genreList = genres ? genres.split(',').filter(Boolean).slice(0, 3) : [];

  const children = [
    cover ? {
      type: 'div' as const,
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 40,
          height: '100%',
          flexShrink: 0,
        },
        children: [{
          type: 'img' as const,
          props: {
            src: cover,
            style: {
              width: 200,
              height: 280,
              objectFit: 'cover',
              borderRadius: 8,
            }
          }
        }]
      }
    } : null,
    {
      type: 'div' as const,
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          paddingRight: 40,
          paddingLeft: cover ? 40 : 40,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 12,
        },
        children: [
          {
            type: 'div' as const,
            props: {
              style: { fontSize: 20, fontWeight: 700, color: '#36BAE6', letterSpacing: 4, textTransform: 'uppercase', fontFamily: FONT },
              children: 'CERYDRA'
            }
          },
          {
            type: 'div' as const,
            props: {
              style: {
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: 0,
              },
              children: [
                {
                  type: 'span' as const,
                  props: {
                    style: { fontSize: titleFontSize, fontWeight: 300, color: '#9B9B9B', fontFamily: FONT },
                    children: titlePrefix
                  }
                },
                {
                  type: 'span' as const,
                  props: {
                    style: { fontSize: titleFontSize, fontWeight: 700, color: '#252422', fontFamily: FONT },
                    children: title
                  }
                }
              ]
            }
          },
          episode ? {
            type: 'div' as const,
            props: {
              style: { fontSize: 22, fontWeight: 600, color: '#36BAE6', fontFamily: FONT },
              children: `Episode ${episode}`
            }
          } : null,
          synopsis ? {
            type: 'div' as const,
            props: {
              style: {
                fontSize: 18,
                color: '#6B6B6B',
                fontWeight: 300,
                lineHeight: 1.5,
                marginTop: 4,
                fontFamily: FONT,
              },
              children: truncatedSynopsis
            }
          } : null,
          score || genreList.length > 0 ? {
            type: 'div' as const,
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 22,
                fontWeight: 700,
                color: '#252422',
                marginTop: 4,
                fontFamily: FONT,
              },
              children: [
                score ? {
                  type: 'div' as const,
                  props: {
                    style: { display: 'flex', alignItems: 'center', gap: 6 },
                    children: [
                      {
                        type: 'svg' as const,
                        props: {
                          width: 22,
                          height: 22,
                          viewBox: '0 0 16 16',
                          children: [{
                            type: 'path' as const,
                            props: {
                              d: 'M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z',
                              fill: '#F5C518',
                            }
                          }]
                        }
                      },
                      {
                        type: 'span' as const,
                        props: {
                          style: { fontWeight: 700, color: '#252422', fontFamily: FONT },
                          children: `${score}`
                        }
                      }
                    ]
                  }
                } : null,
                ...genreList.map(g => ({
                  type: 'div' as const,
                  props: {
                    style: {
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#6B6B6B',
                      background: 'rgba(0,0,0,0.06)',
                      paddingLeft: 12,
                      paddingRight: 12,
                      paddingTop: 6,
                      paddingBottom: 6,
                      borderRadius: 4,
                      fontFamily: FONT,
                    },
                    children: g.trim()
                  }
                }))
              ].filter(Boolean)
            }
          } : null,
        ].filter(Boolean)
      }
    },
    {
      type: 'div' as const,
      props: {
        style: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 24,
          background: '#36BAE9',
        }
      }
    }
  ].filter(Boolean);

  return new ImageResponse(
    {
      type: 'div',
      key: null,
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#EBEBDF',
          position: 'relative',
          overflow: 'hidden',
        },
        children,
      }
    } as any,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: FONT, data: fontBold, weight: 700, style: 'normal' },
        { name: FONT, data: fontThin, weight: 300, style: 'normal' },
      ],
    }
  );
}
