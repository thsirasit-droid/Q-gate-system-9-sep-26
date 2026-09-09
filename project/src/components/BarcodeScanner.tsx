import { useRef, useState, useEffect } from 'react';
import { ScanLine, X, Camera } from 'lucide-react';

/**
 * Barcode/QR scanner using the browser's BarcodeDetector API.
 * Falls back to camera snapshot + manual entry if BarcodeDetector is unavailable.
 */

type Props = {
  onScan: (result: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        detectLoop();
      } catch {
        setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง หรือพิมพ์รหัสด้วยตนเอง');
        setSupported(false);
      }
    }

    async function detectLoop() {
      if (!videoRef.current || cancelled) return;
      const video = videoRef.current;

      if (video.readyState >= 2) {
        try {
          // @ts-expect-error - BarcodeDetector is not in standard TS lib yet
          const detector = new BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const value = barcodes[0].rawValue as string;
            if (value) {
              cleanup();
              onScan(value);
              return;
            }
          }
        } catch {
          // BarcodeDetector not available — keep video running for manual snapshot
          setSupported(false);
        }
      }
      rafRef.current = requestAnimationFrame(detectLoop);
    }

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function handleSnapshot() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // For now just show the manual input — full OCR is too heavy for this use case
    setError('ถ่ายภาพแล้ว กรุณาพิมพ์รหัสที่เห็นในช่องด้านล่าง');
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-cyan-600" />
            สแกน Barcode / QR Code
          </h3>
          <button
            onClick={() => { cleanup(); onClose(); }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {supported && !error && (
            <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/2 border-2 border-cyan-400 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-6 text-slate-500 text-sm">
              {error}
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {!supported && (
            <button
              onClick={handleSnapshot}
              className="btn-secondary w-full justify-center"
            >
              <Camera className="w-4 h-4" /> ถ่ายภาพ
            </button>
          )}

          {/* Manual input fallback */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualValue.trim()) {
                  cleanup();
                  onScan(manualValue.trim());
                }
              }}
              className="form-input flex-1"
              placeholder="พิมพ์รหัสด้วยตนเอง..."
              autoFocus
            />
            <button
              onClick={() => {
                if (manualValue.trim()) {
                  cleanup();
                  onScan(manualValue.trim());
                }
              }}
              className="btn-primary"
            >
              ยืนยัน
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            วาง Barcode หรือ QR Code ให้อยู่ในกรอบ ระบบจะอ่านค่าอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
}
