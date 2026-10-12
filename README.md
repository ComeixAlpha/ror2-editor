## ror2-editor

A web app that allows you to fully customize your Risk of Rain 2 savefile.

### This is a fork

This project is a fork of [tjosepo/ror2-editor](https://github.com/tjosepo/ror2-editor), the original
editor. All credit for the original application goes there; the fork exists to carry the features
listed below.

What the fork adds on top of the original:

- Support for the base game plus all four expansions — **Survivors of the Void**,
  **Seekers of the Storm**, **Alloyed Collective** and **Hallowed Concepts** — 205 achievements
  in total.
- A Logbook tab that mirrors the in-game journal: the game's own artwork, the game's own ordering,
  and each item's real functional description.
- An English / Chinese interface, using the game's own translations for game content.
- Save validation derived from the game's deserialiser, so a broken profile is explained rather
  than silently written.

This repository is the source, meant to be built and run locally. It is not operated as a hosted
service, and it makes no network requests of its own.

## Building locally

This project uses [pnpm](https://pnpm.io/). With pnpm 10 or newer, most settings live in
`pnpm-workspace.yaml` rather than `.npmrc`.

```
pnpm install
pnpm build
```

Run the development server with:

```
pnpm dev
```

Run the test suite with:

```
pnpm test
```

## Deploying under a sub-path

`pnpm build` produces a root-relative bundle, which is what `pnpm dev` and a root deployment want.
To serve it from a sub-path, pass a base:

```
pnpm build --base=/ror2-editor/
```

The [ComeixAlpha Pages site](https://github.com/ComeixAlpha/comeixalpha.github.io) mounts the editor
at `/ror2-editor/` that way: its workflow checks this repository out, builds it with that flag, and
drops the result into its own `public/` directory.

Vite rewrites the paths it generates, but not the ones this app builds by hand — the icon and
logbook image URLs. Those go through `import.meta.env.BASE_URL` (see `src/lib/public-url.ts`) so
they follow the same prefix instead of resolving against the domain root.

`pnpm install` needs to run dependency install scripts for `esbuild`. It is allow-listed in
`pnpm-workspace.yaml`; without it vite cannot find its esbuild binary. If you are behind a proxy,
Node does not read the Windows system proxy — set `HTTPS_PROXY`/`HTTP_PROXY`, or uncomment the
`proxy` entries in `.npmrc`.

## Where the game data comes from

The editor does **not** use hand-written tables. Everything under `src/data/generated/` is
extracted from an installed copy of the game:

```powershell
powershell -File tools/build-data.ps1
```

The extractor reads `RoR2.dll` metadata and the game's own language files. It never launches the
game, never touches a save, and needs no network. Re-run it after a game update and the validators
will tell you if anything drifted. See [tools/KNOWN-GAPS.md](tools/KNOWN-GAPS.md) for exactly what
is and is not recoverable this way, and why.

`tools/` and `research/` are development-only and are not tracked in git.

## How saves are written

Only the nodes the editor manages are touched. Every other element, attribute and token in the
profile is carried through byte-for-byte, so a save from a newer game version survives an edit
instead of being silently trimmed. `tests/xml.test.mjs` asserts a byte-identical round-trip on a
real 552 KB profile.

Achievements and unlockables are two independent lists: granting an achievement writes the id to
`<achievementsList>` **and** the reward string to `<stats><unlock>`, because writing only the
achievement does nothing in-game.
