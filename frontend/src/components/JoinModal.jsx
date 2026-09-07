import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../services/api';

const COUNTRIES = [
  { code: '+91', name: 'India', flag: '🇮🇳', digits: 10, pattern: /^[6-9]\d{9}$/ },
  { code: '+1', name: 'United States', flag: '🇺🇸', digits: 10, pattern: /^\d{10}$/ },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', digits: 10, pattern: /^\d{10}$/ },
  { code: '+971', name: 'UAE', flag: '🇦🇪', digits: 9, pattern: /^\d{9}$/ },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', digits: 9, pattern: /^\d{9}$/ },
  { code: '+61', name: 'Australia', flag: '🇦🇺', digits: 9, pattern: /^\d{9}$/ },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', digits: 10, pattern: /^\d{10}$/ },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', digits: 10, pattern: /^\d{10}$/ },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', digits: 10, pattern: /^\d{10}$/ },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', digits: 8, pattern: /^\d{8}$/ },
];

export default function JoinModal({ onJoin, isConnected }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  const phoneInputRef = useRef(null);
  const currentCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  // Resend Timer countdown
  useEffect(() => {
    let interval;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Physical Keyboard Listener for Screen 2 (OTP Keypad sync)
  useEffect(() => {
    if (step !== 'otp') return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        setOtp((prev) => (prev.length < 6 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        setOtp((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (otp.length === 6) verifyOtpCode(otp);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, otp]);

  // Handle phone input changes with strict digit limit
  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    if (digitsOnly.length <= currentCountry.digits) {
      setPhone(digitsOnly);
      if (error) setError('');
    }
  };

  // Step 1: Send OTP using centralized authApi
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (phone.length !== currentCountry.digits) {
      setError(`Enter ${currentCountry.digits} digits for ${currentCountry.name}.`);
      return;
    }

    if (currentCountry.pattern && !currentCountry.pattern.test(phone)) {
      if (countryCode === '+91') {
        setError('Number must start with 6, 7, 8, or 9.');
        return;
      }
    }

    setLoading(true);

    try {
      const data = await authApi.sendOtp(countryCode, phone);

      if (data.data?.otp) {
        setDevOtpHint(data.data.otp);
      }

      setStep('otp');
      setOtp('');
      setTimer(60);
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP using centralized authApi
  const verifyOtpCode = async (codeToVerify) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await authApi.verifyOtp(countryCode, phone, code);
      const user = data.user;
      onJoin(user.fullPhone || user.id, user);
    } catch (err) {
      setError(err.message || 'Invalid 6-digit code');
    } finally {
      setLoading(false);
    }
  };

  // Virtual Keypad Button Press
  const handleKeypadPress = (val) => {
    if (val === 'del') {
      setOtp((prev) => prev.slice(0, -1));
    } else {
      setOtp((prev) => {
        if (prev.length < 6) {
          const next = prev + val;
          if (next.length === 6) {
            setTimeout(() => verifyOtpCode(next), 200);
          }
          return next;
        }
        return prev;
      });
    }
  };

  // Format OTP display like "- - -   - - -"
  const renderOtpDisplay = () => {
    const chars = otp.split('');
    const firstHalf = [0, 1, 2].map((i) => chars[i] || '—');
    const secondHalf = [3, 4, 5].map((i) => chars[i] || '—');

    return (
      <div className="wa-auth-otp-display" onClick={() => phoneInputRef.current?.focus()}>
        <div className="wa-auth-otp-group">
          {firstHalf.map((c, i) => (
            <span key={i} className={`wa-auth-dash ${chars[i] ? 'active' : ''}`}>{c}</span>
          ))}
        </div>
        <div className="wa-auth-otp-spacer"></div>
        <div className="wa-auth-otp-group">
          {secondHalf.map((c, i) => (
            <span key={i + 3} className={`wa-auth-dash ${chars[i + 3] ? 'active' : ''}`}>{c}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="wa-phone-frame">
      {/* Speaker / Camera Notch */}
      <div className="wa-phone-notch">
        <div className="wa-phone-speaker"></div>
        <div className="wa-phone-camera"></div>
      </div>

      <div className="wa-phone-screen">
        {/* Step 1: Phone Number */}
        {step === 'phone' ? (
          <div className="wa-auth-content">
            {/* Top WhatsApp Icon */}
            <div className="wa-auth-logo-wrap">
              <div className="wa-auth-logo">
                <i className="fa-brands fa-whatsapp"></i>
              </div>
            </div>

            <h2 className="wa-auth-title">Welcome to WhatsApp</h2>

            {error && <div className="wa-auth-error">{error}</div>}

            {/* Input Pill Container */}
            <div className="wa-auth-input-pill">
              <div className="wa-auth-country-select">
                <span>{currentCountry.flag}</span>
                <select
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    setPhone('');
                    setError('');
                  }}
                  className="wa-auth-hidden-select"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <span className="wa-auth-code-text">{countryCode}</span>

              <input
                ref={phoneInputRef}
                type="tel"
                className="wa-auth-phone-input"
                placeholder={Array(currentCountry.digits).fill('—').join(' ')}
                value={phone}
                onChange={handlePhoneChange}
                autoFocus
              />
            </div>

            {/* Send Button */}
            <button
              type="button"
              className="wa-auth-green-btn"
              onClick={handleSendOtp}
              disabled={loading || !isConnected || phone.length !== currentCountry.digits}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>

            {/* Terms & Privacy */}
            <div className="wa-auth-legal">
              Read our <a href="#privacy">Privacy Policy</a>. Tap "Agree & Continue" to accept the <a href="#terms">Terms of Service</a>.
            </div>

            {/* from FACEBOOK Branding */}
            <div className="wa-auth-footer-brand">
              <div className="wa-brand-from">from</div>
              <div className="wa-brand-name">FACEBOOK</div>
            </div>
          </div>
        ) : (
          /* Step 2: OTP SMS Code */
          <div className="wa-auth-content otp-mode">
            <button
              type="button"
              className="wa-auth-back-btn"
              onClick={() => {
                setStep('phone');
                setError('');
              }}
              title="Edit Phone Number"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>

            {/* WhatsApp Logo */}
            <div className="wa-auth-logo-wrap">
              <div className="wa-auth-logo">
                <i className="fa-brands fa-whatsapp"></i>
              </div>
            </div>

            <h2 className="wa-auth-title">Welcome to WhatsApp</h2>
            <div className="wa-auth-subtitle">Enter SMS code</div>

            {devOtpHint && (
              <div className="wa-auth-dev-hint">
                Code: <strong>{devOtpHint}</strong>
              </div>
            )}

            {error && <div className="wa-auth-error">{error}</div>}

            {/* Visual "- - -   - - -" Display */}
            {renderOtpDisplay()}

            {/* Done Button */}
            <button
              type="button"
              className="wa-auth-green-btn done-btn"
              onClick={() => verifyOtpCode(otp)}
              disabled={loading || otp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Done'}
            </button>

            {/* Mobile Keypad */}
            <div className="wa-ios-keypad">
              <div className="keypad-row">
                <button type="button" onClick={() => handleKeypadPress('1')} className="keypad-btn">
                  <span className="num">1</span>
                  <span className="sub">&nbsp;</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('2')} className="keypad-btn">
                  <span className="num">2</span>
                  <span className="sub">ABC</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('3')} className="keypad-btn">
                  <span className="num">3</span>
                  <span className="sub">DEF</span>
                </button>
              </div>

              <div className="keypad-row">
                <button type="button" onClick={() => handleKeypadPress('4')} className="keypad-btn">
                  <span className="num">4</span>
                  <span className="sub">GHI</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('5')} className="keypad-btn">
                  <span className="num">5</span>
                  <span className="sub">JKL</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('6')} className="keypad-btn">
                  <span className="num">6</span>
                  <span className="sub">MNO</span>
                </button>
              </div>

              <div className="keypad-row">
                <button type="button" onClick={() => handleKeypadPress('7')} className="keypad-btn">
                  <span className="num">7</span>
                  <span className="sub">PQRS</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('8')} className="keypad-btn">
                  <span className="num">8</span>
                  <span className="sub">TUV</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('9')} className="keypad-btn">
                  <span className="num">9</span>
                  <span className="sub">WXYZ</span>
                </button>
              </div>

              <div className="keypad-row">
                <div className="keypad-btn empty">
                  <span className="sub">+ * #</span>
                </div>
                <button type="button" onClick={() => handleKeypadPress('0')} className="keypad-btn">
                  <span className="num">0</span>
                  <span className="sub">&nbsp;</span>
                </button>
                <button type="button" onClick={() => handleKeypadPress('del')} className="keypad-btn backspace-btn">
                  <i className="fa-solid fa-delete-left"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Home Indicator Bar */}
        <div className="wa-phone-home-indicator"></div>
      </div>
    </div>
  );
}
