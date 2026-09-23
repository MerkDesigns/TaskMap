"""Small, isolated generator tests; no app launch or full-media allocation."""

import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "fixture", Path(__file__).with_name("generate-glass-benchmark.py"))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class GlassBenchmarkTests(unittest.TestCase):
    def test_stills_are_deterministic_distinct_and_decodable(self):
        data, meta = fixture.encode_asset(0, fixture.SMOKE)
        self.assertEqual((data, meta), fixture.encode_asset(0, fixture.SMOKE))
        self.assertNotEqual(data, fixture.encode_asset(2, fixture.SMOKE)[0])
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            self.assertEqual(image.format, "WEBP")
            self.assertEqual(image.size, fixture.SMOKE["still_size"])
        self.assertEqual(meta["sha256"], hashlib.sha256(data).hexdigest())

    def test_gif_contains_changing_frames_and_loop_timing(self):
        data, meta = fixture.encode_asset(1, fixture.SMOKE)
        self.assertEqual((data, meta), fixture.encode_asset(1, fixture.SMOKE))
        with Image.open(io.BytesIO(data)) as image:
            self.assertEqual(image.n_frames, 3)
            self.assertEqual(image.info["loop"], 0)
            pictures = []
            for frame in range(image.n_frames):
                image.seek(frame)
                self.assertEqual(image.info["duration"], 80)
                pictures.append(image.convert("RGB").tobytes())
            self.assertEqual(len(set(pictures)), 3)

    def test_normal_layout_counts_references_and_extensions(self):
        assets = [{"sha256": f"asset-{i}", "width": 768, "height": 512, "format": "webp"}
                  for i in range(500)]
        document = fixture.create_document(fixture.NORMAL, assets)
        self.assertEqual(len(document["canvases"]), 25)
        elements = [element for canvas in document["canvases"]
                    for kind in ("containers", "textCards", "textBlocks", "images")
                    for element in canvas[kind]]
        self.assertEqual(len(elements), 2000)
        self.assertEqual(len({element["id"] for element in elements}), 2000)
        self.assertEqual({e["imageId"] for e in elements if "imageId" in e},
                         {asset["sha256"] for asset in assets})
        extensions = {key for element in elements for key in element["extensions"]}
        self.assertEqual(extensions, {"search", "checkbox", "privacy", "lock", "colorPicker"})
        self.assertEqual(document, fixture.create_document(fixture.NORMAL, assets))
        with self.assertRaises(ValueError):
            fixture.create_document(fixture.NORMAL, assets[:-1])

    def test_manifest_and_refusal_to_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="taskmap-fixture-test-") as root:
            destination = Path(root) / "smoke"
            manifest = fixture.generate(fixture.SMOKE, destination)
            self.assertFalse(manifest["loadedIntoTaskMap"])
            self.assertFalse(manifest["releasePerformanceAccepted"])
            self.assertEqual(manifest["mediaCount"], 4)
            for asset in manifest["assets"]:
                data = (destination / asset["file"]).read_bytes()
                self.assertEqual(len(data), asset["bytes"])
                self.assertEqual(hashlib.sha256(data).hexdigest(), asset["sha256"])
            self.assertEqual(json.loads((destination / "manifest.json").read_text()),
                             json.loads(fixture.json_bytes(manifest)))
            fixture.verify(fixture.SMOKE, destination)
            with self.assertRaises(FileExistsError):
                fixture.generate(fixture.SMOKE, destination)

    def test_verifier_rejects_changed_asset(self):
        with tempfile.TemporaryDirectory(prefix="taskmap-fixture-test-") as root:
            destination = Path(root) / "tampered"
            manifest = fixture.generate(fixture.SMOKE, destination)
            asset = destination / manifest["assets"][0]["file"]
            asset.write_bytes(b"invalid fixture media")
            with self.assertRaises(ValueError):
                fixture.verify(fixture.SMOKE, destination)

    def test_undersized_corpus_never_gets_completion_manifest(self):
        with tempfile.TemporaryDirectory(prefix="taskmap-fixture-test-") as root:
            destination = Path(root) / "undersized"
            with self.assertRaises(ValueError):
                fixture.generate({**fixture.SMOKE, "minimum_media_bytes": 500_000_000}, destination)
            self.assertFalse((destination / "manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
