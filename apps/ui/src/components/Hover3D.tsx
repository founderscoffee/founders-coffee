/**
 * daisyUI `hover-3d` wrapper — wraps a card (the first child) + 8 invisible zone overlays that
 * drive the tilt direction. The card lifts + tilts toward whichever zone the cursor enters, plus a
 * shine sweep. The zones are aria-hidden (purely presentational).
 */
export const Hover3D = ({ children }: { children: React.ReactNode }) => (
  <div className="hover-3d">
    {children}
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
  </div>
)
