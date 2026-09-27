# 2. Read stop lists locally first; the cloud only as a fallback

Date: 2026-09-27 · Status: accepted

## Context
The scanner list contains customer names and addresses (personal data under the GDPR). There are three ways to read it: a cloud model (Claude), the owner's local inference appliance (RTX 4090), or the iPhone's on-device OCR.

## Decision
- **iOS app**: Apple Vision reads the photo on the phone. Only the text is sent to the PC, where the local Qwen3-VL-8B turns it into stops. Code then grounds the result against the OCR text: Express times per stop, and digit look-alikes such as `27l` → `271`.
- **Web app / photos**: the local Qwen3-VL-8B reads the image.
- **Claude** is used only when the local model fails or returns invalid stops (`VISION=auto`). `VISION=appliance` never uses the cloud.
- Qwen3-VL-8B was chosen over the appliance's 30B because it scores about the same on OCRBench (≈89.6) on a third of the VRAM. With its context pinned to 16k (`ctx:` in its model.yml), a photo takes about 4 s instead of 100 s.
- Appliance requests carry a dummy `tools` entry, so the appliance acts as a transparent backend and never runs its own tools (such as mail search).

## Consequences
Customer data stays on the owner's devices unless the local model fails. The appliance router changes live in the owner's jan-router repo (`engines.window_for`, `weights.py`), which isn't part of this repo.
