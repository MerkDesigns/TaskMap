"""Generate synthetic benchmark files only; never open TaskMap or access its storage."""

import argparse
import hashlib
import io
import json
import platform
import random
from pathlib import Path

import PIL
from PIL import Image, features

NORMAL = {
    "name": "glass-normal-v1", "canvases": 25, "elements_per_canvas": 80,
    "still_size": (768, 512), "gif_size": (256, 256), "gif_frames": 12,
    "gif_every": 10, "minimum_media_bytes": 500_000_000,
}
SMOKE = {
    "name": "glass-smoke-v1", "canvases": 2, "elements_per_canvas": 8,
    "still_size": (64, 48), "gif_size": (32, 24), "gif_frames": 3,
    "gif_every": 2, "minimum_media_bytes": 0,
}
ACCENT = "#476FA8"
SEED = 604506


def encode_asset(index, profile):
    """Unique, seeded high-entropy stills and real looping animations; no padding."""
    rng = random.Random(SEED + index)
    animated = (index + 1) % profile["gif_every"] == 0
    width, height = profile["gif_size" if animated else "still_size"]
    output = io.BytesIO()
    frame_count = profile["gif_frames"] if animated else 1
    if animated:
        palette = [channel for i in range(256) for channel in (i, (i * 3) % 256, 255 - i)]
        frames = []
        for frame in range(frame_count):
            picture = Image.frombytes("P", (width, height), rng.randbytes(width * height))
            picture.putpalette(palette)
            x = frame * width // frame_count
            picture.paste(255, (x, 0, min(width, x + max(1, width // 16)), height))
            frames.append(picture)
        frames[0].save(output, format="GIF", save_all=True, append_images=frames[1:],
                       duration=80, loop=0, optimize=False, disposal=2)
    else:
        picture = Image.frombytes("RGB", (width, height), rng.randbytes(width * height * 3))
        picture.save(output, format="WEBP", lossless=True, method=0, exact=True)
    data = output.getvalue()
    return data, {
        "sha256": hashlib.sha256(data).hexdigest(),
        "format": "gif" if animated else "webp",
        "width": width, "height": height, "frames": frame_count, "bytes": len(data),
    }


def create_document(profile, assets):
    expected = profile["canvases"] * profile["elements_per_canvas"] // 4
    if len(assets) != expected:
        raise ValueError(f"Expected {expected} distinct assets")
    canvases = []
    asset_index = 0
    for canvas_index in range(profile["canvases"]):
        canvas_id = f"benchmark-canvas-{canvas_index + 1:02d}"
        canvas = {
            "id": canvas_id, "name": f"Benchmark {canvas_index + 1:02d}",
            "width": 5000, "height": 4000, "containers": [], "textCards": [],
            "textBlocks": [], "images": [], "mindmapConnections": [],
            "pan": {"x": -120, "y": -120}, "zoom": 1,
            "previewViewport": {"width": 1280, "height": 820},
        }
        for index in range(profile["elements_per_canvas"]):
            kind = index % 4
            element = {
                "id": f"{canvas_id}-element-{index:03d}",
                "x": 120 + (index % 8) * 540, "y": 120 + (index // 8) * 340,
                "accent": ACCENT, "layer": index,
                "extensions": {"colorPicker": {"enabled": True}},
            }
            if kind == 0:
                element.update(name=f"Container {index}", width=480, height=280)
                element["extensions"].update(search={"query": ""})
                canvas["containers"].append(element)
            elif kind == 1:
                element.update(text=f"Synthetic card {index}")
                element["extensions"].update(checkbox={"checked": index % 3 == 0})
                canvas["textCards"].append(element)
            elif kind == 2:
                element.update(name=f"Text block {index}", text="Synthetic benchmark content",
                               width=480, height=280)
                # Installed but inactive: benchmark drag/resize remains available.
                element["extensions"].update(privacy={"enabled": False}, lock={"enabled": False})
                canvas["textBlocks"].append(element)
            else:
                asset = assets[asset_index]
                asset_index += 1
                element.update(imageId=asset["sha256"], format=asset["format"],
                               naturalWidth=asset["width"], naturalHeight=asset["height"],
                               width=480, height=280, background=True)
                canvas["images"].append(element)
        # Retained mind-map connections, without changing the 2,000-element count.
        canvas["mindmapConnections"] = [{
            "id": f"{canvas_id}-connection-1", "sourceId": canvas["containers"][0]["id"],
            "sourcePort": "right", "targetId": canvas["textBlocks"][0]["id"],
            "targetPort": "left", "accent": ACCENT,
        }]
        canvases.append(canvas)
    return {
        "schemaVersion": 2, "activeCanvasId": canvases[0]["id"], "canvases": canvases,
        "canvasGridStyle": "dots", "canvasGridOpacity": {"dots": 50, "lines": 15},
        "defaultElementColors": dict.fromkeys(
            ("container", "textCard", "textBlock", "image", "mindmap"), ACCENT),
        "recentColors": [], "shadowsUnderElements": False, "allowLockedElementDeletion": True,
        # Required by the active legacy schema, not a reintroduction of removed features.
        "discordRpcEnabled": False, "discordRpcShowCanvas": False,
        "minimapEnabled": True, "privacyModeEnabled": False, "toolbarButtonsVisible": False,
    }


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + "\n").encode("utf-8")


def generate(profile, destination):
    # Refuse existing directories, including partial runs. Never delete or overwrite a fixture.
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "media").mkdir()
    assets = []
    count = profile["canvases"] * profile["elements_per_canvas"] // 4
    for index in range(count):
        data, asset = encode_asset(index, profile)
        asset["file"] = f"media/{asset['sha256']}.{asset['format']}"
        with (destination / asset["file"]).open("xb") as output:
            output.write(data)
        assets.append(asset)
        if (index + 1) % 50 == 0:
            print(f"Generated {index + 1}/{count} assets", flush=True)
    total = sum(asset["bytes"] for asset in assets)
    if total < profile["minimum_media_bytes"]:
        raise ValueError(f"Corpus too small: {total} bytes; no completion manifest written")
    document = json_bytes(create_document(profile, assets))
    with (destination / "document.json").open("xb") as output:
        output.write(document)
    manifest = {
        "fixtureVersion": 1, "profile": profile, "seed": SEED,
        "producer": {"python": platform.python_version(), "pillow": PIL.__version__,
                     "webp": features.version("webp")},
        "document": {"file": "document.json", "sha256": hashlib.sha256(document).hexdigest()},
        "canvasCount": profile["canvases"],
        "elementCount": profile["canvases"] * profile["elements_per_canvas"],
        "mediaBytes": total, "mediaCount": len(assets), "assets": assets,
        "loadedIntoTaskMap": False, "releasePerformanceAccepted": False,
        "note": "Prepared files only, not a portable .tmap or an accepted performance result.",
    }
    with (destination / "manifest.json").open("xb") as output:
        output.write(json_bytes(manifest))
    print(f"Prepared {destination}: {count} assets, {total:,} bytes. NOT imported.", flush=True)
    return manifest


def verify(profile, destination):
    """Decode every asset/frame and check hashes, metadata and document references offline."""
    manifest = json.loads((destination / "manifest.json").read_bytes())
    if manifest["profile"] != json.loads(json_bytes(profile)):
        raise ValueError("Profile mismatch")
    assets = manifest["assets"]
    total = 0
    hashes = set()
    for asset in assets:
        file_path = (destination / asset["file"]).resolve()
        if not file_path.is_relative_to((destination / "media").resolve()):
            raise ValueError("Asset escapes fixture media directory")
        data = file_path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if digest != asset["sha256"] or digest in hashes or len(data) != asset["bytes"]:
            raise ValueError("Asset hash, uniqueness or size mismatch")
        hashes.add(digest)
        with Image.open(io.BytesIO(data)) as picture:
            if (picture.format.lower(), picture.size, picture.n_frames) != (
                    asset["format"], (asset["width"], asset["height"]), asset["frames"]):
                raise ValueError("Decoded asset metadata mismatch")
            for frame in range(picture.n_frames):
                picture.seek(frame)
                picture.load()
        total += len(data)
    document = (destination / "document.json").read_bytes()
    if hashlib.sha256(document).hexdigest() != manifest["document"]["sha256"]:
        raise ValueError("Document checksum mismatch")
    if json.loads(document) != create_document(profile, assets):
        raise ValueError("Document layout or media references mismatch")
    if total != manifest["mediaBytes"] or total < profile["minimum_media_bytes"]:
        raise ValueError("Media byte budget mismatch")
    print(f"Verified {len(assets)} distinct assets, all frames, {total:,} bytes. NOT imported.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true", help="Tiny codec/schema test, not normal acceptance")
    parser.add_argument("--verify", action="store_true", help="Read/decode existing fixture without writing")
    args = parser.parse_args()
    selected = SMOKE if args.smoke else NORMAL
    action = verify if args.verify else generate
    action(selected, Path(__file__).resolve().parents[1] / "fixtures" / selected["name"])
