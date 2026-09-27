import {
  StableGlassPlane,
  StableGlassSurface,
  type StableGlassShape,
} from "../../ui/materials/experimental/StableGlassPlane";

export const PROOF_PLANE_BOUNDS = { width: 1100, height: 425 };
const a: StableGlassShape = { x: 90, y: 55, width: 530, height: 290, radius: 20 };
const b: StableGlassShape = { x: 380, y: 75, width: 310, height: 120, radius: 20 };
const lower: StableGlassShape = { x: 114, y: 185, width: 210, height: 110, radius: 14 };
const upper: StableGlassShape = { x: 380, y: 185, width: 210, height: 110, radius: 14 };
const held: StableGlassShape = { x: 220, y: 210, width: 210, height: 110, radius: 14 };
const overlayShape: StableGlassShape = { x: 430, y: 225, width: 290, height: 145, radius: 20 };

export interface ProofSurfaceState {
  readonly majorA: boolean;
  readonly ink: boolean;
  readonly lowerInk: boolean;
  readonly overlay: boolean;
  readonly promoted: boolean;
  readonly separated: boolean;
}

export function StableProofSurfaces({
  majorA,
  ink,
  lowerInk,
  overlay,
  promoted,
  separated,
}: ProofSurfaceState) {
  const majorB = separated ? { ...b, x: 660 } : b;
  return (
    <>
      <StableGlassPlane
        depth="major-base"
        {...PROOF_PLANE_BOUNDS}
        shapes={majorA ? [a, majorB] : [majorB]}
      />
      {majorA && (
        <StableGlassSurface depth="major-base" shape={a} name="major-a">
          <h2>Persistent Major A · L1</h2>
          <div className="taskmap-glass-proof__ink" data-proof-ink={ink}>
            A content
          </div>
        </StableGlassSurface>
      )}
      <StableGlassSurface depth="major-base" shape={majorB} name="major-b">
        <h2>Persistent Major B · L1</h2>
        <p>A ink must not affect this glass.</p>
      </StableGlassSurface>
      {majorA && (
        <>
          <StableGlassPlane
            depth="minor-settled"
            {...PROOF_PLANE_BOUNDS}
            shapes={promoted ? [lower] : [lower, upper]}
          />
          <StableGlassSurface depth="minor-settled" shape={lower} name="minor-lower">
            <strong>Lower Minor</strong>
            <div className="taskmap-glass-proof__card-ink" data-proof-ink={lowerInk}>
              TEXT · ▦ · cyan / magenta
            </div>
          </StableGlassSurface>
          {promoted && (
            <StableGlassPlane depth="minor-promoted" {...PROOF_PLANE_BOUNDS} shapes={[held]} />
          )}
          <StableGlassSurface
            depth={promoted ? "minor-promoted" : "minor-settled"}
            shape={promoted ? held : upper}
            name="minor-upper"
          >
            <strong>{promoted ? "Promoted Minor" : "Settled Minor"}</strong>
            <p>Same recipe and radius</p>
          </StableGlassSurface>
        </>
      )}
      {overlay && (
        <>
          <StableGlassPlane depth="major-overlay" {...PROOF_PLANE_BOUNDS} shapes={[overlayShape]} />
          <StableGlassSurface depth="major-overlay" shape={overlayShape} name="overlay">
            <h2>Overlay Major · L2</h2>
            <p>Should sample completed lower UI.</p>
          </StableGlassSurface>
        </>
      )}
    </>
  );
}
