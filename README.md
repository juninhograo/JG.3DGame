# 3D First-Person Game

A simple 3D first-person game built with Babylon.js. Navigate a 3D environment with obstacles and explore the scene.

## Features

- **First-Person Perspective**: Experience the game from the player's viewpoint
- **WASD Movement**: Move forward, backward, and strafe left/right
- **Arrow Key Camera Control**: Look around using arrow keys
- **3D Environment**: Rendered with Babylon.js featuring:
  - Ground plane with green material
  - Box obstacles with orange material
  - Sphere objects with blue material
  - Proper lighting and shadows
- **Collision Detection**: Walk around obstacles naturally

## Controls

| Key | Action |
|-----|--------|
| **W** | Move Forward |
| **A** | Move Left |
| **S** | Move Backward |
| **D** | Move Right |
| **↑ Arrow Up** | Look Up |
| **↓ Arrow Down** | Look Down |
| **← Arrow Left** | Look Left |
| **→ Arrow Right** | Look Right |

## Getting Started

### Requirements
- A modern web browser with WebGL support
- VS Code with Live Server extension (recommended)

### Running the Game

**Option 1: Using Live Server (Recommended)**
1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VS Code
2. Right-click on `index.html` and select "Open with Live Server"
3. The game will open in your default browser

**Option 2: Using VS Code Task**
1. Press `Ctrl+Shift+B` to run the "Launch Live Server" task
2. The game will open automatically

**Option 3: Using Python HTTP Server**
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

## Project Structure

```
JG.3DGame/
├── index.html          # Main HTML file with canvas
├── style.css           # Styling for the game interface
├── game.js             # Game logic and Babylon.js scene setup
├── README.md           # This file
└── .github/
    └── copilot-instructions.md  # Project documentation for Copilot
```

## Game Details

### Scene Elements

- **Camera**: Positioned at height 2 units, looking forward
- **Ground**: 100x100 unit plane at the base
- **Obstacles**: Various boxes and spheres placed around the scene
- **Lighting**: Hemispherical light for overall illumination and a point light for shadow effects

### Movement System

- Smooth camera-relative movement (WASD keys)
- Arrow keys for independent camera rotation
- Collision detection prevents walking through obstacles
- Gravity system for realistic movement

## Customization

You can easily modify the game by editing `game.js`:

- **Change movement speed**: Adjust the `moveSpeed` variable (default: 0.3)
- **Change rotation speed**: Adjust the `rotationSpeed` variable (default: 0.02)
- **Add more obstacles**: Create new boxes or spheres and set their positions
- **Change colors**: Modify the `diffuse` property of materials
- **Adjust scene size**: Modify the ground dimensions and object positions

## Technology Stack

- **Babylon.js 5.53.0**: 3D graphics engine
- **HTML5**: Markup structure
- **CSS3**: Styling
- **JavaScript (ES6)**: Game logic and controls

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Notes

- The game requires WebGL support in your browser
- For best performance, use a modern browser
- The camera has a maximum look-up and look-down angle to prevent disorientation

## Future Enhancements

Possible improvements for this game:
- Add jumping mechanic
- Implement mouse look (in addition to arrow keys)
- Add sound effects and background music
- Create a skybox for a more immersive environment
- Add pickable items and inventory system
- Implement enemies/NPCs
- Create multiple levels
