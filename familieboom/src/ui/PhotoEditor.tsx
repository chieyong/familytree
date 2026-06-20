import { useEffect, useRef, useState } from 'react';
import { useT } from './useT';

interface Props {
  /** Startbron: een gekozen bestand. Leeg + startCamera → live camera. */
  initialFile?: File;
  startCamera?: boolean;
  onCancel: () => void;
  onSave: (file: File) => void;
}

const BOX = 260; // kader in px (vierkant; ronde maskering eroverheen)
const OUTPUT = 512; // uitvoerresolutie van de bijgesneden vierkante foto

/**
 * Foto-editor: maak een foto met de camera of kies een bestand, sleep om te
 * positioneren en zoom, en sla een vierkante uitsnede op. Eén ronde uitsnede
 * = wat in de boom en de kaart verschijnt.
 */
export function PhotoEditor({ initialFile, startCamera, onCancel, onSave }: Props) {
  const t = useT();
  const [img, setImg] = useState<HTMLImageElement>();
  const [base, setBase] = useState(1); // cover-schaal bij zoom = 1
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [cameraError, setCameraError] = useState<string>();
  const [cameraOn, setCameraOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const loadImage = (src: string) => {
    const image = new Image();
    image.onload = () => {
      const b = Math.max(BOX / image.naturalWidth, BOX / image.naturalHeight);
      setImg(image);
      setBase(b);
      setZoom(1);
      // Gecentreerd starten.
      setOffset({ x: (BOX - image.naturalWidth * b) / 2, y: (BOX - image.naturalHeight * b) / 2 });
    };
    image.src = src;
  };

  // Bron bepalen: bestand of camera.
  useEffect(() => {
    if (initialFile) {
      loadImage(URL.createObjectURL(initialFile));
    } else if (startCamera) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          setCameraOn(true); // pas hierna verschijnt <video>; koppelen gebeurt in het effect hieronder
        })
        .catch(() => setCameraError(t.photo.cameraError));
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stream pas aan het <video> koppelen wanneer het element gemount is
  // (cameraOn → true). In de getUserMedia-callback bestaat de ref nog niet.
  useEffect(() => {
    const video = videoRef.current;
    if (cameraOn && video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play();
    }
  }, [cameraOn]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d')?.drawImage(video, 0, 0);
    stopCamera();
    loadImage(c.toDataURL('image/jpeg', 0.92));
  };

  // Slepen om te positioneren (muis + touch via pointer events).
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !img) return;
    const dispW = img.naturalWidth * base * zoom;
    const dispH = img.naturalHeight * base * zoom;
    const nx = clamp(e.clientX - drag.current.x, BOX - dispW, 0);
    const ny = clamp(e.clientY - drag.current.y, BOX - dispH, 0);
    setOffset({ x: nx, y: ny });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onZoom = (next: number) => {
    if (!img) return;
    const s0 = base * zoom;
    const s1 = base * next;
    // Houd het midden van het kader stabiel tijdens zoomen.
    const sx = (BOX / 2 - offset.x) / s0;
    const sy = (BOX / 2 - offset.y) / s0;
    const dispW = img.naturalWidth * s1;
    const dispH = img.naturalHeight * s1;
    setZoom(next);
    setOffset({
      x: clamp(BOX / 2 - sx * s1, BOX - dispW, 0),
      y: clamp(BOX / 2 - sy * s1, BOX - dispH, 0),
    });
  };

  const save = () => {
    if (!img) return;
    const s = base * zoom;
    const c = document.createElement('canvas');
    c.width = OUTPUT;
    c.height = OUTPUT;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // Het zichtbare kader (0..BOX) terugrekenen naar bronpixels.
    const sx = -offset.x / s;
    const sy = -offset.y / s;
    const sSize = BOX / s;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    c.toBlob(
      (blob) => {
        if (blob) onSave(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <div className="auth-overlay" onClick={onCancel}>
      <div className="info-card photo-editor" onClick={(e) => e.stopPropagation()}>
        <div className="info-head">
          <h2>{t.photo.title}</h2>
          <button className="panel-close" onClick={onCancel} aria-label={t.photo.cancel}>×</button>
        </div>

        {cameraError && <p className="import-error-msg">{cameraError}</p>}

        {!img && cameraOn && (
          <div className="photo-camera">
            <video ref={videoRef} playsInline muted className="photo-video" />
            <button className="share-link-btn" onClick={capture}>{t.photo.take}</button>
          </div>
        )}

        {img && (
          <>
            <div
              className="photo-crop"
              style={{ width: BOX, height: BOX }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                className="photo-crop-img"
                src={img.src}
                alt=""
                draggable={false}
                style={{
                  width: img.naturalWidth * base * zoom,
                  height: img.naturalHeight * base * zoom,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
              <div className="photo-crop-mask" />
            </div>
            <label className="photo-zoom">
              {t.photo.zoom}
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoom(Number(e.target.value))}
              />
            </label>
            <p className="photo-hint">{t.photo.hint}</p>
            <div className="import-actions">
              <button onClick={save}>{t.photo.save}</button>
              <button className="add-rel-cancel" onClick={onCancel}>{t.photo.cancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
