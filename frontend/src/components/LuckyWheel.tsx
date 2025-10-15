import React, { useRef, useState } from 'react';
import { LuckyWheel as LuckyWheelCanvas } from '@lucky-canvas/react';
import type { LuckyWheelRef } from '@lucky-canvas/react';
import type { Prize } from '../types';
import { checkEligibility, sendSpinResult } from '../services/api';
import PrizePopup from './PrizePopup';
import '../styles/LuckyWheel.css';

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

const LuckyWheel: React.FC = () => {
  const wheelRef = useRef<LuckyWheelRef | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<number>(0);
  const [prizeCode, setPrizeCode] = useState<string>('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [hasSpun, setHasSpun] = useState(false);

  // Cấu hình giải thưởng
  const prizes: Prize[] = [
    { background: '#ffb8b8', fonts: [{ text: '20.000đ', fontSize: '18px' }], value: 20000 },
    { background: '#ffd88d', fonts: [{ text: '30.000đ', fontSize: '18px' }], value: 30000 },
    { background: '#b8e6b8', fonts: [{ text: '50.000đ', fontSize: '18px' }], value: 50000 },
    { background: '#ffc6ff', fonts: [{ text: '100.000đ', fontSize: '18px' }], value: 100000 },
    { background: '#a8d8ff', fonts: [{ text: '20.000đ', fontSize: '18px' }], value: 20000 },
    { background: '#ffb8b8', fonts: [{ text: '30.000đ', fontSize: '18px' }], value: 30000 },
  ];

  // Cấu hình nút quay
  const buttons = [
    { radius: '45%', background: '#617df2' },
    { radius: '40%', background: '#afc8ff' },
    {
      radius: '35%',
      background: '#869cfa',
      pointer: true,
      fonts: [{ text: 'QUAY', fontSize: '18px', fontColor: '#fff', fontWeight: 'bold' }],
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
        setPhoneError('Bạn đã quay rồi! Vui lòng kiểm tra Zalo để nhận mã.');
      }
      debugLog('Spin request blocked', { hasSpun, nameValid: !!trimmedName, phoneValid: validatePhone(sanitizedPhone), phone: maskPhone(sanitizedPhone) });
      return;
    }

    try {
      const eligibility = await checkEligibility(sanitizedPhone, CAMPAIGN_ID);
      if (!eligibility.eligible) {
        setHasSpun(true);
        setPhoneError(eligibility.message || 'Số điện thoại đã quay rồi.');
        debugLog('Eligibility rejected', eligibility);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kiểm tra điều kiện. Vui lòng thử lại sau.';
      setPhoneError(message);
      debugLog('Eligibility check failed', message);
      return;
    }

    debugLog('Spin initiated', { name: trimmedName, phone: maskPhone(sanitizedPhone) });
    setShowPopup(false);
    setPrizeCode('');
    setCurrentPrize(0);
    setIsSpinning(true);
    setHasSpun(true);

    // Bắt đầu quay
    wheelRef.current?.play();

    const generatedCode = generateCouponCode();
    const randomIndex = Math.floor(Math.random() * prizes.length);
    const fallbackPrizeValue = prizes[randomIndex].value;
    const spinStart = Date.now();

    try {
      debugLog('Dispatching spin webhook', {
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

        setTimeout(() => {
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
      setIsSpinning(false);
      setShowPopup(false);

      const duplicateAttempt = message.toLowerCase().includes('đã quay');
      setHasSpun(duplicateAttempt);
      setPhoneError(message);
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
        <LuckyWheelCanvas
          ref={wheelRef}
          width="350px"
          height="350px"
          prizes={prizes}
          buttons={buttons}
          onStart={handleStart}
        />
      </div>

      <div className="info-section">
        <h3>🎁 Giải thưởng</h3>
        <ul className="prize-list">
          <li>💰 Mã giảm giá 20.000đ</li>
          <li>💰 Mã giảm giá 30.000đ</li>
          <li>💰 Mã giảm giá 50.000đ</li>
          <li>💰 Mã giảm giá 100.000đ</li>
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
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
};

export default LuckyWheel;
