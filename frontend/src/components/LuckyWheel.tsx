import React, { useRef, useState, useEffect } from 'react';
import { LuckyWheel as LuckyWheelCanvas } from '@lucky-canvas/react';
import type { LuckyWheelRef } from '@lucky-canvas/react';
import type { Prize } from '../types';
import { checkEligibility, sendSpinResult } from '../services/api';
import PrizePopup from './PrizePopup';
import Toast from './Toast';
import '../styles/LuckyWheel.css';
import spinSound from '../assets/audio/spin-tick.mp3';
import winningSound from '../assets/audio/winning_notification.MP3';

const COUPON_LENGTH = 6;
const PHONE_REGEX = /^0\d{9}$/;
const ENABLE_DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true';

const maskPhone = (value: string) => (value.length <= 4 ? value : `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`);
const debugLog = (...args: unknown[]) => {
  if (ENABLE_DEBUG) {
    console.log('[LuckyWheel]', ...args);
  }
};

const generateCouponCode = (length = COUPON_LENGTH): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const CAMPAIGN_ID = import.meta.env.VITE_CAMPAIGN_ID || 'lucky-wheel-2025-10-14';

// Helper function to convert prizes with weights to 10 segments
// Prizes with <10% weight get 1 slot, others get proportional slots
const convertPrizesToSegments = (prizesWithWeights: any[]): Prize[] => {
  const segments: Prize[] = [];
  const totalWeight = prizesWithWeights.reduce((sum, p) => sum + p.weight, 0);

  // Calculate how many segments each prize should get (out of 10)
  prizesWithWeights.forEach((prize) => {
    const percentage = (prize.weight / totalWeight) * 100;
    const numSegments = percentage < 10 ? 1 : Math.round(percentage / 10);

    // Add segments for this prize
    for (let i = 0; i < numSegments; i++) {
      segments.push(prize);
    }
  });

  // If we have less than 10 segments, fill with the most common prize
  while (segments.length < 10) {
    const mostCommonPrize = prizesWithWeights.reduce((prev, current) =>
      (prev.weight > current.weight) ? prev : current
    );
    segments.push(mostCommonPrize);
  }

  // If we have more than 10, trim to 10
  return segments.slice(0, 10);
};

