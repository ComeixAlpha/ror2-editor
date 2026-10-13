<p align="center">
  <img src="./src/favicon.ico" alt="Risk of Rain 2 save editor" width="120" height="120" />
</p>

<h1 align="center">ror2-editor</h1>

<p align="center">
  <strong>A web app that allows you to fully customize your Risk of Rain 2 savefile.</strong>
</p>

<p align="center">
  <a href="https://comeixalpha.github.io/ror2-editor/index.html">
    <img src="https://img.shields.io/badge/use%20it%20online-%E2%86%97-2EA44F" alt="Use it online" />
  </a>
  <a href="https://github.com/ComeixAlpha/ror2-editor/stargazers">
    <img src="https://img.shields.io/github/stars/ComeixAlpha/ror2-editor?color=000" alt="Stars" />
  </a>
  <a href="https://github.com/ComeixAlpha/ror2-editor/commits/main">
    <img src="https://img.shields.io/github/last-commit/ComeixAlpha/ror2-editor?color=000" alt="Last commit" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/pnpm-12.4.2-F69220?logo=pnpm&logoColor=white" alt="pnpm 12" />
  <img src="https://img.shields.io/badge/Node-22-5FA04E?logo=nodedotjs&logoColor=white" alt="Node 22" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/expansions-4-8B5CF6" alt="Four expansions" />
  <img src="https://img.shields.io/badge/achievements-205-E2E15E" alt="205 achievements" />
  <img src="https://img.shields.io/badge/logbook-618%20entries-8990A7" alt="618 logbook entries" />
  <img src="https://img.shields.io/badge/interface-English%20%7C%20%E4%B8%AD%E6%96%87-4B8BBE" alt="English and Chinese" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

## Screenshots

| Challenges | Logbook |
| :---: | :---: |
| ![Editing challenges](./gallery/challenges.png) | ![Browsing the logbook](./gallery/logbook.png) |

## Use it online

**<https://comeixalpha.github.io/ror2-editor/index.html>**

Hosted as part of [comeixalpha.github.io](https://comeixalpha.github.io/) — or build it from source, below.

## This is a fork

This project is a fork of [tjosepo/ror2-editor](https://github.com/tjosepo/ror2-editor), the original editor. All credit for the original application goes there; the fork exists to carry the features listed below.

What the fork adds on top of the original:

- Support for the base game plus all four expansions — **Survivors of the Void**, **Seekers of the Storm**, **Alloyed Collective** and **Hallowed Concepts** — 205 achievements in total.
- A Logbook tab that mirrors the in-game journal: the game's own artwork, the game's own ordering, and each item's real functional description.
- An English / Chinese interface, using the game's own translations for game content.
- Save validation derived from the game's deserialiser, so a broken profile is explained rather than silently written.

This repository is the source. The hosted copy is published from the [comeixalpha.github.io](https://github.com/ComeixAlpha/comeixalpha.github.io) Pages site, whose build checks this repository out and mounts it at `/ror2-editor/`, so that deployment always reflects `main` here.

The app makes no network requests of its own: loading, editing and exporting a profile all happen in the browser, and the save never leaves the machine.

## Building locally

This project uses [pnpm](https://pnpm.io/). With pnpm 10 or newer, most settings live in `pnpm-workspace.yaml` rather than `.npmrc`.

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

`pnpm build` produces a root-relative bundle, which is what `pnpm dev` and a root deployment want. To serve it from a sub-path, pass a base:

```
pnpm build --base=/ror2-editor/
```

The [ComeixAlpha Pages site](https://github.com/ComeixAlpha/comeixalpha.github.io) serves the editor that way: its workflow checks this repository out, builds it with that flag, and drops the result into its own `public/` directory. The entry point is the explicit `/ror2-editor/index.html` rather than the bare directory — see the note in that repository's `src/lib/shared.ts` for why.

Vite rewrites the paths it generates, but not the ones this app builds by hand — the icon and logbook image URLs. Those go through `import.meta.env.BASE_URL` (see `src/lib/public-url.ts`) so they follow the same prefix instead of resolving against the domain root.

`pnpm install` needs to run dependency install scripts for `esbuild`. It is allow-listed in `pnpm-workspace.yaml`; without it vite cannot find its esbuild binary. If you are behind a proxy, Node does not read the Windows system proxy — set `HTTPS_PROXY`/`HTTP_PROXY`, or uncomment the `proxy` entries in `.npmrc`.

## Where the game data comes from

The editor does **not** use hand-written tables. Everything under `src/data/generated/` is extracted from an installed copy of the game.

The extracted data is committed, so building the app needs no copy of the game. It covers the achievements and their icons, the logbook — all 618 entries with their artwork and each pickup's functional description — and the loadout viewables.

## How saves are written

Only the nodes the editor manages are touched. Every other element, attribute and token in the profile is carried through byte-for-byte, so a save from a newer game version survives an edit instead of being silently trimmed. `tests/xml.test.mjs` asserts a byte-identical round-trip on a real 552 KB profile.

Achievements and unlockables are two independent lists: granting an achievement writes the id to `<achievementsList>` **and** the reward string to `<stats><unlock>`, because writing only the achievement does nothing in-game.
