import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan' });
}

export function banner() {
  console.log(
    chalk.bold.cyan('\n  a11y-sentinel') + chalk.gray(' v0.1.0\n'),
  );
}

export function divider() {
  console.log(chalk.gray('─'.repeat(50)));
}