const LuckyWheel: React.FC = () => {
  const wheelRef = useRef<LuckyWheelRef | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const winningAudioRef = useRef<HTMLAudioElement | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<number>(0);
  const [prizeCode, setPrizeCode] = useState<string>('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [hasSpun, setHasSpun] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success' | 'info'>('error');
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(true);
  const [wheelSize, setWheelSize] = useState(340);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateWheelSize = () => {
      const viewportWidth = window.innerWidth;
      const maxSize = 340;
      const minSize = 240;
      const horizontalPadding = viewportWidth <= 480 ? 56 : 120;
      const calculatedSize = Math.min(maxSize, Math.max(minSize, viewportWidth - horizontalPadding));
      setWheelSize(calculatedSize);
    };

    updateWheelSize();
    window.addEventListener('resize', updateWheelSize);
    return () => window.removeEventListener('resize', updateWheelSize);
  }, []);

  // Initialize audio
  useEffect(() => {
    spinAudioRef.current = new Audio(spinSound);
    spinAudioRef.current.loop = true;
    spinAudioRef.current.volume = 0.5;

    winningAudioRef.current = new Audio(winningSound);
    winningAudioRef.current.loop = false;
    winningAudioRef.current.volume = 0.7;

    return () => {
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current = null;
      }
      if (winningAudioRef.current) {
        winningAudioRef.current.pause();
        winningAudioRef.current = null;
      }
    };
  }, []);

  // Fetch prizes from backend on mount
  useEffect(() => {
    const fetchPrizes = async () => {
      try {
        // Use relative URL in production (same-origin), localhost in dev
        const backendUrl = import.meta.env.VITE_BACKEND_URL ||
                          (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');
        const apiUrl = `${backendUrl}/api/prizes/${CAMPAIGN_ID}`;
        console.log('[FRONTEND] Fetching prizes from:', apiUrl);
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          // Map Supabase prize_configs to Prize format with weights
          const prizesWithWeights = data.data.map((p: any) => ({
            background: p.background_color || '#FFFFFF',
            fonts: [{
              text: `Giảm ${p.prize_label}`,
              fontSize: p.font_size || '14px',
              fontColor: p.font_color || '#8B0000',
              fontWeight: 'bold',
              top: '16%',
              lineHeight: '18px'
            }],
            value: p.prize_value,
            weight: p.weight
          }));

          // Convert to 10 segments based on probability
          const segments = convertPrizesToSegments(prizesWithWeights);

          // Apply alternating red/white colors to segments
          const coloredSegments = segments.map((seg, index) => ({
            ...seg,
            background: index % 2 === 0 ? '#FFFFFF' : '#C41E3A',
            fonts: seg.fonts?.length
              ? [{
                ...seg.fonts[0],
                fontColor: index % 2 === 0 ? '#8B0000' : '#FFFFFF',
              }]
              : seg.fonts,
          }));

          console.log('[FRONTEND] Prize segments created:', coloredSegments.length, 'segments');
          setPrizes(coloredSegments);
        } else {
          // Fallback to default prizes if API fails
          setPrizes([
            { background: '#FFFFFF', fonts: [{ text: 'Giảm 20.000đ', fontSize: '14px', fontColor: '#8B0000', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 20000 },
            { background: '#C41E3A', fonts: [{ text: 'Giảm 30.000đ', fontSize: '14px', fontColor: '#FFFFFF', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 30000 },
            { background: '#FFFFFF', fonts: [{ text: 'Giảm 50.000đ', fontSize: '14px', fontColor: '#8B0000', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 50000 },
            { background: '#C41E3A', fonts: [{ text: 'Giảm 100.000đ', fontSize: '14px', fontColor: '#FFFFFF', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 100000 },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch prizes:', error);
        // Fallback prizes
        setPrizes([
          { background: '#FFFFFF', fonts: [{ text: 'Giảm 20.000đ', fontSize: '14px', fontColor: '#8B0000', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 20000 },
          { background: '#C41E3A', fonts: [{ text: 'Giảm 30.000đ', fontSize: '14px', fontColor: '#FFFFFF', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 30000 },
          { background: '#FFFFFF', fonts: [{ text: 'Giảm 50.000đ', fontSize: '14px', fontColor: '#8B0000', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 50000 },
          { background: '#C41E3A', fonts: [{ text: 'Giảm 100.000đ', fontSize: '14px', fontColor: '#FFFFFF', fontWeight: 'bold', top: '16%', lineHeight: '18px' }], value: 100000 },
        ]);
      } finally {
        setIsLoadingPrizes(false);
      }
    };

    fetchPrizes();
  }, []);

  // Cấu hình nút quay - Smaller gold button
  const buttons = [
    { radius: '35%', background: '#FFD700', pointer: false },
    { radius: '30%', background: '#FFA500', pointer: false },
    {
      radius: '25%',
      background: '#FFD700',
      pointer: true,
      fonts: [{ text: 'QUAY', fontSize: '16px', fontColor: '#8B0000', fontWeight: 'bold' }],
    },
  ];

  const validatePhone = (value: string): boolean => PHONE_REGEX.test(value);

  const handleStart = async () => {
    console.log('🎯 [FRONTEND] handleStart called!');
    const trimmedName = customerName.trim();
    const sanitizedPhone = phone.replace(/[^\d]/g, '');

    console.log('[FRONTEND] Input:', { name: trimmedName, phone: sanitizedPhone, isSpinning, hasSpun });

    if (isSpinning) {
      console.log('[FRONTEND] Already spinning, returning');
      return;
    }

    if (!trimmedName) {
      setNameError('Vui lòng nhập tên khách hàng');
    } else {
      setNameError('');
    }

    if (!sanitizedPhone) {
      setPhoneError('Vui lòng nhập số điện thoại');
    } else if (!validatePhone(sanitizedPhone)) {
      setPhoneError('Số điện thoại phải bắt đầu bằng 0 và gồm 10 chữ số');
    } else {
      setPhoneError('');
    }

    if (!trimmedName || !validatePhone(sanitizedPhone) || hasSpun) {
      if (hasSpun) {
        console.log('[FRONTEND] User already spun');
        setToastType('error');
        setToastMessage('Bạn đã quay rồi! Vui lòng kiểm tra Zalo để nhận mã giảm giá.');
      }
      console.log('[FRONTEND] Validation failed, blocking spin:', { hasSpun, nameValid: !!trimmedName, phoneValid: validatePhone(sanitizedPhone) });
      return;
    }

    console.log('[FRONTEND] Validation passed, checking eligibility...');
    try {
      const eligibility = await checkEligibility(sanitizedPhone, CAMPAIGN_ID);
      console.log('[FRONTEND] Eligibility result:', eligibility);
      if (!eligibility.eligible) {
        setHasSpun(true);
        setToastType('error');
        setToastMessage(eligibility.message || 'Số điện thoại đã quay rồi! Vui lòng kiểm tra Zalo.');
        console.log('[FRONTEND] Not eligible, stopping');
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kiểm tra điều kiện. Vui lòng thử lại sau.';
      console.error('[FRONTEND] Eligibility check error:', error);
      setToastType('error');
      setToastMessage(message);
      return;
    }

    debugLog('Spin initiated', { name: trimmedName, phone: maskPhone(sanitizedPhone) });
    setShowPopup(false);
    setPrizeCode('');
    setCurrentPrize(0);
    setIsSpinning(true);
    setHasSpun(true);

    // Play music
    if (winningAudioRef.current) {
      winningAudioRef.current.pause();
      winningAudioRef.current.currentTime = 0;
    }

    if (spinAudioRef.current) {
      spinAudioRef.current.currentTime = 0;
      spinAudioRef.current.play().catch(err => console.log('Audio play failed:', err));
    }

    // Bắt đầu quay
    wheelRef.current?.play();

    const generatedCode = generateCouponCode();
    const randomIndex = Math.floor(Math.random() * prizes.length);
    const fallbackPrizeValue = prizes[randomIndex].value;
    const spinStart = Date.now();

    try {
      console.log('📤 [FRONTEND] Sending spin request to backend...', {
        name: trimmedName,
        phone: maskPhone(sanitizedPhone),
        prize: fallbackPrizeValue,
      });

      const response = await sendSpinResult({
        campaign_id: CAMPAIGN_ID,
        phone: sanitizedPhone,
        name: trimmedName,
        code: generatedCode,
        prize: fallbackPrizeValue,
        timestamp: Date.now(),
        user_agent: navigator.userAgent,
      });

      const serverPrizeValue = response.prize ?? fallbackPrizeValue;
      const matchedIndex = prizes.findIndex((item) => item.value === serverPrizeValue);
      const finalIndex = matchedIndex !== -1 ? matchedIndex : randomIndex;
      const minSpinDuration = 2500;
      const elapsed = Date.now() - spinStart;
      const remaining = Math.max(0, minSpinDuration - elapsed);

      setTimeout(() => {
        wheelRef.current?.stop(finalIndex);

        // Stop music when wheel stops
        if (spinAudioRef.current) {
          spinAudioRef.current.pause();
          spinAudioRef.current.currentTime = 0;
        }

        setTimeout(() => {
          if (winningAudioRef.current) {
            winningAudioRef.current.currentTime = 0;
            winningAudioRef.current.play().catch(err => console.log('Winning audio play failed:', err));
          }
          setIsSpinning(false);
          setCurrentPrize(serverPrizeValue);
          setPrizeCode(response.code || generatedCode);
          setShowPopup(true);
        }, 2000);
      }, remaining);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại sau.';
      console.error('Error sending spin result:', error);
      debugLog('Spin webhook failed', message);

      wheelRef.current?.stop(randomIndex);

      // Stop music on error
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current.currentTime = 0;
      }

      setIsSpinning(false);
      setShowPopup(false);

      const duplicateAttempt = message.toLowerCase().includes('đã quay');
      setHasSpun(duplicateAttempt);

      // Show toast instead of inline error
      setToastType('error');
      setToastMessage(message);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '');
    setPhone(digitsOnly.slice(0, 10));
    setPhoneError('');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerName(e.target.value);
    setNameError('');
  };

  return (
    <div className="lucky-wheel-container">
      <div className="wheel-header">
        <h1>🎉 VÒNG QUAY MAY MẮN 🎉</h1>
        <p className="subtitle">Nhập thông tin để nhận mã giảm giá!</p>
      </div>

      <div className="form-section">
        <div className="input-group">
          <input
            type="text"
            className={`text-input ${nameError ? 'error' : ''}`}
            placeholder="Nhập tên khách hàng"
            value={customerName}
            onChange={handleNameChange}
            disabled={isSpinning || hasSpun}
            maxLength={50}
          />
          {nameError && <p className="error-message">{nameError}</p>}
        </div>
        <div className="input-group">
          <input
            type="tel"
            className={`text-input ${phoneError ? 'error' : ''}`}
            placeholder="Nhập số điện thoại (VD: 0912345678)"
            value={phone}
            onChange={handlePhoneChange}
            disabled={isSpinning || hasSpun}
          />
          {phoneError && <p className="error-message">{phoneError}</p>}
        </div>
      </div>

      <div className="wheel-wrapper">
        {isLoadingPrizes ? (
          <div
            className="wheel-loading"
            style={{ width: `${wheelSize}px`, height: `${wheelSize}px` }}
          >
            <p>Đang tải vòng quay...</p>
          </div>
        ) : (
          <LuckyWheelCanvas
            ref={wheelRef}
            width={`${wheelSize}px`}
            height={`${wheelSize}px`}
            prizes={prizes}
            buttons={buttons}
            onStart={handleStart}
          />
        )}
      </div>

      <div className="info-section">
        <h3>🎁 Giải thưởng</h3>
        <ul className="prize-list">
          <li>💰 Giảm 20.000đ</li>
          <li>💰 Giảm 30.000đ</li>
          <li>💰 Giảm 50.000đ</li>
          <li>💰 Giảm 100.000đ</li>
        </ul>

        <div className="rules">
          <h3>📋 Điều kiện tham gia</h3>
          <ul>
            <li>Mỗi số điện thoại chỉ được quay 1 lần</li>
            <li>Mã giảm giá sẽ được gửi qua Zalo</li>
            <li>Mã có thời hạn sử dụng 7 ngày</li>
            <li>Không áp dụng cùng các chương trình khác</li>
          </ul>
        </div>
      </div>

      {showPopup && (
        <PrizePopup
          prize={currentPrize}
          code={prizeCode}
          phone={phone}
          name={customerName.trim()}
          onClose={() => {
            if (winningAudioRef.current) {
              winningAudioRef.current.pause();
              winningAudioRef.current.currentTime = 0;
            }
            setShowPopup(false);
          }}
        />
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};

export default LuckyWheel;
