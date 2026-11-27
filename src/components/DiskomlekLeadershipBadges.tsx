import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RotateCcw, Upload, Shield } from 'lucide-react';

interface LeadershipBadgeProps {
  role: 'kadiskomlek' | 'sesdiskomlek';
  compact?: boolean;
}

const LEADERSHIP_DATA = {
  kadiskomlek: {
    title: 'TNI ANGKATAN UDARA',
    fullName: 'SWA BHUWANA PAKSA',
    shortName: 'TNI AU',
    commandRole: 'KADISKOMLEKAU',
    rank: 'TNI AU',
    subTitle: 'Lambang Resmi Swa Bhuwana Paksa - TNI Angkatan Udara',
    primaryPhoto: '/assets/aistudio/1792503945296_954409ac.jpg',
    defaultJpg: '/images/logo_tni_au.jpg',
    defaultSvg: '/images/logo_tni_au.jpg',
    storageKey: 'diskomlek_logo_tni_au_v5',
    scale: 1.08,
    accentColor: '#facc15',
  },
  sesdiskomlek: {
    title: 'KORPS ELEKTRONIKA',
    fullName: 'DISKOMLEKAU',
    shortName: 'Korps Elektro',
    commandRole: 'SESDISKOMLEKAU',
    rank: 'TNI AU',
    subTitle: 'Lambang Resmi Korps Elektronika TNI AU - Diskomlekau',
    primaryPhoto: '/assets/aistudio/1794622160588_bf320b0e-picsay_33aee344.png',
    defaultJpg: '/images/logo_korps_elektro.jpg',
    defaultSvg: '/images/logo_korps_elektro.jpg',
    storageKey: 'diskomlek_logo_korps_elektro_v6',
    scale: 1.09,
    accentColor: '#facc15',
  },
};

export const DiskomlekLeadershipBadge: React.FC<LeadershipBadgeProps> = ({ role, compact = false }) => {
  const data = LEADERSHIP_DATA[role];
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permanently load the official logos directly on all TV platforms & browsers
  const [photoSrc, setPhotoSrc] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(data.storageKey);
      if (saved) return saved;
    }
    return data.primaryPhoto;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadErrorCount, setLoadErrorCount] = useState(0);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(data.storageKey);
      if (saved) {
        setPhotoSrc(saved);
        setLoadErrorCount(0);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [data.storageKey]);

  const handleImageError = () => {
    if (loadErrorCount === 0) {
      setLoadErrorCount(1);
      setPhotoSrc(data.defaultJpg);
    } else if (loadErrorCount === 1) {
      setLoadErrorCount(2);
      setPhotoSrc(data.defaultSvg);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        try {
          localStorage.setItem(data.storageKey, base64);
          setPhotoSrc(base64);
          setLoadErrorCount(0);
        } catch (err) {
          console.warn('Storage quota exceeded, setting in-memory only', err);
          setPhotoSrc(base64);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefault = () => {
    localStorage.removeItem(data.storageKey);
    setPhotoSrc(data.defaultJpg);
    setLoadErrorCount(0);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Main Badge Container */}
      <div
        onClick={() => setIsModalOpen(true)}
        className="leadership-badge-root group"
        title={`${data.title}: ${data.fullName} (Klik untuk perbesar / ganti logo)`}
        style={{
          display: 'flex',
          flexDirection: role === 'sesdiskomlek' ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: compact ? '8px' : '12px',
          padding: compact ? '4px 8px' : '5px 12px',
          height: compact ? '56px' : '84px',
          borderRadius: '14px',
          backgroundColor: 'rgba(6, 20, 48, 0.95)',
          border: '2px solid rgba(250, 204, 21, 0.85)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.7)',
          cursor: 'pointer',
          userSelect: 'none',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Logo Frame - Perfectly Circular & Scaled to Boundary Line (Fit Sampai Batas Garis) */}
        <div
          style={{
            position: 'relative',
            width: compact ? '46px' : '72px',
            height: compact ? '46px' : '72px',
            minWidth: compact ? '46px' : '72px',
            minHeight: compact ? '46px' : '72px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2.5px solid #facc15',
            boxShadow: '0 2px 10px rgba(0,0,0,0.85), inset 0 0 6px rgba(0,0,0,0.5)',
            backgroundColor: role === 'sesdiskomlek' ? '#87CEEB' : '#000000',
            flexShrink: 0,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={photoSrc}
            alt={`Logo ${data.title} ${data.fullName}`}
            onError={handleImageError}
            referrerPolicy="no-referrer"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              transform: `scale(${data.scale || 1.08})`,
              display: 'block',
              filter: 'contrast(1.08) brightness(1.05) saturate(1.08)',
            }}
          />
        </div>

        {/* Text Details - Pure Inline Flex Column & Block Divs for 100% Tizen OS Compatibility */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: role === 'sesdiskomlek' ? 'flex-end' : 'flex-start',
            textAlign: role === 'sesdiskomlek' ? 'right' : 'left',
            gap: '2px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              display: 'block',
              fontSize: compact ? '10px' : '13px',
              fontWeight: 900,
              color: '#facc15',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textShadow: '0 2px 4px rgba(0,0,0,0.95)',
            }}
          >
            {data.title}
          </div>

          <div
            style={{
              display: 'block',
              fontSize: compact ? '11px' : '14px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.02em',
              textShadow: '0 2px 4px rgba(0,0,0,0.95)',
            }}
          >
            {data.fullName}
          </div>

          <div
            style={{
              display: 'block',
              fontSize: compact ? '8.5px' : '10px',
              fontWeight: 800,
              color: '#38bdf8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {data.commandRole}
          </div>
        </div>
      </div>

      {/* Enlarged Portrait & Photo Replacement Modal */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000002,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            cursor: 'pointer',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '400px',
              width: '100%',
              backgroundColor: '#071633',
              borderRadius: '20px',
              border: '2px solid #facc15',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(250, 204, 21, 0.35)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'default',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #38bdf8',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>

            {/* Header Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid #facc15',
                color: '#fef08a',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.08em',
                marginBottom: '14px',
              }}
            >
              <Shield style={{ width: '13px', height: '13px' }} />
              <span>{data.title}</span>
            </div>

            {/* Photo / Logo Card - Perfectly Circular */}
            <div
              style={{
                width: '220px',
                height: '220px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3.5px solid #facc15',
                boxShadow: '0 10px 25px rgba(0,0,0,0.8), 0 0 25px rgba(250, 204, 21, 0.45)',
                backgroundColor: role === 'sesdiskomlek' ? '#87CEEB' : '#000000',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <img
                src={photoSrc}
                alt={data.fullName}
                onError={handleImageError}
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  transform: `scale(${data.scale || 1.08})`,
                  display: 'block',
                }}
              />
            </div>

            {/* Name & Title */}
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.02em' }}>
              {data.fullName}
            </h3>
            <p style={{ fontSize: '12px', color: '#facc15', fontWeight: 800, margin: '4px 0 0' }}>
              TNI Angkatan Udara
            </p>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 18px', maxWidth: '300px' }}>
              {data.subTitle}
            </p>

            {/* Action Buttons: Upload & Reset */}
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#0284c7',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Upload style={{ width: '14px', height: '14px' }} />
                <span>Unggah Foto</span>
              </button>

              <button
                onClick={handleResetToDefault}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Kembali ke foto standar"
              >
                <RotateCcw style={{ width: '14px', height: '14px' }} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
