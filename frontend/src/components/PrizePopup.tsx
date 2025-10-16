import React from 'react';
import '../styles/PrizePopup.css';

interface PrizePopupProps {
  prize: number;
  code?: string;
  name: string;
  phone: string;
  expiresAt?: string;
  onClose: () => void;
}

const PrizePopup: React.FC<PrizePopupProps> = ({ prize, code, name, phone, expiresAt, onClose }) => {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const formatExpiry = (value?: string) => {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
    }).format(date);
  };

  const formattedExpiry = formatExpiry(expiresAt);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose}>
          ×
        </button>

        <div className="popup-body">
          <div className="popup-icon">🎉</div>
          <h2 className="popup-title">Chúc mừng!</h2>
          <p className="popup-message">
            {name ? `${name}, bạn đã trúng mã giảm giá` : 'Bạn đã trúng mã giảm giá'}
          </p>
          <div className="popup-prize">
            {formatPrice(prize)}đ
          </div>

          {formattedExpiry && (
            <div className="popup-expiry">
              <span>HSD đến:</span>
              <strong>{formattedExpiry}</strong>
            </div>
          )}

          {code && (
            <div className="popup-code">
              <p className="code-label">Mã giảm giá của bạn:</p>
              <div className="code-value">{code}</div>
              <button
                className="copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(code);
                  alert('Đã copy mã giảm giá!');
                }}
              >
                📋 Copy mã
              </button>
            </div>
          )}

          <p className="popup-note">
            {code
              ? `Xem lại mã giảm giá được gửi đến ZALO của bạn từ sdt ${phone}`
              : 'Vui lòng kiểm tra tin nhắn Zalo để nhận mã giảm giá!'
            }
          </p>
        </div>

        <button className="popup-button" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
};

export default PrizePopup;
