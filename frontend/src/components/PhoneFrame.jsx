/**
 * Polished phone bezel wrapping the WhatsApp-style chat.
 * Full-bleed (no bezel) on mobile — see globals.css.
 */
export default function PhoneFrame({ children }) {
  return (
    <div className="phone-frame">
      <div className="phone-notch" />
      <div className="phone-screen">{children}</div>
    </div>
  );
}
