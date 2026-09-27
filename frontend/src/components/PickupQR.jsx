import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { IconDownload } from './Icons';

// Customer side: the QR encodes the pickup code so the farmer can scan it at the stall.
export default function PickupQR({ code }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`MLINK:${code}`, { width: 480, margin: 1, color: { dark: '#12301f', light: '#ffffff' } })
      .then((url) => !cancelled && setImage(url))
      .catch(() => !cancelled && setImage(''));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const downloadImage = () => {
    const a = document.createElement('a');
    a.href = image;
    a.download = `marketlink-pickup-${code}.png`;
    a.click();
  };

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: [320, 420] });
    doc.setFillColor('#f7f2e8');
    doc.rect(0, 0, 320, 420, 'F');
    doc.setTextColor('#12301f');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MarketLink pickup code', 160, 40, { align: 'center' });
    doc.addImage(image, 'PNG', 40, 60, 240, 240);
    doc.setFontSize(22);
    doc.text(`${code.slice(0, 3)} ${code.slice(3)}`, 160, 330, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#566052');
    doc.text('Show this at the stall for the farmer to scan.', 160, 355, { align: 'center' });
    doc.save(`marketlink-pickup-${code}.pdf`);
  };

  return (
    <div className="card pickup-qr">
      <h2>Show this at the stall</h2>
      <p className="muted small">Your order is ready for pickup. This code appears here automatically once the farmer marks it ready — the farmer scans it (or you read out the code) to hand over your produce.</p>
      {image ? <img src={image} alt={`Pickup QR code ${code}`} width="220" height="220" /> : <div className="skeleton" style={{ width: 220, height: 220, borderRadius: 16 }} />}
      <div className="pickup-code" aria-label={`Pickup code ${code.split('').join(' ')}`}>
        {code.slice(0, 3)} {code.slice(3)}
      </div>
      {image && (
        <div className="row-gap pickup-qr-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadImage}>
            <IconDownload width={16} height={16} /> Download image
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadPdf}>
            <IconDownload width={16} height={16} /> Download PDF
          </button>
        </div>
      )}
    </div>
  );
}
