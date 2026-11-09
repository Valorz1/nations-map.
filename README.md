# 🌍 Political Map of the Nations

An interactive political map of an original fictional world, brought to life from a hand-drawn pencil sketch.

Explore nations, governments, military powers, economies, rivalries, alliances, characters and the history of a world created entirely from imagination.

**This is my brother's world.**

He created the fictional world, drew the original map and invented its nations, rulers, wars, lore and characters. I'm helping bring his creation online, maintain the website and keep the project up to date.

**🗺️ [Explore the Political Map](https://valorz1.github.io/nations-map./)**

Works in modern desktop and mobile browsers. No installation required.

---

## 🌐 About the World

The map represents an entirely fictional world containing 24 territories, each with its own identity, political system, history and place in the balance of power.

The original borders were traced directly from my brother's hand-drawn pencil map, preserving the geography and layout of his original creation.

### Map symbols and information

- **Nation ratings:** Each nation has a Rate, Military Power (M) and Economic Power (E) rating.
- **Capital cities:** White circles identify capitals. Numbers indicate infrastructure levels, while circle sizes represent population.
- **Disputed territories:** Hatched areas marked `DIS` identify disputed land.
- **Resistance movements:** Dotted areas represent resistance movements, including the Teddy Resistance and Lego Resistance.
- **The Blight:** An infected territory overrun by zombies.
- **Controlled territories:** Territories are displayed in their owner's colour, including Shero U. (Sherolean Empire) and Marmites (Marbonese).

---

## ✨ Features

The website includes several sections for exploring and understanding the fictional world.

| Section | Description |
|---|---|
| **Overview** | A global overview of major powers, balance of power, current wars, alliances and map information. |
| **Nations** | A searchable and sortable index of nations, territories and movements. |
| **Nation Dossiers** | Detailed nation profiles featuring emblems, rankings, statistics, capitals, infrastructure, governments, populations, relations and lore. |
| **Rankings** | Overall power rankings, military and economic leaderboards, infrastructure statistics and nation comparisons. |
| **Characters** | Profiles of rulers and important figures, including portraits, biographies, achievements and historical significance. |
| **Diplomacy** | Relations between nations, alliances, wars, historical conflicts and their outcomes. |
| **History** | Saved historical moments, map snapshots, territorial changes, changes in power and historical rulers. |
| **Encyclopedia** | A searchable reference for nations, characters, governments, wars, alliances, capitals and historical events. |
| **Map Tools** | Zoom controls, map layers, map key, timeline and border editing. |
| **Global Search** | Search across the world using `/` or `Ctrl + K`. |

---

## 🏛️ Nations and Governments

Below is a selection of nations and their current recorded statistics.

| Nation | Leader / Ruler | Government | Rate | Military | Economy |
|---|---|---|---:|---:|---:|
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

*Statistics represent the fictional world's own ranking system and are not real-world measurements.*

---

## 🎮 How to Use the Map

### Mouse and touchscreen controls

- **Select a nation:** Click or tap a nation to open its dossier.
- **Move around:** Drag the map.
- **Zoom:** Scroll with your mouse or pinch on a touchscreen.
- **Resize the information panel:** On phones and iPads, drag the bottom sheet up or down.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `/` | Open search |
| `Ctrl + K` | Open global search |
| `1–7` | Switch between sections |
| `T` | Open the timeline |
| `L` | Open map layers |
| `?` | Show all keyboard shortcuts |

---

## 💾 Editing and Saving the World

The map supports editing, allowing changes to be made to the fictional world.

Edits are automatically saved in your browser, including:

- Nation ratings and statistics
- Borders and territories
- Lore and government information
- Wars and alliances
- Timeline events
- Characters and their biographies

### Publishing your changes

Browser changes are stored locally and do not automatically update the live website.

To publish your changes for everyone:

1. Open **Your Data** using the database icon in the top-right corner.
2. Select **Export world.json**.
3. Replace `data/world.json` in the repository with the exported file.
4. Commit and push the changes to GitHub.

For example:

```bash
git add data/world.json
git commit -m "Update the world"
git push
```

### Importing and resetting data

- **Import:** Load a `world.json` file into your browser.
- **Discard my changes:** Return to the published version of the world.

Always keep a backup of your exported data before replacing files.

---

## 💻 Running Locally

You can run the project on your own computer without installing any additional dependencies beyond Python (if using the suggested local server).

### 1. Clone the repository

```bash
git clone https://github.com/Valorz1/nations-map..git
```

### 2. Open the project folder

```bash
cd nations-map.
```

### 3. Start a local server

```bash
python -m http.server
```

### 4. Open the website

Visit:

```text
http://localhost:8000
```

A local server is recommended because the website loads external data files, which may not work correctly when opening `index.html` directly.

---

## 📁 Project Structure

```text
nations-map.
│
├── index.html
├── README.md
├── LICENSE
│
└── data/
    └── world.json
```

- `index.html` — Main website and interactive map.
- `data/world.json` — World data, including nations and their information.
- `README.md` — Project documentation.
- `LICENSE` — MIT licence.

---

## ❤️ Credits and Acknowledgements

This project is built around an original fictional world created by my brother.

- **World Creator:** My brother — creator of the world, original hand-drawn map, nations, borders, rulers, wars, characters and lore.
- **Website and Maintenance:** Valorz1 — responsible for the GitHub repository, website implementation and ongoing maintenance.

The fictional world and its original creative content belong to its creator.

---

## 📜 Licence

The source code is available under the MIT Licence. See the [LICENSE](LICENSE) file for details.

The MIT licence for the code does not automatically grant permission to reuse the original fictional world, map artwork, characters or lore.

---

**Explore the world. Discover its nations. Follow its history.**
