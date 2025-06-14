#!/usr/bin/env node

import { resolve } from 'node:path';
import { generateInfoJson } from './generate-info-json.js';

type CliArgs = {
  input?: string;
  output?: string;
  help?: boolean;
  validateDependencies?: boolean;
};

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--input' || arg === '-i') {
      const nextArg = args[++i];
      if (nextArg) {
        result.input = nextArg;
      }
    } else if (arg === '--output' || arg === '-o') {
      const nextArg = args[++i];
      if (nextArg) {
        result.output = nextArg;
      }
    } else if (arg === '--validate-dependencies') {
      result.validateDependencies = true;
    } else if (arg === '--no-validate-dependencies') {
      result.validateDependencies = false;
    } else if (!arg.startsWith('-')) {
      // Positional argument - treat as input if no input specified yet
      if (!result.input) {
        result.input = arg;
      } else if (!result.output) {
        result.output = arg;
      }
    }
  }
  
  return result;
}

function showHelp() {
  console.log(`
factorio-gen - Generate Factorio mod info.json from package.json

Usage:
  factorio-gen [options] [input] [output]
  factorio-gen -i package.json -o info.json
  factorio-gen package.json info.json

Options:
  -i, --input <file>           Input package.json file (default: package.json)
  -o, --output <file>          Output info.json file (default: info.json)
      --validate-dependencies  Validate mod dependencies against mod portal (default)
      --no-validate-dependencies  Skip dependency validation
  -h, --help                   Show this help message

Examples:
  factorio-gen                           # Read package.json, write info.json
  factorio-gen my-package.json           # Read my-package.json, write info.json
  factorio-gen package.json mod-info.json  # Read package.json, write mod-info.json
  `);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  const inputFile = resolve(args.input || 'package.json');
  const outputFile = resolve(args.output || 'info.json');
  
  try {
    console.log(`Reading ${inputFile}...`);
    console.log('Generating info.json...');
    
    const status = await generateInfoJson({
      input: inputFile,
      output: outputFile,
      validateDependencies: args.validateDependencies ?? true,
    });
    
    if (status === 'error') {
      process.exit(1);
    } else if (status === 'warning') {
      console.log('✓ Successfully generated info.json (with warnings)');
    } else {
      console.log('✓ Successfully generated info.json');
    }
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error(`❌ Error: Input file '${inputFile}' not found`);
      } else if (error.message.includes('EACCES')) {
        console.error(`❌ Error: Permission denied accessing file`);
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    } else {
      console.error('❌ An unknown error occurred');
    }
    process.exit(1);
  }
}

main().catch(console.error); 