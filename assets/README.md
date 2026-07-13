# Cyber Flight Assets V1

This folder contains the first UI and visual asset pass for Cyber Flight MVP.

The current pass uses SVG files as clean, scalable implementation placeholders. They can be loaded directly by browser Canvas or exported to PNG later.

The technology-facing manifest is maintained at `data/asset-manifest.json`. Use that file as the source of truth for asset keys, paths, viewBox sizes, recommended display sizes, UI states, and HUD data fields.

## Folder Map

```text
assets/
├── reference/
│   └── character-reference-yellow-white-dogs.png
├── player/
│   ├── yellow-dog/
│   └── white-dog/
├── aircraft/
│   ├── yellow-fighter/
│   └── white-fighter/
├── enemy/
├── background/
├── effects/
│   ├── bullet/
│   ├── energy/
│   ├── explosion/
│   └── skill/
├── ui/
│   ├── badges/
│   ├── buttons/
│   ├── cards/
│   ├── hud/
│   ├── icons/
│   └── screens/
└── audio/
```

## MVP Asset List

### Reference

- `reference/character-reference-yellow-white-dogs.png`

### Player

- `player/yellow-dog/yellow-dog-avatar.svg`
- `player/white-dog/white-dog-avatar.svg`

### Aircraft

- `aircraft/yellow-fighter/yellow-fighter-idle.svg`
- `aircraft/white-fighter/white-fighter-idle.svg`

### Background

- `background/stage1-bg-01.svg`
- `background/stage1-bg-02.svg`

### Enemy

- `enemy/enemy-small.svg`
- `enemy/enemy-medium.svg`
- `enemy/enemy-boss.svg`

### Effects

- `effects/bullet/player-bullet.svg`
- `effects/bullet/enemy-bullet-straight.svg`
- `effects/explosion/explosion-small.svg`
- `effects/energy/energy-crystal.svg`
- `effects/skill/skill-shield.svg`
- `effects/skill/skill-overload.svg`
- `effects/skill/skill-strike.svg`

### UI

- `ui/hud/hp-bar-bg.svg`
- `ui/hud/hp-bar-fill.svg`
- `ui/hud/energy-bar-bg.svg`
- `ui/hud/energy-bar-fill.svg`
- `ui/hud/top-hud-panel.svg`
- `ui/hud/skill-dock.svg`
- `ui/buttons/skill-button-disabled.svg`
- `ui/buttons/skill-button-ready.svg`
- `ui/buttons/skill-button-active.svg`
- `ui/buttons/skill-button-cooldown.svg`
- `ui/buttons/button-primary.svg`
- `ui/buttons/button-secondary.svg`
- `ui/buttons/button-danger.svg`
- `ui/cards/character-card-yellow.svg`
- `ui/cards/character-card-white.svg`
- `ui/badges/season-01-badge.svg`
- `ui/icons/icon-time.svg`
- `ui/icons/icon-score.svg`
- `ui/icons/icon-rank.svg`
- `ui/screens/mvp-home-select.svg`
- `ui/screens/mvp-battle-hud.svg`
- `ui/screens/mvp-game-over.svg`
- `ui/screens/mvp-ranking.svg`
- `ui/screens/mvp-season-01.svg`
- `ui/screens/mvp-game-over-ranking.svg`

### Audio

- `audio/README.md`
- `audio/bgm/README.md`
- `audio/sfx/README.md`
- `audio/voice/README.md`

Audio is currently a placeholder structure only. Use `data/audio-manifest.json` for audio keys and target paths. Missing audio files should fallback to silence.

## Naming Rules

- Use lowercase English filenames.
- Use hyphen-separated words.
- Keep state suffixes stable: `disabled`, `ready`, `active`, `cooldown`.
- Keep MVP files directly loadable by technology layer.

## Size Baseline

- Mobile design baseline: `390 x 844`
- Background and screen previews: `390 x 844`
- Player avatars: `120 x 120` viewBox
- Player aircraft: `96 x 112` viewBox, recommended Canvas display `72 x 88`
- Skill buttons: `88 x 88` viewBox, recommended touch area `88 x 88`
- Character cards: `160 x 252` viewBox
- Season badge: `168 x 52` viewBox
- Primary button: `278 x 58` viewBox
- Secondary button: `198 x 46` viewBox
- Top HUD panel: `358 x 72` viewBox
- Skill dock: `108 x 124` viewBox
- Skill effects: `96 x 96` viewBox
- HUD HP bar: `168 x 28` viewBox
- HUD energy bar: `128 x 20` viewBox

## PNG Export Rule

SVG is the MVP default. If PNG is needed, export with the same filename and path, changing only the extension from `.svg` to `.png`. Prefer 2x export sizes and update `data/asset-manifest.json` before switching runtime loading.
