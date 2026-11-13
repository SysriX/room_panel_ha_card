# Room Panel

A full-screen wall-tablet dashboard card for Home Assistant. The screen is divided into a block grid
(default 50 × 30) that always fills the whole display; you place glass frames on the grid and fill
them with modules (light, heating, weather, room climate, floor plan, audio, status bar, alarm clock,
bed, any other HA card …). Includes a visual in-dashboard editor for admins.

- Card type: `custom:raum-panel`
- Version: 2.106.0-beta.1
- UI language: German (English translation not yet available). YAML option names are partly German
  (e.g. `ecken`, `transparenz`, `schriftgroesse`) and are kept for compatibility.

> Built for the author's own home. Several defaults (entity IDs, helper names, media folders) follow the
> author's naming scheme and may need to be set explicitly in your configuration – see
> [Defaults you may need to adapt](#defaults-you-may-need-to-adapt).

## Features

- Block grid that adapts to any tablet resolution (landscape or portrait), no black borders.
- Glass frames with free position/size, optional free polygon shape (`ecken:`), transparency, padding,
  per-frame and per-module font scaling (`schriftgroesse:`).
- Modules (each usable any number of times):
  `light`, `lichter` (light list), `heating`, `weather`, `air` (room climate / air quality),
  `floorplan`, `audio`, `statusbar`, `uhr` (clock), `wecker` (alarm clock), `kodi` (remote),
  `bett` (bed: weight/occupancy/heated blanket), `card` (embed any HA card).
- Settings modules for a settings popup: `light-settings`, `heating-settings`, `vent-settings`,
  `house-settings`, `door-settings` (doorbell), `audio-settings`, `bett-settings`.
- Each module has several layouts (`layout:`) and can hide/show elements (`hide:`/`show:`), or be freely
  arranged element by element (`layout: custom` + `grid:` + `elements:`).
- Double-tap a frame to zoom it to full screen (`zoom:`), with its own full-screen arrangement.
- Visual editor (pencil icon, admins only; disable with `editor: false`): drag/resize frames, edit
  modules, copy the resulting YAML.
- Animated background (aurora following the sun position, sky with sun/moon/stars, color or image/slideshow).
- Optional LED dot-matrix font "Charlie Dotted" (bundled, see [Fonts](#fonts-and-licenses)).
- Bridge for third-party cards (`rp-extcard`): cards that implement `static get rpTeile()` can be split
  into parts and arranged inside the panel (e.g. Hallway Weather Card, Floor Plan Card).
- Each module is also registered as a standalone card (`custom:rp-light`, `custom:rp-heating`,
  `custom:rp-weather`, `custom:rp-air`, `custom:rp-floorplan`, `custom:rp-audio`, `custom:rp-statusbar`,
  `custom:rp-uhr`, `custom:rp-wecker`, `custom:rp-kodi`, `custom:rp-bett`, `custom:rp-lichter`,
  `custom:rp-*-settings`, `custom:rp-extcard`).
- An existing `custom:raum-tablet-card` configuration (see `room_tablet_ha_card`) also works with
  `type: custom:raum-panel` – without `frames:` the panel builds the classic three-column layout.

## Requirements

Required: Home Assistant 2024.1 or newer.

Optional, depending on which modules you use:

| Module / feature | Needs |
|---|---|
| `floorplan` with `ausschnitt:` (cut-out of the house plan) | [floor_plan_ha_card](https://github.com/SysriX/floor_plan_ha_card) (and optionally [home_twin_ha_integration](https://github.com/SysriX/home_twin_ha_integration)) |
| `wecker`, `uhr` (next alarm), `bett`, `bett-settings`, background settings on bed tablets | [alarm_clock_ha_integration](https://github.com/SysriX/alarm_clock_ha_integration) (domain `wecker`) |
| `heating-settings` | [heat_control_ha_integration](https://github.com/SysriX/heat_control_ha_integration) |
| `vent-settings` | [vent_control_ha_integration](https://github.com/SysriX/vent_control_ha_integration) |
| `light-settings` tabs time schedule / brightness | [light_schedule_ha_integration](https://github.com/SysriX/light_schedule_ha_integration), [light_lux_ha_integration](https://github.com/SysriX/light_lux_ha_integration) |
| `house-settings` presence simulation tab | [presence_simulation_ha_integration](https://github.com/SysriX/presence_simulation_ha_integration) |
| Status bar `batterien` icon (batteries to replace) | [battery_manager_ha_integration](https://github.com/SysriX/battery_manager_ha_integration) |
| `door-settings` (doorbell targets, speakers) | Browser Mod, optionally Music Assistant, helper `input_select` + scripts (see below) |
| Theme for dialogs/menus | [room_tablet_ha_theme](https://github.com/SysriX/room_tablet_ha_theme) (recommended) |

Fonts Rajdhani and Share Tech Mono are loaded from Google Fonts.

## Installation

### HACS (custom repository)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/SysriX/room_panel_ha_card`, category **Dashboard**.
2. Install **Room Panel**.
3. HACS adds the resource `/hacsfiles/room_panel_ha_card/room_panel_ha_card.js` (type *JavaScript module*).
   If not, add it under Settings → Dashboards → ⋮ → Resources.

### Manual

1. Copy the contents of `dist/` (`room_panel_ha_card.js`, `fonts/`, `rp-icons/`) into one folder, e.g.
   `/config/www/raum-tablet-card/`.
2. Add the resource `/local/raum-tablet-card/room_panel_ha_card.js` (type *JavaScript module*).

The card finds `fonts/` and `rp-icons/` next to its own script file automatically. To load the fonts
from elsewhere, set `window.RP_FONT_BASE = '/local/my-fonts/'` in a resource loaded before the card.

## Configuration

Minimal example (landscape tablet):

```yaml
type: custom:raum-panel
grid:
  columns: 50        # blocks horizontally (default 50)
  rows: 30           # blocks vertically (default 30)
  gap: 14
  padding: 14
background:
  mode: sun          # aurora following the sun, "off" = dark
frames:
  - col: 1
    row: 1
    w: 17
    h: 27
    modules:
      - type: light
        lights:
          primary:   { entity: light.living_room_ceiling, name: Primary,   subtitle: Ceiling spots, color: "#ffb347" }
          secondary: { entity: light.living_room_strips,  name: Secondary, subtitle: LED strips,    color: "#a36bff" }
  - col: 18
    row: 1
    w: 16
    h: 27
    modules:
      - type: heating
        climate: { entity: climate.living_room, valve: sensor.living_room_valve, min: 12, max: 28 }
      - type: air
        size: 5
        sensors:
          - { name: CO₂, entity: sensor.living_room_co2, unit: ppm, max: 2000, levels: [1000, 1400] }
          - { name: Humidity, entity: sensor.living_room_humidity, unit: "%", max: 100, range: [40, 60] }
  - col: right
    row: 1
    w: 17
    h: 27
    modules:
      - type: weather
        entity: weather.forecast_home
  - col: 1
    row: bottom
    w: 50
    h: 3
    padding: 0
    modules:
      - type: statusbar
        alarm: alarm_control_panel.home_alarm
        # persons: [person.alex, person.sam]   # default: all persons
```

### Frames

| Option | Meaning |
|---|---|
| `col`, `row` | start column/row (from 1) or `left`/`center`/`right`, `top`/`middle`/`bottom` |
| `w`, `h` | width/height in blocks |
| `glass` | `false` = no glass frame |
| `direction` | `column` (modules stacked) or `row` (side by side) |
| `padding`, `gap` | inner padding / gap between modules |
| `ecken` | free polygon shape, e.g. `"1,1 52,1 47,4 6,4"` |
| `transparenz` | 0–100 % background transparency (also panel-wide) |
| `display_transparenz` | 0–100 % transparency of the LCD display backgrounds (panel, frame, module or element) |
| `schriftgroesse` | text scale factor (panel, frame, module or element) |
| `zoom: false` | exclude this frame from double-tap full screen |

### Common module options

| Option | Meaning |
|---|---|
| `size` | share in the frame: omitted/`fill`, number of blocks, or `"40%"` |
| `width`, `height` | make the module smaller than its slot (blocks or percent) |
| `align` | `top`, `bottom`, `left`, `right` (combinable) |
| `rand` | margin around the module |
| `padding` | inner padding (default 8) |
| `zoom` | scale factor |
| `layout` | fixed layout variant (e.g. `tall`, `wide`, `compact`) or `custom` |
| `hide` / `show` | hide or exclusively show elements |

### Panel-level options

| Option | Meaning |
|---|---|
| `debug: true` | show grid lines and frame labels |
| `editor: false` | hide the pencil editor and "Arrange" buttons |
| `zoom: true` or `{ timeout: 60, dauer: 380 }` | double-tap a frame to show it full screen |
| `schrift: charlie` / `standard` | font (global switch: `window.RP_SCHRIFT = 'standard'`) |
| `settings:` | content of the settings popup opened from the status bar |

### Embedding other cards

```yaml
- type: card
  size: 6
  card:
    type: tile
    entity: light.living_room_ceiling
```

## User data folders

These are **not** part of the repository; create them yourself if you use the feature:

| Folder | Used by |
|---|---|
| Media folder `wallpaper` (`media-source://media_source/local/wallpaper`, i.e. `/media/wallpaper`) | background type "image" / slideshow (images can also be uploaded from the settings popup) |
| Media folder `klingeltoene` (`/media/klingeltoene`) and `/local/klingeltoene/` | doorbell ringtones in `door-settings`; override with `custom_tones:` and `tones_path:` |
| `/local/grundriss/…` | your own floor plan images (`floorplan.image`) |

## Defaults you may need to adapt

Some modules fall back to the author's helper/entity names when an option is not set:

- `door-settings`: `devices: input_select.klingel_gerate`, `popup_script: script.klingel_popup`,
  `scan_script: script.klingel_geraete_suchen`, `speaker_platform: music_assistant`.
- Status bar / settings: `sensor.haus_sys_daytime`, `sensor.batterien_zu_tauschen`, `sensor.batterien_schwach`,
  `sensor.haus_heat_control`, `sensor.haus_vent_control`, `sensor.haus_sys_presence_sim`,
  `input_number.haus_sys_panel_cfg_*`, `script.light_motion_apply`.
- `kodi`: `media_player.kodi`; weather: `weather.forecast_home`.

Missing entities are shown as unavailable / "not set up"; set the corresponding option explicitly
where one exists.

## Fonts and licenses

- `dist/fonts/charlie_punkte.ttf`, `dist/fonts/charlie_voll.ttf`: "Charlie Dotted" by nirmalbiswas (2010, FontStruct),
  licensed **CC BY-SA 3.0**, modified (octagonal dots, added German umlauts and symbols, filled variant).
  See `dist/fonts/LIZENZ-charlie-dotted.txt`.
- `dist/rp-icons/*.png`: rendered status bar icons, part of this project (MIT).
- Code: MIT License, see [LICENSE](LICENSE).
