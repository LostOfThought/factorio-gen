# factorio-gen

Generate Factorio mod `info.json` from `package.json`.

## Installation

```bash
pnpm add factorio-gen
# or
npm install factorio-gen
```

## Usage

### As a Binary

After installation, you can use the `factorio-gen` command:

```bash
# Generate info.json from package.json
factorio-gen

# Specify input and output files
factorio-gen my-package.json my-info.json

# Using options
factorio-gen --input package.json --output info.json
factorio-gen -i package.json -o info.json
```

### As a Build Step

Add it to your `package.json` scripts:

```json
{
  "scripts": {
    "build:info": "factorio-gen",
    "prebuild": "factorio-gen package.json info.json"
  }
}
```

### Options

- `-i, --input <file>`: Input package.json file (default: `package.json`)
- `-o, --output <file>`: Output info.json file (default: `info.json`)
- `-h, --help`: Show help message

## Input Format

Your `package.json` should contain the following fields for Factorio mod generation:

```json
{
  "name": "my-factorio-mod",
  "version": "1.2.3",
  "title": "My Awesome Factorio Mod",
  "author": "Your Name",
  "description": "A description of your mod",
  "factorio_version": "1.1",
  "dependencies": ["base >= 1.1.0", "? some-optional-mod"]
}
```

### Required Fields

- `name`: Mod internal name (3-50 characters, alphanumeric, hyphens, underscores)
- `version`: Semantic version (e.g., "1.2.3")
- `title`: Display name for the mod
- `author`: Mod author name

### Optional Fields

- `contact`: Contact information
- `homepage`: URL to mod homepage
- `description`: Mod description
- `factorio_version`: Factorio version (default: "0.12")
- `dependencies`: Array of dependency strings (default: ["base"])
- Various feature flags (`quality_required`, `space_travel_required`, etc.)

### Dependency Format

Dependencies can be specified as:
- Simple mod name: `"base"`
- With version constraint: `"base >= 1.1.0"`
- Optional dependency: `"? optional-mod"`
- Incompatible dependency: `"! incompatible-mod"`

## Validation

The tool validates dependencies against the Factorio mod portal and will show warnings if:
- A mod is not found on the portal
- A specified version constraint doesn't match available versions

## Development

```bash
# Build the project
pnpm run build

# Test locally
node dist/cli.js --help
``` 