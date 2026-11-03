# 0004 — Player photos and web pages

- Status: accepted
- Date: 2026-11-04

## Context

Players have a photo (taken with the camera or picked from the gallery). Photos must be stored at most 512 px wide or tall to keep the data volume and the pages light. The app is used on a home network, often over plain HTTP, where browsers refuse the camera API (secure contexts only).

## Decision

- Photos are resized on the server with the [`sharp`](https://sharp.pixelplumbing.com/) library: auto-rotated from the EXIF orientation, fitted inside 512×512 (never enlarged), saved as JPEG in `UPLOAD_DIR`. Any input that `sharp` cannot decode is rejected.
- The browser uses the camera API (`getUserMedia`) only in a secure context. Otherwise the shutter button opens a file input with `capture="user"`, which works over plain HTTP on phones and tablets. A second button picks a file from the gallery.
- Pages are static HTML, CSS and plain JavaScript files in `public/`, served by Fastify under `/static/`. There is no front-end framework or build step.

## Alternatives considered

- Resizing in the browser only: cannot be trusted and does not cover the file-input path.
- `jimp` (pure JavaScript): no native binary, but much slower and larger memory use; `sharp` ships prebuilt binaries for the Docker image (Debian slim).
- A front-end framework: too heavy for a few simple screens.

## Consequences

- One new dependency (`sharp`, pinned); the Docker image installs its prebuilt binary during `npm ci`.
- `public/` must be copied into the Docker image.
