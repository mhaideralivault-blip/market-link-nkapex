import { useEffect, useRef, useState } from 'react';
import { ordersApi, errorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';

const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

// Farmer side: scan the customer's QR with the camera (where the browser supports it) or type the 6-character code.
export default function PickupScanner({ onClose, onCompleted }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const verify = async (value) => {
    setError('');
    setBusy(true);
    try {
      const { order } = (await ordersApi.verifyPickup(value)).data;
      toast(`Handed over: order #${order._id.slice(-6).toUpperCase()} for ${order.customer?.name || 'customer'}`);
      stopCamera();
      onCompleted(order);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const loop = async () => {
        if (!streamRef.current) return;
        try {
          const [hit] = await detector.detect(video);
          if (hit?.rawValue?.startsWith('MLINK:')) return verify(hit.rawValue);
        } catch {
          /* frame not ready */
        }
        setTimeout(loop, 300);
      };
      loop();
    } catch {
      stopCamera();
      setError('Camera not available. Type the 6-character code instead.');
    }
  };

  return (
    <div className="modal-back" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ps-title">
        <h2 id="ps-title">Scan pickup QR</h2>
        <p className="muted small">Ask the customer to show the QR on their order page, or type the code they read out.</p>
        {canScan && (
          <>
            <video ref={videoRef} className="scan-video" playsInline muted style={{ display: scanning ? 'block' : 'none' }} />
            {!scanning && (
              <button type="button" className="btn btn-outline" onClick={startCamera} disabled={busy}>
                Scan with camera
              </button>
            )}
          </>
        )}
        <form
          className="stack"
          style={{ marginTop: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            verify(code);
          }}
        >
          <label>
            Pickup code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. K7M2QX"
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              style={{ letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase' }}
            />
          </label>
          {error && <p className="alert alert-error">{error}</p>}
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Close
            </button>
            <button className="btn" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 6}>
              {busy ? 'Checking...' : 'Confirm handover'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
