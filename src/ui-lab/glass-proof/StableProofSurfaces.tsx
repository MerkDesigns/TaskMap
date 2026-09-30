import {
  StableGlassPlane,
  StableGlassSurface,
  type StableGlassShape,
} from "../../ui/materials/experimental/StableGlassPlane";

export const PROOF_PLANE_BOUNDS = { width: 1100, height: 425 };
const a: StableGlassShape = { x: 90, y: 55, width: 530, height: 290, radius: 20 };
const b: StableGlassShape = { x: 380, y: 75, width: 310, height: 120, radius: 20 };
const c: StableGlassShape = { x: 480, y: 155, width: 260, height: 145, radius: 20 };
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
  readonly expanded: boolean;
  readonly promotionInPlace: boolean;
  readonly thirdMajor: boolean;
}

export function StableProofSurfaces({
  majorA,
  ink,
  lowerInk,
  overlay,
  promoted,
  separated,
  expanded,
  promotionInPlace,
  thirdMajor,
}: ProofSurfaceState) {
  const upperShape = promoted && !promotionInPlace ? held : upper;
  const majorB = {
    ...b,
    x: separated ? 660 : b.x,
    ...(expanded && { width: 390, height: 240 }),
  };
  const occluders = thirdMajor ? [majorB, c] : [majorB];
  const occlusion = { ...PROOF_PLANE_BOUNDS, shapes: occluders };
  return (
    <>
      <StableGlassPlane
        depth="major-base"
        {...PROOF_PLANE_BOUNDS}
        shapes={majorA ? [a, ...occluders] : occluders}
      />
      {majorA && (
        <StableGlassSurface depth="major-base" shape={a} name="major-a" occlusion={occlusion}>
          <h2>Persistent Major A · L1</h2>
          <div className="taskmap-glass-proof__ink" data-proof-ink={ink}>
            A content
          </div>
        </StableGlassSurface>
      )}
      <StableGlassSurface
        depth="major-base"
        shape={majorB}
        name="major-b"
        occlusion={{ ...PROOF_PLANE_BOUNDS, shapes: thirdMajor ? [c] : [] }}
      >
        <h2>Persistent Major B · L1</h2>
        <p>A ink must not affect this glass.</p>
      </StableGlassSurface>
      {thirdMajor && (
        <StableGlassSurface depth="major-base" shape={c} name="major-c">
          <h2>Persistent Major C · L1</h2>
          <p>Overlap must not reveal A or B.</p>
        </StableGlassSurface>
      )}
      {majorA && (
        <>
          <StableGlassPlane
            depth="minor-settled"
            {...PROOF_PLANE_BOUNDS}
            shapes={promoted ? [lower] : [lower, upper]}
            occluders={occluders}
          />
          <StableGlassSurface
            depth="minor-settled"
            shape={lower}
            name="minor-lower"
            occlusion={occlusion}
          >
            <strong>Lower Minor</strong>
            <div className="taskmap-glass-proof__card-ink" data-proof-ink={lowerInk}>
              TEXT · ▦ · cyan / magenta
            </div>
          </StableGlassSurface>
          {promoted && (
            <StableGlassPlane
              depth="minor-promoted"
              {...PROOF_PLANE_BOUNDS}
              shapes={[upperShape]}
              occluders={occluders}
            />
          )}
          <StableGlassSurface
            depth={promoted ? "minor-promoted" : "minor-settled"}
            shape={upperShape}
            name="minor-upper"
            occlusion={occlusion}
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
