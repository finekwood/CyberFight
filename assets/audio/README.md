# Cyber Flight Audio Assets

This folder is reserved for Cyber Flight MVP audio assets.

No real audio files are shipped yet. Do not create fake `.mp3`, `.wav`, or `.ogg` files. The runtime should load by audio key and silently skip missing files.

## Folder Map

```text
assets/audio/
├── bgm/
├── sfx/
└── voice/
```

## MVP Target Files

| Audio Key | Target File | Usage |
| --- | --- | --- |
| `battleBgm` | `bgm/bgm-battle-loop.mp3` | Battle loop BGM |
| `playerShoot` | `sfx/sfx-player-shoot.wav` | Player auto shot |
| `enemyExplosion` | `sfx/sfx-enemy-explosion.wav` | Enemy destroyed |
| `energyPickup` | `sfx/sfx-energy-pickup.wav` | Energy crystal pickup |
| `skillReady` | `sfx/sfx-skill-ready.wav` | Skill reaches ready state |
| `skillCast` | `sfx/sfx-skill-cast.wav` | Skill successfully cast |
| `playerHit` | `sfx/sfx-player-hit.wav` | Player takes damage |
| `gameOver` | `sfx/sfx-game-over.wav` | Run ends |
| `buttonClick` | `sfx/sfx-button-click.wav` | UI button click |

## Runtime Contract

- Use `data/audio-manifest.json` as the current audio key list.
- Missing audio files must fallback to silence.
- BGM starts after first user interaction and stops or fades on Game Over.
- High-frequency SFX such as `playerShoot` must be rate-limited.

## Production Note

See `Note/Cyber Flight 聲音素材生產與占位規範.md` before adding real or placeholder audio files.
