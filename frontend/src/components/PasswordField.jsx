import { useState } from "react";

// Password box with a "show / hide" eye button.
export default function PasswordField({ value, onChange, placeholder = "Password", autoComplete, required = true, minLength, inputRef, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input className="form-control" type={show ? "text" : "password"} placeholder={placeholder} value={value}
             onChange={onChange} autoComplete={autoComplete} required={required} minLength={minLength} ref={inputRef} autoFocus={autoFocus} />
      <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}
