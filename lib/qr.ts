import 'server-only';
import QRCode from 'qrcode';

/** SVG QR code (crisp at any size, small payload). Margin 2 modules, error correction M. */
export async function qrSvg(value: string): Promise<string> {
  return QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** PNG data URL, for PDFs and offline caching. */
export async function qrPngDataUrl(value: string, width = 600): Promise<string> {
  return QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 2, width });
}

export async function qrPngBuffer(value: string, width = 1200): Promise<Buffer> {
  return QRCode.toBuffer(value, { errorCorrectionLevel: 'M', margin: 2, width });
}
