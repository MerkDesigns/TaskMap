import { useLayoutEffect, useState } from "react";

const DEFAULT_DELAY = 0.3;
const DEFAULT_CURVE = 1;

/**
 * Development-only blur timing for material fades (glass contract section 17): writes the recipe's
 * delay/curve variables on the document root so every native glass recipe inherits them.
 */
export function BlurPresenceTuning() {
  const [delay, setDelay] = useState(DEFAULT_DELAY);
  const [curve, setCurve] = useState(DEFAULT_CURVE);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--taskmap-material-blur-presence-delay", String(delay));
    root.setProperty("--taskmap-material-blur-presence-curve", String(curve));
    return () => {
      root.removeProperty("--taskmap-material-blur-presence-delay");
      root.removeProperty("--taskmap-material-blur-presence-curve");
    };
  }, [curve, delay]);

  return (
    <>
      <label>
        Blur delay
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
        />
        <output>{delay.toFixed(2)}</output>
      </label>
      <label>
        Blur curve
        <input
          type="range"
          min={0.4}
          max={3}
          step={0.1}
          value={curve}
          onChange={(e) => setCurve(Number(e.target.value))}
        />
        <output>{curve.toFixed(1)}</output>
      </label>
    </>
  );
}
