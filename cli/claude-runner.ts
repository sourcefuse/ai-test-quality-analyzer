#!/usr/bin/env ts-node
/**
 * Claude Runner
 * Utility to spawn and run Claude commands with prompts
 *
 * Usage:
 *   npm run claude <prompt-file> [-- --verbose]
 *   OR
 *   npx ts-node claude-runner.ts <prompt-file> [--verbose]
 *
 * Examples:
 *   npm run claude prompts/create-requirement.md
 *   npm run claude prompts/create-requirement.md -- --verbose
 *   npm run claude prompts/create-requirement.md -- -v
 *
 * Environment Variables:
 *   CLAUDE_VERBOSE_MODE - Enable verbose mode (true/false, default: false)
 *
 * Note: When using npm run, use -- before --verbose to pass flags to the script
 */

import {spawn} from 'child_process';
import {existsSync, readFileSync} from 'fs';
import {resolve} from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main function to run Claude with a prompt file
 */
async function main() {
  // Get prompt file from command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: Please provide a prompt file path');
    console.log('\nUsage:');
    console.log('  npm run claude <prompt-file> [-- --verbose]');
    console.log('  OR');
    console.log('  npx ts-node claude-runner.ts <prompt-file> [--verbose]');
    console.log('\nExamples:');
    console.log('  npm run claude prompts/create-requirement.md');
    console.log('  npm run claude prompts/create-requirement.md -- --verbose');
    console.log('\nNote: When using npm run, use -- before --verbose to pass flags');
    process.exit(1);
  }

  const promptFile = args[0];
  const promptPath = resolve(process.cwd(), promptFile);

  // Check if prompt file exists
  if (!existsSync(promptPath)) {
    console.error(`❌ Error: Prompt file not found: ${promptPath}`);
    process.exit(1);
  }

  console.log('🚀 Claude Runner');
  console.log('================');
  console.log(`📄 Prompt file: ${promptFile}`);
  console.log(`📂 Full path: ${promptPath}`);
  console.log('');

  // Read the prompt file content
  const promptContent = readFileSync(promptPath, 'utf-8');

  // Check if verbose flag is provided via CLI args or environment variable
  const verboseFromArgs = args.includes('--verbose') || args.includes('-v');
  const verboseFromEnv = process.env.CLAUDE_VERBOSE_MODE === 'true';
  const verboseMode = verboseFromArgs || verboseFromEnv;

  // Build the Claude command
  const claudeCommand = 'claude';
  const claudeArgs = [
    '--print',
    '--dangerously-skip-permissions',
    '--output-format',
    verboseMode ? 'stream-json' : 'json', // Use stream-json in verbose mode
  ];

  // Add verbose flag if requested
  if (verboseMode) {
    claudeArgs.push('--verbose');
  }

  console.log(`🔧 Running command: CI=true ${claudeCommand} ${claudeArgs.join(' ')}`);
  console.log(`📊 Verbose mode: ${verboseMode ? 'ENABLED' : 'DISABLED'}`);
  console.log('');

  // Spawn the Claude process
  const claudeProcess = spawn(claudeCommand, claudeArgs, {
    env: {
      ...process.env,
      CI: 'true',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Write prompt content to stdin
  claudeProcess.stdin.write(promptContent);
  claudeProcess.stdin.end();

  // Capture stdout
  let stdoutData = '';
  claudeProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    stdoutData += output;

    // In verbose mode with stream-json, show output in real-time
    if (verboseMode) {
      process.stdout.write(output);
    }
    // In normal mode, don't print stdout directly since we'll format and print the JSON summary later
  });

  // Capture stderr (show errors in real-time)
  let stderrData = '';
  claudeProcess.stderr.on('data', (data: Buffer) => {
    const output = data.toString();
    stderrData += output;
    process.stderr.write(output);
  });

  // Handle process completion
  claudeProcess.on('close', (code: number) => {
    console.log('');
    console.log('================');

    if (code === 0) {
      console.log('✅ Claude command completed successfully');

      // Try to parse JSON output if output format is JSON
      try {
        if (verboseMode) {
          // In verbose mode with stream-json, output was already shown in real-time
          // Try to parse the last line which should contain the final result
          const lines = stdoutData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          try {
            const finalResult = JSON.parse(lastLine);
            if (finalResult.type === 'result') {
              console.log('\n📊 Final Summary:');
              console.log('================');
              console.log(`❌ Error: ${finalResult.is_error || false}`);
              console.log(`💰 Cost: $${finalResult.total_cost_usd || 0}`);

              // Show token usage if available
              if (finalResult.usage) {
                const usage = finalResult.usage;
                const totalInputTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
                const totalOutputTokens = usage.output_tokens || 0;
                console.log(`🔢 Tokens: ${totalInputTokens.toLocaleString()} input, ${totalOutputTokens.toLocaleString()} output (${(totalInputTokens + totalOutputTokens).toLocaleString()} total)`);
              }

              console.log(`⏱️  Duration: ${finalResult.duration_ms || 0}ms`);
            }
          } catch (e) {
            // Could not parse final result, that's okay
          }
        } else {
          // In normal mode, parse and show summary
          const jsonOutput = JSON.parse(stdoutData);
          console.log('\n📊 Claude Response Summary:');
          console.log('================');
          console.log(`❌ Error: ${jsonOutput.is_error || false}`);
          console.log(`💰 Cost: $${jsonOutput.total_cost_usd || 0}`);

          // Show token usage if available
          if (jsonOutput.usage) {
            const usage = jsonOutput.usage;
            const totalInputTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
            const totalOutputTokens = usage.output_tokens || 0;
            console.log(`🔢 Tokens: ${totalInputTokens.toLocaleString()} input, ${totalOutputTokens.toLocaleString()} output (${(totalInputTokens + totalOutputTokens).toLocaleString()} total)`);
          }

          console.log(`⏱️  Duration: ${jsonOutput.duration_ms || 0}ms`);
          console.log('\n📝 Result:');
          console.log('----------------');
          console.log(jsonOutput.result || 'No result');
        }
      } catch (error) {
        // Not JSON or couldn't parse, that's okay
      }
    } else {
      console.error(`❌ Claude command failed with exit code: ${code}`);
      process.exit(code);
    }
  });

  // Handle errors
  claudeProcess.on('error', (error: Error) => {
    console.error('❌ Error spawning Claude process:', error.message);
    console.error('\nMake sure Claude CLI is installed and available in your PATH');
    console.error('Install: npm install -g @anthropic-ai/claude-cli');
    process.exit(1);
  });
}

// Run the main function
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
