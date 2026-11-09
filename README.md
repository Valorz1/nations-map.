# Political Map of the Nations

An interactive political map of an invented world, traced from a hand-drawn pencil sketch.

> **This is my brother's project.** He invented this world and drew the original map, including the nations, rulers, wars, lore and characters. I'm just helping by putting it online and keeping the code up to date.

**View the map:** https://valorz1.github.io/nations-map/

Works in any modern browser on a computer, phone or iPad. No install needed.

## What's on the map

- **24 territories** with borders traced directly from the original pencil lines
- **Ratings** for each nation: Rate, Military power (M) and Economic power (E)
- **Capitals**: white circles show capital cities. The number inside is the infrastructure level, and bigger circles mean bigger populations
- **Disputed areas** (hatched, marked DIS) and **resistance movements** (dotted), including the Teddy Resistance and the Lego Resistance
- **The Blight**, an infected zone overrun by zombies
- **Territories** shown in their owner's colour, such as Shero U. (Sherolean Empire) and Marmites (Marbonese)

## Features

| Section | What it does |
|---|---|
| Overview | The world at a glance: great powers, balance of power, current wars and alliances, map key |
| Nations | Searchable index of every nation, territory and movement, filterable and sortable |
| Nation dossier | Emblem, rank, power cards, capitals and infrastructure, government, people, relations, lore and power over time |
| Rankings | Overall power rankings, Rate / Military / Economy leaderboards, infrastructure table and side-by-side comparison of two nations |
| Characters | Gallery and profiles of rulers and heroes: portrait, biography, achievements, political position, historical importance |
| Diplomacy | Relations matrix, current and historical wars, alliances, outcomes and changes over time |
| History | Archive of saved moments with map snapshots, territorial changes, power changes and rulers of the day |
| Encyclopedia | Browse or search nations, characters, governments, wars, alliances, capitals and events |
| Map tools | Zoom, layers, map key, timeline (slide between moments) and border editing |
| Search | Press `/` or Ctrl+K anywhere to search everything |

## Nations and governments

| Nation | Ruled by | Government | Rate | Military | Economy |
|---|---|---|---|---|---|
| Elarion Federation | Leon | Monarchy | 160 | 98 | 80 |
| Sherolean Empire | Shero | Dictatorship | 156 | 95 | 82 |
| Representation of Baloonia | Parliament | Democracy | 150 | 60 | 95 |
| Federal Republic of the 5 Rivers | President | Democratic | 148 | 80 | 82 |
| Marbonese | The Senate | Liberalism | 140 | 75 | 60 |
| Royalist Union of Cars | Consul | Monarchy | 129 | 70 | 52 |
| Multi Allies | Chancellor | Conservative | 120 | 68 | 79 |
| Multi-Axis | One leader | Communist | 100 | 71 | 66 |
| Federal Union of Cars | The people | Democrats | 96 | 55 | 36 |
| Promised Land of the Desert | Two brothers | Democracy | 90 | 80 | 30 |
| Liberalist Rebels | Idealists | Liberal | 82 | 40 | 40 |
| Civil Union of the Jungle | Tribal leader | Authoritarianism | 78 | 30 | 50 |
| Marmite Resistance | Military generals | Anarchy | 55 | 12 | 6 |

## Using it

- **Tap a nation** on the map to open its dossier
- **Drag** to move around, and **pinch or scroll** to zoom
- On a phone or iPad, drag the bottom sheet up or down to resize it
- Keyboard: `/` search, `1`–`7` sections, `T` timeline, `L` layers, `?` all shortcuts

## Saving changes

Edits (ratings, borders, lore, governments, wars, timeline, characters) are **saved automatically in your browser**.
To publish them for everyone:

1. Open **Your data** (the database icon, top right) and choose **Export world.json**
2. Replace `data/world.json` in this repo with the downloaded file
3. Commit and push:

```bash
git add data/world.json
git commit -m "Update the world"
git push
```

**Import** loads a world.json into your browser, and **Discard my changes** returns to the published version.

## Running it locally

The page loads its data files, so open it through a small local server rather than double-clicking `index.html`:

```bash
python -m http.server
```

Then visit http://localhost:8000.

## Credits

- **Creator:** my brother. The world, the hand-drawn map, the nations, the lore and the characters are all his.
- **Helper:** me (Valorz1). I look after the GitHub repo and the website.

## Files

- `index.html`: page structure
- `css/`: `tokens.css` (design system), `map.css` (the map's own styles, unchanged), `layout.css`, `components.css`, `views.css`
- `js/main.js`: starts the app; `js/store.js` loading and saving; `js/model.js` derived facts and rankings; `js/search.js` search index
- `js/map/`: the map engine (`engine.js`), border editor (`editor.js`) and timeline (`timeline.js`)
- `js/ui/` and `js/views/`: the interface and each section
- `data/geo.json`: map geometry traced from the sketch
- `data/nations.json`: every nation, territory and movement as drawn on the sketch
- `data/world.json`: the editable world (ratings, borders, lore, governments, wars and alliances, timeline, characters)
- `assets/emblem.svg`: site emblem
- `README.md`, `LICENSE`
