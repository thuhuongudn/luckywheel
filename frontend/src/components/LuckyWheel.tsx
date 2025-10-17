import React, { useRef, useState, useEffect, useCallback } from 'react';
import { LuckyWheel as LuckyWheelCanvas } from '@lucky-canvas/react';
import type { LuckyWheelRef } from '@lucky-canvas/react';
import type { Prize, PrizeFont } from '../types';
import { checkEligibility, sendSpinResult } from '../services/api';
import PrizePopup from './PrizePopup';
import Toast from './Toast';
import '../styles/LuckyWheel.css';
import spinSound from '../assets/audio/spin-tick.mp3';
import winningSound from '../assets/audio/winning_notification.MP3';

const COUPON_LENGTH = 6;
const PHONE_REGEX = /^0\d{9}$/;
const CAMPAIGN_ID = import.meta.env.VITE_CAMPAIGN_ID || 'lucky-wheel-2025-10-14';

const MIN_WHEEL_SIZE = 220;
const MAX_WHEEL_SIZE = 340;
const VIEWPORT_RATIO = 0.7;
const RESULT_POPUP_DELAY = 500;

type WeightedPrize = {
  value: number;
  weight: number;
  formattedLabel: string;
};

interface PrizeDataFromAPI {
  prize_value: number;
  weight: number;
  prize_label: string | null;
}

const generateCouponCode = (length = COUPON_LENGTH): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const formatAmountFromLabel = (prizeLabel: string | null | undefined, fallbackValue: number): string => {
  const fallback = new Intl.NumberFormat('vi-VN').format(fallbackValue);
  if (!prizeLabel) {
    return fallback;
  }

  const sanitized = prizeLabel
    .replace(/Giảm\s+/i, '')
    .replace(/đ/gi, '')
    .replace(/,/g, '.')
    .trim();

  const digits = sanitized.replace(/[^0-9]/g, '');
  if (!digits) {
    return fallback;
  }

  const numericValue = Number.parseInt(digits, 10);
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return new Intl.NumberFormat('vi-VN').format(numericValue);
};

const formatPrizeLabel = (prizeLabel: string | null | undefined, fallbackValue: number): string => {
  const amount = formatAmountFromLabel(prizeLabel, fallbackValue);
  return `Giảm ${amount} đ`;
};

const createRadialFonts = (label: string, fontColor: string): PrizeFont[] => {
  const trimmed = label.trim();
  const match = trimmed.match(/^Giảm\s+(.*)$/i);
  const amountText = match && match[1] ? match[1] : trimmed;

  return [
    {
      text: 'Giảm',
      top: '18%',
      fontSize: '14px',
      fontColor,
      fontWeight: '800',
      lineHeight: '16px',
      fontFamily: 'Space Grotesk, sans-serif',
    },
    {
      text: amountText,
      top: '45%',
      fontSize: '17px',
      fontColor,
      fontWeight: '800',
      lineHeight: '19px',
      fontFamily: 'DM Sans, monospace',
    },
  ];
};

const convertPrizesToSegments = (prizesWithWeights: WeightedPrize[]): WeightedPrize[] => {
  if (!prizesWithWeights.length) {
    return [];
  }

  const segments: WeightedPrize[] = [];
  const totalWeight = prizesWithWeights.reduce((sum, p) => sum + p.weight, 0);

  prizesWithWeights.forEach((prize) => {
    const percentage = totalWeight === 0 ? 0 : (prize.weight / totalWeight) * 100;
    const desiredSegments = percentage < 10 ? 1 : Math.round(percentage / 10);
    const slotCount = Math.max(1, desiredSegments);
    for (let i = 0; i < slotCount; i += 1) {
      segments.push(prize);
    }
  });

  while (segments.length < 10) {
    const mostCommonPrize = prizesWithWeights.reduce((prev, current) => (
      prev.weight > current.weight ? prev : current
    ));
    segments.push(mostCommonPrize);
  }

  return segments.slice(0, 10);
};

const createWheelPrizes = (segments: WeightedPrize[]): Prize[] =>
  segments.map((seg, index) => {
    const isLight = index % 2 === 0;
    const background = isLight ? '#FFFFFF' : '#00E5A8'; // White or Cyber Blue
    const fontColor = '#111111'; // Always black for high contrast
    return {
      background,
      fonts: createRadialFonts(seg.formattedLabel, fontColor),
      value: seg.value,
    };
  });

