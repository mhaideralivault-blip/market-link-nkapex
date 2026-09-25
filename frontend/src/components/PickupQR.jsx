import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Customer side: the QR encodes the pickup code so the farmer can scan it at the stall.
export default function PickupQR({ code }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`MLINK:${code}`, { width: 240, margin: 1, color: { dark: '#12301f', light: '#ffffff' } })
      .then((url) => !cancelled && setImage(url))
      .catch(() => !cancelled && setImage(''));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="card pickup-qr">
      <h2>Show this at the stall</h2>
      <p className="muted small">Your order is ready. The farmer scans this QR (or you read out the code) to hand over your produce.</p>
      {image ? <img src={image} alt={`Pickup QR code ${code}`} width="220" height="220" /> : <div className="skeleton" style={{ width: 220, height: 220, borderRadius: 16 }} />}
      <div className="pickup-code" aria-label={`Pickup code ${code.split('').join(' ')}`}>
        {code.slice(0, 3)} {code.slice(3)}
      </div>
    </div>
  );
}
