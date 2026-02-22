import chalk from 'chalk';

let verbose = false;

export function setVerbose(enabled: boolean) {
  verbose = enabled;
}

export function info(msg: string) {
  console.log(chalk.blue('ℹ'), msg);
}

export function success(msg: string) {
  console.log(chalk.green('✔'), msg);
}

export function warn(msg: string) {
  console.log(chalk.yellow('⚠'), msg);
}

export function error(msg: string) {
  console.error(chalk.red('✖'), msg);
}

export function debug(msg: string) {
  if (verbose) {
    console.log(chalk.gray('⟐'), msg);
  }
}