const DEFAULT_WEIGHTED_PRIZES: WeightedPrize[] = [
  { value: 20000, weight: 40, formattedLabel: 'Giảm 20.000 đ' },
  { value: 30000, weight: 30, formattedLabel: 'Giảm 30.000 đ' },
  { value: 50000, weight: 20, formattedLabel: 'Giảm 50.000 đ' },
  { value: 100000, weight: 10, formattedLabel: 'Giảm 100.000 đ' },
];

const DEFAULT_SUMMARIES = DEFAULT_WEIGHTED_PRIZES.map((item) => item.formattedLabel);
const DEFAULT_WHEEL_PRIZES = createWheelPrizes(convertPrizesToSegments(DEFAULT_WEIGHTED_PRIZES));

const LuckyWheel: React.FC = () => {
  const wheelRef = useRef<LuckyWheelRef | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const winningAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingResultRef = useRef<{ prizeValue: number; prizeCode: string; expiresAt: string | null } | null>(null);
  const hasPrimedWinningAudioRef = useRef(false);
  const revealTimeoutRef = useRef<number | null>(null);
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
  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_WHEEL_PRIZES);
  const [prizeSummaries, setPrizeSummaries] = useState<string[]>(DEFAULT_SUMMARIES);
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(true);
  const [wheelSize, setWheelSize] = useState(MAX_WHEEL_SIZE);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const applyPrizes = useCallback((weightedPrizes: WeightedPrize[]) => {
    const normalized = weightedPrizes.length ? weightedPrizes : DEFAULT_WEIGHTED_PRIZES;
    const segments = convertPrizesToSegments(normalized);
    setPrizes(createWheelPrizes(segments));
    const uniqueLabels = Array.from(new Set(normalized.map((item) => item.formattedLabel)));
    setPrizeSummaries(uniqueLabels);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const computeWheelSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportCap = Math.min(MAX_WHEEL_SIZE, Math.round(viewportWidth * VIEWPORT_RATIO));
      const element = wrapperRef.current;

      if (element) {
        const styles = window.getComputedStyle(element);
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const availableWidth = Math.max(0, element.clientWidth - paddingLeft - paddingRight);
        const constrainedByElement = Math.min(viewportCap, Math.floor(availableWidth));
        const nextSize = Math.max(MIN_WHEEL_SIZE, Math.min(MAX_WHEEL_SIZE, constrainedByElement));
        setWheelSize((prev) => (Math.abs(prev - nextSize) > 0.5 ? nextSize : prev));
        return;
      }

      setWheelSize((prev) => (Math.abs(prev - viewportCap) > 0.5 ? viewportCap : prev));
    };

    computeWheelSize();

    const resizeHandler = () => computeWheelSize();
    window.addEventListener('resize', resizeHandler);

    let observer: ResizeObserver | null = null;
    if (wrapperRef.current && 'ResizeObserver' in window) {
      observer = new ResizeObserver(() => computeWheelSize());
      observer.observe(wrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  // Initialize audio
  useEffect(() => {
    spinAudioRef.current = new Audio(spinSound);
    spinAudioRef.current.loop = true;
    spinAudioRef.current.volume = 0.5;
    spinAudioRef.current.preload = 'auto';

    winningAudioRef.current = new Audio(winningSound);
    winningAudioRef.current.loop = false;
    winningAudioRef.current.volume = 0.7;
    winningAudioRef.current.preload = 'auto';

    return () => {
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current = null;
      }
      if (winningAudioRef.current) {
        winningAudioRef.current.pause();
        winningAudioRef.current = null;
      }
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, []);

  const handleWheelEnd = (_prize: unknown, _index: number) => {
    if (spinAudioRef.current) {
      spinAudioRef.current.pause();
      spinAudioRef.current.currentTime = 0;
    }

    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }

    const pendingResult = pendingResultRef.current;

    if (!pendingResult) {
      setIsSpinning(false);
      setExpiresAt(null);
      return;
    }

    pendingResultRef.current = null;

    revealTimeoutRef.current = window.setTimeout(() => {
      if (winningAudioRef.current) {
        winningAudioRef.current.pause();
        winningAudioRef.current.currentTime = 0;
        winningAudioRef.current.play().catch(() => {});
      }

      setIsSpinning(false);
      setCurrentPrize(pendingResult.prizeValue);
      setPrizeCode(pendingResult.prizeCode);
      setExpiresAt(pendingResult.expiresAt);
      setShowPopup(true);
      revealTimeoutRef.current = null;
    }, RESULT_POPUP_DELAY);
  };

  // Fetch prizes from backend on mount
  useEffect(() => {
    const fetchPrizes = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL ||
          (import.meta.env.MODE === 'production' ? '' : 'http://localhost:3000');
        const apiUrl = `${backendUrl}/api/prizes/${CAMPAIGN_ID}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const normalized: WeightedPrize[] = data.data
            .map((p: PrizeDataFromAPI) => ({
              value: Number(p.prize_value),
              weight: Math.max(1, Number(p.weight) || 1),
              formattedLabel: formatPrizeLabel(p.prize_label, Number(p.prize_value)),
            }))
            .filter((item: WeightedPrize) => Number.isFinite(item.value) && item.value > 0);

          applyPrizes(normalized);
        } else {
          applyPrizes([]);
        }
      } catch (error) {

        applyPrizes([]);
      } finally {
        setIsLoadingPrizes(false);
      }
    };

    fetchPrizes();
  }, [applyPrizes]);

  // Cấu hình nút quay - Neubrutalism style
  const buttons = [
    { radius: '35%', background: '#FFD93D', pointer: false }, // Sun Yellow
    { radius: '30%', background: '#111111', pointer: false }, // Black border
    {
      radius: '25%',
      background: '#FFD93D', // Sun Yellow
      pointer: true,
      fonts: [{ text: 'QUAY', fontSize: '18px', fontColor: '#111111', fontWeight: '800', fontFamily: 'FZ Poppins, Poppins, sans-serif' }],
    },
  ];

  const validatePhone = (value: string): boolean => PHONE_REGEX.test(value);

  const handleStart = async () => {

    const trimmedName = customerName.trim();
    const sanitizedPhone = phone.replace(/[^\d]/g, '');

    if (isSpinning) {

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

        setToastType('error');
        setToastMessage('Bạn đã quay rồi! Vui lòng kiểm tra Zalo để nhận mã giảm giá.');
      }

      return;
    }

    try {
      const eligibility = await checkEligibility(sanitizedPhone, CAMPAIGN_ID);

      if (!eligibility.eligible) {
        setHasSpun(true);
        setToastType('error');
        setToastMessage(eligibility.message || 'Số điện thoại đã quay rồi! Vui lòng kiểm tra Zalo.');

        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kiểm tra điều kiện. Vui lòng thử lại sau.';

      setToastType('error');
      setToastMessage(message);
      return;
    }

    setShowPopup(false);
    setPrizeCode('');
    setCurrentPrize(0);
    setIsSpinning(true);
    setHasSpun(true);
    pendingResultRef.current = null;
    setExpiresAt(null);

    // Play music
    if (winningAudioRef.current) {
      winningAudioRef.current.pause();
      winningAudioRef.current.currentTime = 0;
    }

    if (spinAudioRef.current) {
      spinAudioRef.current.currentTime = 0;
      spinAudioRef.current.play().catch(() => {});
    }

    if (winningAudioRef.current && !hasPrimedWinningAudioRef.current) {
      const audio = winningAudioRef.current;
      const originalVolume = audio.volume;
      audio.volume = 0;
      audio.play()
        .then(() => {
          hasPrimedWinningAudioRef.current = true;
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume;
        })
        .catch(() => {
          audio.volume = originalVolume;
        });
    }

    // Bắt đầu quay
    wheelRef.current?.play();

    const generatedCode = generateCouponCode();
    const randomIndex = Math.floor(Math.random() * prizes.length);
    const fallbackPrizeValue = prizes[randomIndex].value;
    const spinStart = Date.now();
    const expiresAtIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const response = await sendSpinResult({
        campaign_id: CAMPAIGN_ID,
        phone: sanitizedPhone,
        name: trimmedName,
        code: generatedCode,
        prize: fallbackPrizeValue,
        timestamp: Date.now(),
        user_agent: navigator.userAgent,
        expires_at: expiresAtIso,
      });

      const serverPrizeValue = response.prize ?? fallbackPrizeValue;
      const matchedIndex = prizes.findIndex((item) => item.value === serverPrizeValue);
      const finalIndex = matchedIndex !== -1 ? matchedIndex : randomIndex;
      const minSpinDuration = 2500;
      const elapsed = Date.now() - spinStart;
      const remaining = Math.max(0, minSpinDuration - elapsed);

      const resolvedExpiresAt = response.expires_at ?? expiresAtIso;
      setExpiresAt(resolvedExpiresAt);

      pendingResultRef.current = {
        prizeValue: serverPrizeValue,
        prizeCode: response.code || generatedCode,
        expiresAt: resolvedExpiresAt,
      };

      setTimeout(() => {
        wheelRef.current?.stop(finalIndex);
      }, remaining);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại sau.';

      wheelRef.current?.stop(randomIndex);
      pendingResultRef.current = null;
      setExpiresAt(null);

      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }

      // Stop music on error
      // Let the audio fade naturally when wheel stops via handleWheelEnd

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
        <h1>ƯU ĐÃI CUỐI NĂM<br/>QUAY LÀ TRÚNG</h1>
        <p className="subtitle">Nhà Thuốc Việt Nhật</p>
      </div>

      <div className="cta-banner">
        <p>🎁 QUAY NGAY – NHẬN MÃ LIỀN TAY</p>
      </div>

      <h3 className="product-badges-title">nhóm sản phẩm áp dụng</h3>
      <div className="product-badges">
        <span className="product-badge">Mason Natural</span>
        <span className="product-badge">Olympian Labs</span>
        <span className="product-badge">Careline</span>
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
            placeholder="Nhập sdt có Zalo để nhận mã (VD: 0912345678)"
            value={phone}
            onChange={handlePhoneChange}
            disabled={isSpinning || hasSpun}
          />
          {phoneError && <p className="error-message">{phoneError}</p>}
        </div>
      </div>

      <div className="wheel-wrapper" ref={wrapperRef}>
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
            onEnd={handleWheelEnd}
            width={`${wheelSize}px`}
            height={`${wheelSize}px`}
            prizes={prizes}
            buttons={buttons}
            onStart={handleStart}
          />
        )}
      </div>

      <div className="info-section">
        <h3>💰 Giải thưởng hấp dẫn</h3>
        <ul className="prize-list">
          {prizeSummaries.map((label) => (
            <li key={label}>🎁 {label}</li>
          ))}
        </ul>
        <p style={{ textAlign: 'center', fontSize: '16px', color: '#007AFF', fontWeight: '600', margin: '10px 0 0 0' }}>
          100 giải • Tổng giá trị 5.000.000đ
        </p>

        <div className="rules">
          <h3>📋 Nhóm sản phẩm áp dụng</h3>
          <ul>
            <li>Mason Natural - Vitamin và thực phẩm chức năng Mỹ</li>
            <li>Olympian Labs - No.1 trong nhóm hỗ trợ điều trị của Mỹ</li>
            <li>Careline - Chăm sóc sức khoẻ và sắc đẹp từ Úc</li>
          </ul>
        </div>

        <div className="footer-note">
          (*) Áp dụng cho <strong>100 suất quay</strong>, tổng giá trị giải thưởng <strong>5.000.000đ</strong><br/>
          Thời gian áp dụng đến hết <strong>31/12/2025</strong><br/>
          Mã giảm giá được gửi qua Zalo sau khi quay thành công
        </div>
      </div>

      {showPopup && (
        <PrizePopup
          prize={currentPrize}
          code={prizeCode}
          phone={phone}
          name={customerName.trim()}
          expiresAt={expiresAt || undefined}
          onClose={() => {
            if (winningAudioRef.current) {
              winningAudioRef.current.pause();
              winningAudioRef.current.currentTime = 0;
            }
            setShowPopup(false);
            setExpiresAt(null);
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
